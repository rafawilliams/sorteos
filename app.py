"""
Lotería de Panamá - Aplicación Web
Backend Flask con datos desde MariaDB, estadísticas y recomendaciones.
"""

import logging
import random
import subprocess
import sys
import time
from collections import Counter, defaultdict

from flask import Flask, jsonify, render_template, request
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from sqlalchemy import desc, func

from base import Session, engine, Base
from loteria import Loteria
from ml_model import predictor

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("sorteos")

# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["120 per minute"],
    storage_uri="memory://",
)


def _json_safe(obj):
    """Recursively convert numpy types to native Python for JSON serialization."""
    import numpy as _np
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_json_safe(v) for v in obj]
    if isinstance(obj, (_np.integer,)):
        return int(obj)
    if isinstance(obj, (_np.floating,)):
        return float(obj)
    if isinstance(obj, (_np.bool_,)):
        return bool(obj)
    if isinstance(obj, _np.ndarray):
        return obj.tolist()
    return obj

@app.after_request
def log_request(response):
    if request.path.startswith("/api/"):
        log.info("%s %s %s", request.method, request.path, response.status_code)
    return response


# ---------------------------------------------------------------------------
# Cache layer
# ---------------------------------------------------------------------------

_cache: dict = {}
CACHE_TTL = 300  # 5 minutes


def _cache_get(key: str):
    entry = _cache.get(key)
    if entry and (time.time() - entry["ts"]) < CACHE_TTL:
        return entry["data"]
    return None


def _cache_set(key: str, data):
    _cache[key] = {"data": data, "ts": time.time()}


def _cache_clear():
    _cache.clear()


# ---------------------------------------------------------------------------
# Data layer — MariaDB via SQLAlchemy
# ---------------------------------------------------------------------------


def get_sorteos() -> list[dict]:
    cached = _cache_get("sorteos")
    if cached is not None:
        return cached

    session = Session()
    try:
        rows = session.query(Loteria).order_by(desc(Loteria.fecha)).all()
        data = [
            {
                "id": str(r.id),
                "fecha": r.fecha.isoformat() if r.fecha else "",
                "cat": (r.tipo or "").strip().lower(),
                "primero": r.primero or "",
                "segundo": r.segundo or "",
                "tercero": r.tercero or "",
                "letra": r.letras or "",
                "serie": r.serie or "",
                "folio": r.folio or "",
            }
            for r in rows
        ]
        _cache_set("sorteos", data)
        return data
    finally:
        session.close()


def get_last_update() -> str:
    session = Session()
    try:
        row = session.query(func.max(Loteria.fecha)).scalar()
        return row.isoformat() if row else ""
    finally:
        session.close()


# ---------------------------------------------------------------------------
# Stats helpers
# ---------------------------------------------------------------------------

RECO_DATE_FROM = "1995-01-01"  # Recommendations use data from this date onwards


def _filter_recent(sorteos: list[dict]) -> list[dict]:
    """Filter sorteos from RECO_DATE_FROM onwards for recommendations."""
    return [s for s in sorteos if s.get("fecha", "") >= RECO_DATE_FROM]


CAT_LABELS = {
    "dominical": "Dominical",
    "miercolito": "Miercolito",
    "gordito": "Gordito del Zodiaco",
    "extraordinario": "Extraordinario",
    "extraordinaria": "Extraordinaria",
    "zodiaco": "Zodiaco",
    "extraordonario": "Extraordonario",
}


def _extract_decena(primero: str) -> str | None:
    """Extract the tens digit (index 2) from a 4-digit lottery number."""
    p = primero.zfill(4) if primero else ""
    return p[2] if len(p) >= 4 else None


def _extract_numbers(sorteos: list[dict], category: str | None = None,
                     prize: str = "primero") -> list[str]:
    nums = []
    for s in sorteos:
        if category and s.get("cat") != category:
            continue
        p = s.get(prize, "")
        if p:
            nums.append(p.zfill(4))
    return nums


def digit_frequency(numbers: list[str]) -> dict:
    counter = Counter()
    for n in numbers:
        for d in n:
            counter[d] += 1
    return {str(i): counter.get(str(i), 0) for i in range(10)}


def position_frequency(numbers: list[str]) -> list[dict]:
    result = []
    for pos in range(4):
        counter = Counter()
        for n in numbers:
            if pos < len(n):
                counter[n[pos]] += 1
        result.append({str(i): counter.get(str(i), 0) for i in range(10)})
    return result


def last_digit_pairs(numbers: list[str]) -> dict:
    counter = Counter()
    for n in numbers:
        counter[n[-2:]] += 1
    return dict(counter.most_common(30))


def hot_cold(numbers: list[str], top: int = 10) -> dict:
    counter = Counter(numbers)
    most = counter.most_common(top)
    least = counter.most_common()[:-top - 1:-1] if len(counter) >= top else list(reversed(counter.most_common()))
    return {
        "hot": [{"number": n, "count": c} for n, c in most],
        "cold": [{"number": n, "count": c} for n, c in least],
    }


def number_recommendation(numbers: list[str], top: int = 5) -> list[dict]:
    if not numbers:
        return []

    pos_scores: list[Counter] = [Counter() for _ in range(4)]
    total = len(numbers)
    for idx, n in enumerate(numbers):
        weight = 1 + (total - idx) / total
        for pos in range(min(4, len(n))):
            pos_scores[pos][n[pos]] += weight

    pos_probs = []
    for ps in pos_scores:
        s = sum(ps.values()) or 1
        pos_probs.append({d: ps[d] / s for d in ps})

    candidates: Counter = Counter()
    for _ in range(50_000):
        num = ""
        for pos in range(4):
            digits = list(pos_probs[pos].keys())
            weights = [pos_probs[pos][d] for d in digits]
            num += random.choices(digits, weights=weights, k=1)[0]
        candidates[num] += 1

    hist = Counter(numbers)
    scored = []
    for num, gen_count in candidates.most_common(200):
        hist_score = hist.get(num, 0)
        score = gen_count * 0.6 + hist_score * 1000 * 0.4
        confidence = min(round(score / 500 * 100, 1), 99.9)
        scored.append({"number": num, "score": round(score, 1), "confidence": confidence})

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top]


# ---------------------------------------------------------------------------
# Decena recommendation (based on last 3 draws pattern matching)
# ---------------------------------------------------------------------------

def decena_recommendation(sorteos: list[dict], category: str) -> dict | None:
    """Recommend next decena for a category based on last-3-draw pattern matching."""
    cat_sorteos = [s for s in sorteos if s.get("cat") == category and s.get("primero")]
    if len(cat_sorteos) < 4:
        return None

    # Reverse to chronological order (oldest first)
    cat_chrono = list(reversed(cat_sorteos))

    decena_seq = []
    fecha_seq = []
    for s in cat_chrono:
        d = _extract_decena(s["primero"])
        if d is not None:
            decena_seq.append(d)
            fecha_seq.append(s.get("fecha", ""))

    if len(decena_seq) < 4:
        return None

    last_3 = decena_seq[-3:]
    last_3_fechas = fecha_seq[-3:]
    target_triple = tuple(last_3)

    # Search history for matching triples and what followed
    followers: Counter = Counter()
    match_count = 0
    for i in range(len(decena_seq) - 3):
        triple = (decena_seq[i], decena_seq[i + 1], decena_seq[i + 2])
        if triple == target_triple:
            followers[decena_seq[i + 3]] += 1
            match_count += 1

    method = "triple"

    # Fallback: match last 2 decenas
    if match_count == 0:
        target_pair = tuple(last_3[-2:])
        for i in range(len(decena_seq) - 2):
            pair = (decena_seq[i], decena_seq[i + 1])
            if pair == target_pair and i + 2 < len(decena_seq):
                followers[decena_seq[i + 2]] += 1
                match_count += 1
        method = "pair"

    # Fallback: overall frequency
    if match_count == 0:
        followers = Counter(decena_seq)
        match_count = len(decena_seq)
        method = "fallback"

    recommended = followers.most_common(1)[0][0]
    rec_count = followers[recommended]
    confidence = round(rec_count / match_count * 100, 1) if match_count else 0
    distribution = {str(i): followers.get(str(i), 0) for i in range(10)}

    return {
        "last_3": last_3,
        "last_3_fechas": last_3_fechas,
        "recommended": recommended,
        "confidence": confidence,
        "match_count": match_count,
        "follower_distribution": distribution,
        "method": method,
    }


# ---------------------------------------------------------------------------
# Last-2-digits analysis
# ---------------------------------------------------------------------------

def _extract_endings(sorteos: list[dict], category: str | None = None) -> list[dict]:
    """Extract last-2-digit endings from all 3 prizes per draw."""
    results = []
    for s in sorteos:
        if category and s.get("cat") != category:
            continue
        for prize in ("primero", "segundo", "tercero"):
            p = s.get(prize, "")
            if p and len(p) >= 2:
                results.append({
                    "ending": p.zfill(4)[-2:],
                    "prize": prize,
                    "fecha": s.get("fecha", ""),
                })
    return results


def endings_frequency(endings: list[dict]) -> dict:
    """Full frequency of all 100 possible endings (00-99)."""
    counter = Counter(e["ending"] for e in endings)
    return {str(i).zfill(2): counter.get(str(i).zfill(2), 0) for i in range(100)}


def endings_by_prize(endings: list[dict], top: int = 15) -> dict:
    """Top endings per prize type."""
    by_prize = defaultdict(Counter)
    for e in endings:
        by_prize[e["prize"]][e["ending"]] += 1
    result = {}
    for prize, counter in by_prize.items():
        result[prize] = [{"ending": n, "count": c} for n, c in counter.most_common(top)]
    return result


def endings_hot_cold(endings: list[dict], top: int = 15) -> dict:
    counter = Counter(e["ending"] for e in endings)
    most = counter.most_common(top)
    least = counter.most_common()[:-top - 1:-1] if len(counter) >= top else list(reversed(counter.most_common()))
    return {
        "hot": [{"ending": n, "count": c} for n, c in most],
        "cold": [{"ending": n, "count": c} for n, c in least],
    }


def endings_recommendation(endings: list[dict], top: int = 10) -> list[dict]:
    """Recommend endings using recency-weighted frequency."""
    if not endings:
        return []

    counter: Counter = Counter()
    total = len(endings)
    for idx, e in enumerate(endings):
        weight = 1 + (total - idx) / total
        counter[e["ending"]] += weight

    # Normalize and score
    max_score = max(counter.values()) if counter else 1
    scored = []
    for ending, score in counter.most_common(top):
        confidence = min(round(score / max_score * 100, 1), 99.9)
        scored.append({"ending": ending, "score": round(score, 1), "confidence": confidence})
    return scored


def endings_trend(sorteos: list[dict], months: int = 12) -> list[dict]:
    """Monthly top-5 endings for trend visualization."""
    monthly: dict[str, Counter] = defaultdict(Counter)
    for s in sorteos:
        fecha = s.get("fecha", "")
        if len(fecha) >= 7:
            mk = fecha[:7]
            for prize in ("primero", "segundo", "tercero"):
                p = s.get(prize, "")
                if p and len(p) >= 2:
                    monthly[mk][p.zfill(4)[-2:]] += 1

    sorted_months = sorted(monthly.keys(), reverse=True)[:months]
    sorted_months.reverse()

    # Get global top 10 endings for consistent chart lines
    global_counter = Counter()
    for mc in monthly.values():
        global_counter += mc
    top_endings = [e for e, _ in global_counter.most_common(10)]

    result = []
    for m in sorted_months:
        freq = {e: monthly[m].get(e, 0) for e in top_endings}
        result.append({"month": m, "endings": freq})
    return result


def endings_stats(sorteos: list[dict]) -> dict:
    """Complete last-2-digits statistics."""
    endings = _extract_endings(sorteos)
    return {
        "total_endings": len(endings),
        "frequency": endings_frequency(endings),
        "by_prize": endings_by_prize(endings),
        "hot_cold": endings_hot_cold(endings),
        "recommendations": endings_recommendation(endings),
        "trends": endings_trend(sorteos, 24),
    }


# ---------------------------------------------------------------------------
# Other stats
# ---------------------------------------------------------------------------

def series_folio_stats(sorteos: list[dict]) -> dict:
    series = Counter(s.get("serie", "") for s in sorteos if s.get("serie"))
    folios = Counter(s.get("folio", "") for s in sorteos if s.get("folio"))
    return {
        "series": [{"value": v, "count": c} for v, c in series.most_common(10)],
        "folios": [{"value": v, "count": c} for v, c in folios.most_common(10)],
    }


def letra_stats(sorteos: list[dict]) -> list:
    counter = Counter(s.get("letra", "") for s in sorteos if s.get("letra"))
    return [{"letra": l, "count": c} for l, c in counter.most_common(15)]


def _prize_stats(sorteos: list[dict], prize: str) -> dict:
    numbers = _extract_numbers(sorteos, prize=prize)
    if not numbers:
        return {}
    recent_numbers = _extract_numbers(_filter_recent(sorteos), prize=prize)
    return {
        "digit_frequency": digit_frequency(numbers),
        "position_frequency": position_frequency(numbers),
        "last_digit_pairs": last_digit_pairs(numbers),
        "hot_cold": hot_cold(numbers),
        "recommendations": number_recommendation(recent_numbers or numbers),
    }


def monthly_recommendation(sorteos: list[dict]) -> dict:
    """Analyze historical patterns by calendar month to recommend numbers
    for the upcoming month.  Returns per-month digit/position profiles and
    specific number recommendations."""
    import datetime as _dt

    today = _dt.date.today()
    # Target = next month (or current if early in month)
    if today.day <= 10:
        target_month = today.month
    else:
        target_month = today.month % 12 + 1
    target_year = today.year + (1 if target_month == 1 and today.month == 12 else 0)

    MONTH_NAMES = {
        1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
        5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
        9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre",
    }

    # --- Collect numbers that appeared in each calendar month ---
    month_numbers: dict[int, list[str]] = defaultdict(list)  # month -> numbers
    month_draws: dict[int, int] = defaultdict(int)

    for s in sorteos:
        fecha = s.get("fecha", "")
        if len(fecha) < 7:
            continue
        try:
            m = int(fecha[5:7])
        except ValueError:
            continue
        month_draws[m] += 1
        for prize in ("primero", "segundo", "tercero"):
            p = s.get(prize, "")
            if p:
                month_numbers[m].append(p.zfill(4))

    # --- Per-month digit profiles (all 12 months) ---
    monthly_profiles = []
    for m in range(1, 13):
        nums = month_numbers.get(m, [])
        if not nums:
            monthly_profiles.append({
                "month": m, "name": MONTH_NAMES[m],
                "draws": 0, "numbers": 0,
                "position_freq": [], "hot": [], "top_endings": [],
            })
            continue

        # Position frequency for this month
        pos_freq = []
        for pos in range(4):
            counter = Counter()
            for n in nums:
                if pos < len(n):
                    counter[n[pos]] += 1
            total = sum(counter.values()) or 1
            pos_freq.append({
                str(d): round(counter.get(str(d), 0) / total * 100, 1)
                for d in range(10)
            })

        # Hot numbers this month
        num_counter = Counter(nums)
        hot = [{"number": n, "count": c} for n, c in num_counter.most_common(10)]

        # Top endings this month
        ending_counter = Counter(n[-2:] for n in nums)
        top_endings = [
            {"ending": e, "count": c}
            for e, c in ending_counter.most_common(10)
        ]

        monthly_profiles.append({
            "month": m, "name": MONTH_NAMES[m],
            "draws": month_draws.get(m, 0),
            "numbers": len(nums),
            "position_freq": pos_freq,
            "hot": hot,
            "top_endings": top_endings,
        })

    # --- Target month recommendation ---
    target_nums = month_numbers.get(target_month, [])
    target_reco = number_recommendation(target_nums, top=5) if target_nums else []

    # Compare target month vs overall: which digits are "hotter" in this month?
    all_nums = []
    for nums_list in month_numbers.values():
        all_nums.extend(nums_list)
    overall_pos = position_frequency(all_nums) if all_nums else [{} for _ in range(4)]
    target_pos = position_frequency(target_nums) if target_nums else [{} for _ in range(4)]

    # Digit advantage: how much more frequent each digit is in target month vs overall
    digit_advantage = []
    for pos in range(4):
        total_overall = sum(overall_pos[pos].values()) or 1
        total_target = sum(target_pos[pos].values()) or 1
        advantages = {}
        for d in range(10):
            ds = str(d)
            pct_overall = overall_pos[pos].get(ds, 0) / total_overall * 100
            pct_target = target_pos[pos].get(ds, 0) / total_target * 100
            advantages[ds] = round(pct_target - pct_overall, 1)
        digit_advantage.append(advantages)

    return {
        "target_month": target_month,
        "target_month_name": MONTH_NAMES[target_month],
        "target_year": target_year,
        "target_draws_historical": month_draws.get(target_month, 0),
        "target_numbers_historical": len(target_nums),
        "recommendations": target_reco,
        "digit_advantage": digit_advantage,
        "monthly_profiles": monthly_profiles,
    }


def trend_data(sorteos: list[dict], months: int = 12) -> list[dict]:
    monthly: dict[str, Counter] = defaultdict(Counter)
    monthly_total: dict[str, int] = defaultdict(int)

    for s in sorteos:
        fecha = s.get("fecha", "")
        if len(fecha) >= 7:
            month_key = fecha[:7]
            for prize in ("primero", "segundo", "tercero"):
                p = s.get(prize, "")
                if p:
                    for d in p.zfill(4):
                        monthly[month_key][d] += 1
            monthly_total[month_key] += 1

    sorted_months = sorted(monthly.keys(), reverse=True)[:months]
    sorted_months.reverse()

    result = []
    for m in sorted_months:
        freq = {str(i): monthly[m].get(str(i), 0) for i in range(10)}
        result.append({"month": m, "digits": freq, "sorteos": monthly_total[m]})
    return result


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/sorteos")
def api_sorteos():
    data = get_sorteos()

    return_all = request.args.get("all", "false").lower() == "true"
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)
    per_page = min(per_page, 10000 if return_all else 200)

    cat = request.args.get("cat", "").strip().lower()
    search = request.args.get("q", "").strip()
    date_from = request.args.get("from", "").strip()
    date_to = request.args.get("to", "").strip()

    filtered = data
    if cat:
        filtered = [s for s in filtered if s["cat"] == cat]
    if search:
        filtered = [s for s in filtered if search in s.get("primero", "")
                    or search in s.get("segundo", "") or search in s.get("tercero", "")]
    if date_from:
        filtered = [s for s in filtered if s["fecha"] >= date_from]
    if date_to:
        filtered = [s for s in filtered if s["fecha"] <= date_to]

    total = len(filtered)

    if not return_all:
        start = (page - 1) * per_page
        filtered = filtered[start:start + per_page]

    return jsonify({
        "data": filtered,
        "total": total,
        "page": page,
        "per_page": per_page,
        "last_update": get_last_update(),
    })


@app.route("/api/stats")
@limiter.limit("10 per minute")
def api_stats():
    cached = _cache_get("stats")
    if cached is not None:
        return jsonify(cached)
    log.info("Computing stats (cache miss)...")

    sorteos = get_sorteos()
    recent = _filter_recent(sorteos)

    # Train ML model if not yet trained
    if not predictor.trained:
        log.info("Training ML model (%d sorteos)...", len(recent))
        t0 = time.time()
        predictor.train(recent)
        log.info("ML training complete in %.1fs", time.time() - t0)

    prizes = {}
    for prize in ("primero", "segundo", "tercero"):
        prizes[prize] = _prize_stats(sorteos, prize)

    all_cats = sorted(set(s.get("cat", "") for s in sorteos if s.get("cat")))

    # --- ML batch prediction (single pass, avoids redundant feature computation) ---
    ml_batch = predictor.batch_predict(recent, categories=all_cats)
    ml_prizes = ml_batch.get("prize_reco", {})
    ml_general = ml_batch.get("general_reco", [])
    ml_endings = ml_batch.get("endings", [])
    ml_cat_reco = ml_batch.get("cat_reco", {})

    # Decena recommendations per category
    decena_reco = {}
    for cat_key in all_cats:
        reco = decena_recommendation(sorteos, cat_key)
        if reco:
            decena_reco[cat_key] = reco

    stats_by_cat = {}
    for cat_key in all_cats:
        cat_nums = _extract_numbers(sorteos, cat_key, prize="primero")
        recent_cat_nums = _extract_numbers(recent, cat_key, prize="primero")
        if cat_nums:
            stats_by_cat[cat_key] = {
                "total": len(cat_nums),
                "digit_frequency": digit_frequency(cat_nums),
                "hot_cold": hot_cold(cat_nums),
                "recommendations": number_recommendation(recent_cat_nums or cat_nums),
                "ml_recommendations": ml_cat_reco.get(cat_key, []),
            }

    numbers = _extract_numbers(sorteos, prize="primero")
    recent_numbers = _extract_numbers(recent, prize="primero")

    result = {
        "total_sorteos": len(sorteos),
        "reco_from": RECO_DATE_FROM,
        "reco_sorteos": len(recent),
        "last_update": get_last_update(),
        "digit_frequency": digit_frequency(numbers),
        "position_frequency": position_frequency(numbers),
        "last_digit_pairs": last_digit_pairs(numbers),
        "hot_cold": hot_cold(numbers),
        "recommendations": number_recommendation(recent_numbers),
        "ml_recommendations": ml_general,
        "ml_prizes": ml_prizes,
        "ml_endings": ml_endings,
        "ml_info": predictor.get_info(),
        "by_category": stats_by_cat,
        "series_folio": series_folio_stats(sorteos),
        "letras": letra_stats(sorteos),
        "prizes": prizes,
        "trends": trend_data(sorteos, 24),
        "endings": endings_stats(recent),
        "decena_recomendada": decena_reco,
        "monthly_reco": monthly_recommendation(recent),
    }

    _cache_set("stats", result)
    log.info("Stats computed and cached (%d sorteos, %d recent)", len(sorteos), len(recent))
    return jsonify(result)


@app.route("/api/gaps")
def api_gaps():
    """Gap analysis: draws since each number/ending last appeared."""
    cached = _cache_get("gaps")
    if cached is not None:
        return jsonify(cached)

    sorteos = get_sorteos()  # sorted desc (most recent first)

    # Track last appearance index for each number and ending
    number_last: dict[str, int] = {}  # number -> index (0 = most recent)
    ending_last: dict[str, int] = {}
    number_count: dict[str, int] = defaultdict(int)
    ending_count: dict[str, int] = defaultdict(int)

    for i, s in enumerate(sorteos):
        for prize in ("primero", "segundo", "tercero"):
            p = s.get(prize, "")
            if not p:
                continue
            n = p.zfill(4)
            e = n[-2:]
            if n not in number_last:
                number_last[n] = i
            if e not in ending_last:
                ending_last[e] = i
            number_count[n] += 1
            ending_count[e] += 1

    total = len(sorteos)

    # For numbers: compute gap, average gap, and ratio
    number_gaps = []
    for num, last_idx in number_last.items():
        count = number_count[num]
        if count < 2:
            continue
        avg_gap = round(total / count, 1)
        ratio = round(last_idx / avg_gap, 2) if avg_gap > 0 else 0
        number_gaps.append({
            "number": num,
            "gap": last_idx,
            "avg_gap": avg_gap,
            "ratio": ratio,  # >1 means "overdue"
            "count": count,
        })

    # Sort by ratio desc (most overdue first)
    number_gaps.sort(key=lambda x: x["ratio"], reverse=True)

    # Ending gaps
    ending_gaps = []
    for end, last_idx in ending_last.items():
        count = ending_count[end]
        avg_gap = round(total / count, 1)
        ratio = round(last_idx / avg_gap, 2) if avg_gap > 0 else 0
        ending_gaps.append({
            "ending": end,
            "gap": last_idx,
            "avg_gap": avg_gap,
            "ratio": ratio,
            "count": count,
        })
    ending_gaps.sort(key=lambda x: x["ratio"], reverse=True)

    # Top overdue (ratio > 1, high count)
    popular_overdue = [g for g in number_gaps if g["count"] >= 5 and g["ratio"] > 1][:30]
    popular_ontime = [g for g in number_gaps if g["count"] >= 5 and g["ratio"] <= 1]
    popular_ontime.sort(key=lambda x: x["ratio"])
    popular_ontime = popular_ontime[:20]

    result = {
        "total_sorteos": total,
        "overdue_numbers": popular_overdue,
        "ontime_numbers": popular_ontime,
        "overdue_endings": [e for e in ending_gaps if e["ratio"] > 1][:20],
        "ontime_endings": [e for e in ending_gaps if e["ratio"] <= 1][:20],
    }
    _cache_set("gaps", result)
    return jsonify(result)


@app.route("/api/comparar")
def api_comparar():
    """Compare multiple numbers side by side."""
    nums_raw = request.args.get("numeros", "").strip()
    if not nums_raw:
        return jsonify({"error": "Proporciona al menos un número"}), 400

    nums = [n.strip().zfill(4) for n in nums_raw.split(",") if n.strip().isdigit()]
    if not nums or len(nums) > 5:
        return jsonify({"error": "Proporciona entre 1 y 5 números válidos"}), 400

    sorteos = get_sorteos()
    total = len(sorteos)

    MONTH_NAMES = {
        1: "Ene", 2: "Feb", 3: "Mar", 4: "Abr", 5: "May", 6: "Jun",
        7: "Jul", 8: "Ago", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dic",
    }

    results = []
    for num in nums:
        exact = {"primero": 0, "segundo": 0, "tercero": 0}
        ending_match = 0
        last_date = None
        gap = None
        monthly = defaultdict(int)  # month_num -> count
        yearly = defaultdict(int)

        for i, s in enumerate(sorteos):
            matched = False
            for prize in ("primero", "segundo", "tercero"):
                p = s.get(prize, "").zfill(4)
                if p == num:
                    exact[prize] += 1
                    matched = True
                    if last_date is None:
                        last_date = s.get("fecha", "")
                        gap = i
                    f = s.get("fecha", "")
                    if len(f) >= 7:
                        try:
                            monthly[int(f[5:7])] += 1
                            yearly[f[:4]] += 1
                        except ValueError:
                            pass
                if p[-2:] == num[-2:]:
                    ending_match += 1

        total_exact = sum(exact.values())
        # Best month
        best_month = max(monthly, key=monthly.get) if monthly else None
        # Position frequency per digit
        pos_digits = [num[i] for i in range(4)]

        results.append({
            "number": num,
            "total_exact": total_exact,
            "exact": exact,
            "ending_matches": ending_match,
            "frequency_pct": round(total_exact / max(total, 1) * 100, 3),
            "last_appearance": last_date,
            "gap": gap,
            "best_month": MONTH_NAMES.get(best_month, "—") if best_month else "—",
            "best_month_count": monthly.get(best_month, 0) if best_month else 0,
            "monthly": {MONTH_NAMES.get(m, str(m)): c for m, c in sorted(monthly.items())},
            "digits": pos_digits,
        })

    return jsonify({"numbers": results, "total_sorteos": total})


@app.route("/api/simulador")
def api_simulador():
    """Simulate: how many times would a number have won historically?"""
    numero = request.args.get("numero", "").strip().zfill(4)
    date_from = request.args.get("from", "").strip()
    date_to = request.args.get("to", "").strip()
    cat = request.args.get("cat", "").strip().lower()

    if not numero or len(numero) != 4 or not numero.isdigit():
        return jsonify({"error": "Número inválido. Debe ser un número de 4 dígitos."}), 400

    sorteos = get_sorteos()

    filtered = sorteos
    if cat:
        filtered = [s for s in filtered if s.get("cat") == cat]
    if date_from:
        filtered = [s for s in filtered if s.get("fecha", "") >= date_from]
    if date_to:
        filtered = [s for s in filtered if s.get("fecha", "") <= date_to]

    total_sorteos = len(filtered)
    terminacion = numero[-2:]
    decena = numero[-2]  # tens digit

    # Exact matches
    exact_1 = [s for s in filtered if s.get("primero", "").zfill(4) == numero]
    exact_2 = [s for s in filtered if s.get("segundo", "").zfill(4) == numero]
    exact_3 = [s for s in filtered if s.get("tercero", "").zfill(4) == numero]

    # Ending matches (last 2 digits)
    ending_1 = [s for s in filtered if s.get("primero", "").zfill(4)[-2:] == terminacion]
    ending_2 = [s for s in filtered if s.get("segundo", "").zfill(4)[-2:] == terminacion]
    ending_3 = [s for s in filtered if s.get("tercero", "").zfill(4)[-2:] == terminacion]

    # Last appearance
    def last_appearance(matches):
        if not matches:
            return None
        return matches[0].get("fecha", "")  # sorteos are sorted desc

    # Monthly distribution of exact matches
    monthly = defaultdict(int)
    for s in exact_1 + exact_2 + exact_3:
        f = s.get("fecha", "")
        if len(f) >= 7:
            monthly[f[:7]] += 1

    # Category distribution of exact matches
    cat_dist = Counter()
    for s in exact_1 + exact_2 + exact_3:
        cat_dist[s.get("cat", "")] += 1

    # Gap analysis: how many draws since last exact appearance
    gap = None
    for i, s in enumerate(filtered):
        for prize in ("primero", "segundo", "tercero"):
            if s.get(prize, "").zfill(4) == numero:
                gap = i
                break
        if gap is not None:
            break

    total_exact = len(exact_1) + len(exact_2) + len(exact_3)
    total_ending = len(ending_1) + len(ending_2) + len(ending_3)

    def match_detail(matches, limit=10):
        return [{"fecha": s["fecha"], "cat": s.get("cat", ""), "tipo": s.get("tipo", "")}
                for s in matches[:limit]]

    result = {
        "numero": numero,
        "terminacion": terminacion,
        "total_sorteos": total_sorteos,
        "date_range": {"from": date_from or (filtered[-1]["fecha"] if filtered else ""),
                       "to": date_to or (filtered[0]["fecha"] if filtered else "")},
        "exact": {
            "total": total_exact,
            "primero": len(exact_1),
            "segundo": len(exact_2),
            "tercero": len(exact_3),
            "frequency_pct": round(total_exact / max(total_sorteos, 1) * 100, 3),
            "last_appearance": last_appearance(exact_1 + exact_2 + exact_3),
            "gap_draws": gap,
            "matches": match_detail(exact_1 + exact_2 + exact_3),
        },
        "ending": {
            "total": total_ending,
            "primero": len(ending_1),
            "segundo": len(ending_2),
            "tercero": len(ending_3),
            "frequency_pct": round(total_ending / max(total_sorteos, 1) * 100, 3),
        },
        "by_category": {k: v for k, v in cat_dist.most_common()},
        "monthly_distribution": dict(sorted(monthly.items())),
    }
    return jsonify(result)


@app.route("/api/actualizar", methods=["POST"])
@limiter.limit("2 per minute")
def api_actualizar():
    """Run the actualizar_db.py script to sync new draws from the API."""
    log.info("Data update requested")
    try:
        result = subprocess.run(
            [sys.executable, "actualizar_db.py"],
            capture_output=True, text=True, timeout=60,
        )
        _cache_clear()
        # Retrain ML model with new data
        try:
            predictor.update(_filter_recent(get_sorteos()))
        except Exception:
            pass
        return jsonify({
            "ok": result.returncode == 0,
            "output": result.stdout,
            "error": result.stderr if result.returncode != 0 else "",
            "last_update": get_last_update(),
        })
    except subprocess.TimeoutExpired:
        return jsonify({"ok": False, "error": "Timeout: la actualización tardó más de 60s"}), 504
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


# ---------------------------------------------------------------------------
# Backtesting
# ---------------------------------------------------------------------------


def statistical_backtest(sorteos: list[dict], last_n: int = 500) -> dict:
    """Backtest the statistical (frequency-weighted) method."""
    from collections import Counter as _Counter

    numbers = _extract_numbers(sorteos, prize="primero")
    if len(numbers) < 100:
        return {}

    eval_start = max(50, len(numbers) - last_n)
    n_eval = len(numbers) - eval_start

    row_top1 = 0.0
    row_top3 = 0.0
    pos_top1 = [0] * 4
    pos_top3 = [0] * 4
    pos_avg_p = [0.0] * 4

    for i in range(eval_start, len(numbers)):
        # Use numbers up to i as "training" window
        window = numbers[max(0, i - 200):i]
        total = len(window)
        if total < 20:
            continue

        for pos in range(4):
            counter = _Counter()
            for idx, n in enumerate(window):
                weight = 1 + (total - idx) / total
                if pos < len(n):
                    counter[n[pos]] += weight
            s = sum(counter.values()) or 1
            probs = {d: counter.get(d, 0) / s for d in "0123456789"}

            actual = numbers[i][pos] if pos < len(numbers[i]) else "0"
            sorted_digits = sorted(probs, key=probs.get, reverse=True)

            if sorted_digits[0] == actual:
                pos_top1[pos] += 1
            if actual in sorted_digits[:3]:
                pos_top3[pos] += 1
            pos_avg_p[pos] += probs.get(actual, 0.1)

    per_position = []
    for pos in range(4):
        t1 = pos_top1[pos] / n_eval * 100
        t3 = pos_top3[pos] / n_eval * 100
        per_position.append({
            "position": pos,
            "top1_accuracy": round(t1, 1),
            "top3_accuracy": round(t3, 1),
            "avg_prob_actual": round(pos_avg_p[pos] / n_eval * 100, 1),
            "random_baseline_top1": 10.0,
            "random_baseline_top3": 30.0,
            "lift_top1": round(t1 / 10.0, 2),
        })

    avg_t1 = round(sum(p["top1_accuracy"] for p in per_position) / 4, 1)
    avg_t3 = round(sum(p["top3_accuracy"] for p in per_position) / 4, 1)

    return {
        "total_evaluated": n_eval,
        "per_position": per_position,
        "avg_top1_accuracy": avg_t1,
        "avg_top3_accuracy": avg_t3,
        "avg_lift_top1": round(avg_t1 / 10.0, 2),
    }


@app.route("/api/backtesting")
@limiter.limit("5 per minute")
def api_backtesting():
    """Backtesting endpoint: compare ML and statistical accuracy."""
    last_n = request.args.get("last_n", 500, type=int)
    last_n = min(last_n, 2000)

    cache_key = f"backtesting_{last_n}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return jsonify(cached)

    recent = _filter_recent(get_sorteos())

    ml_results = predictor.backtest(recent, last_n) if predictor.trained else {}
    stat_results = statistical_backtest(recent, last_n)

    # Comparison summary
    ml_t1 = ml_results.get("avg_top1_accuracy", 10.0)
    st_t1 = stat_results.get("avg_top1_accuracy", 10.0)

    result = _json_safe({
        "ml": ml_results,
        "statistical": stat_results,
        "comparison": {
            "ml_lift": round(float(ml_t1) / 10.0, 2),
            "stat_lift": round(float(st_t1) / 10.0, 2),
            "ml_better": bool(ml_t1 > st_t1),
            "best_method": "ML" if ml_t1 > st_t1 else "Estadístico",
        },
    })
    _cache_set(cache_key, result)
    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
