"""
Cálculos estadísticos puros, recomendaciones, decenas, terminaciones, gaps,
comparador, simulador y backtest estadístico sobre sorteos en memoria.

Este módulo no depende de Flask ni de SQLAlchemy: todas sus funciones reciben
listas de sorteos (`list[dict]`) ya normalizados y devuelven estructuras nativas.
"""

import datetime as _dt
from math import comb
from collections import Counter, defaultdict

RECO_DATE_FROM = "1995-01-01"  # Recommendations use data from this date onwards

CAT_LABELS = {
    "dominical": "Dominical",
    "miercolito": "Miercolito",
    "gordito": "Gordito del Zodiaco",
    "extraordinario": "Extraordinario",
}   # one name per draw: variants are folded by loteria.categoria_canonica

MONTH_NAMES_FULL = {
    1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
    5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
    9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre",
}

MONTH_NAMES_SHORT = {
    1: "Ene", 2: "Feb", 3: "Mar", 4: "Abr", 5: "May", 6: "Jun",
    7: "Jul", 8: "Ago", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dic",
}


# ---------------------------------------------------------------------------
# Helpers & extractors
# ---------------------------------------------------------------------------

def _filter_recent(sorteos: list[dict]) -> list[dict]:
    """Filter sorteos from RECO_DATE_FROM onwards for recommendations."""
    return [s for s in sorteos if s.get("fecha", "") >= RECO_DATE_FROM]


def _extract_decena(primero: str) -> str | None:
    """Tens digit of the prize (second to last), valid for 4- and 5-digit numbers."""
    return primero[-2] if primero and len(primero) >= 2 else None


def _es_4_cifras(p: str) -> bool:
    """4-digit stats (positions, hot/cold, ML) only use real 4-digit prizes; endings use all formats."""
    return len(p or "") == 4


def _extract_numbers(sorteos: list[dict], category: str | None = None,
                     prize: str | None = "primero") -> list[str]:
    """4-digit prizes in draw order. `prize=None` takes 1st, 2nd and 3rd of each draw, in that order."""
    prizes = ("primero", "segundo", "tercero") if prize is None else (prize,)
    nums = []
    for s in sorteos:
        if category and s.get("cat") != category:
            continue
        for pr in prizes:
            p = s.get(pr, "")
            if _es_4_cifras(p):
                nums.append(p)
    return nums


# ---------------------------------------------------------------------------
# 4-digit frequencies & statistical recommendations
# ---------------------------------------------------------------------------

def digit_frequency(numbers: list[str]) -> dict:
    counter = Counter()
    for n in numbers:
        for d in n:
            counter[d] += 1
    return {str(i): counter.get(str(i), 0) for i in range(10)}


def position_frequency(numbers: list[str], width: int = 4) -> list[dict]:
    result = []
    for pos in range(width):
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
    """Top numbers by the exact probability of their 4 digits (recency-weighted frequency per position).

    Deterministic: no sampling. Ties go to numbers already drawn more often, then by number.
    `confidence` / `lift` = times more likely than pure chance (1.0 = chance), capped at 15 like the ML.
    """
    if not numbers:
        return []

    pos_scores: list[Counter] = [Counter() for _ in range(4)]
    total = len(numbers)
    for idx, n in enumerate(numbers):            # newest first: weight 2 → 1
        weight = 1 + (total - idx) / total
        for pos in range(min(4, len(n))):
            pos_scores[pos][n[pos]] += weight

    pos_probs = []
    for ps in pos_scores:
        s = sum(ps.values()) or 1
        pos_probs.append({d: ps[d] / s for d in ps})

    hist = Counter(numbers)
    candidatos = []
    for d0, p0 in pos_probs[0].items():
        for d1, p1 in pos_probs[1].items():
            for d2, p2 in pos_probs[2].items():
                for d3, p3 in pos_probs[3].items():
                    num = d0 + d1 + d2 + d3
                    # rounded so float noise does not hide a real tie
                    lift = round(p0 * p1 * p2 * p3 * 10_000, 9)
                    candidatos.append((-lift, -hist[num], num))

    candidatos.sort()
    return [{
        "number": num,
        "score": round(-neg_lift, 4),
        "lift": round(-neg_lift, 2),
        "confidence": min(round(-neg_lift, 2), 15.0),
        "veces": -neg_veces,
    } for neg_lift, neg_veces, num in candidatos[:top]]


# ---------------------------------------------------------------------------
# Decena recommendation (based on last 3 draws pattern matching)
# ---------------------------------------------------------------------------

DECENA_MIN_COINCIDENCIAS = 20     # below this, a pattern is too thin to report


def _decenas_premios(s: dict) -> list[str]:
    """Tens digit of every prize of a draw (any format with 2+ digits), 1st, 2nd and 3rd."""
    return [d for d in (_extract_decena(s.get(p) or "") for p in ("primero", "segundo", "tercero")) if d]


def _serie_decenas(sorteos: list[dict], category: str) -> list[dict]:
    """Category draws since RECO_DATE_FROM with a 1st-prize decena, oldest first."""
    return [s for s in reversed(sorteos) if s.get("cat") == category and s.get("primero")
            and s.get("fecha", "") >= RECO_DATE_FROM and _extract_decena(s["primero"]) is not None]


def _decena_desde(claves: list[str], siguientes: list[list[str]], fechas: list[str],
                  min_coincidencias: int) -> dict | None:
    """Core of decena_recommendation over chronological lists (claves = 1st-prize decenas)."""
    if len(claves) < 4:
        return None

    def seguidores(largo: int) -> tuple[Counter, int]:
        objetivo = tuple(claves[-largo:])
        c: Counter = Counter()
        n = 0
        for i in range(len(claves) - largo):
            if tuple(claves[i:i + largo]) == objetivo:
                c.update(siguientes[i + largo])
                n += 1
        return c, n

    followers, match_count = seguidores(3)
    method = "triple"
    if match_count < min_coincidencias:
        followers, match_count = seguidores(2)
        method = "pair"
    if match_count < min_coincidencias:
        followers = Counter(d for ds in siguientes for d in ds)
        match_count = len(claves)
        method = "frecuencia"

    muestras = sum(followers.values())
    if not muestras:
        return None
    recommended = min(followers, key=lambda d: (-followers[d], d))     # ties → smallest digit
    lift = followers[recommended] / muestras * 10                        # at most ×10 (always the same)
    return {
        "last_3": claves[-3:],
        "last_3_fechas": fechas[-3:],
        "recommended": recommended,
        "lift": round(lift, 2),
        "confidence": min(round(lift, 2), 15.0),
        "match_count": match_count,
        "muestras": muestras,
        "minimo": min_coincidencias,
        "follower_distribution": {str(i): followers.get(str(i), 0) for i in range(10)},
        "method": method,
    }


def decena_recommendation(sorteos: list[dict], category: str,
                          min_coincidencias: int = DECENA_MIN_COINCIDENCIAS) -> dict | None:
    """Recommend the next decena of a category (draws since RECO_DATE_FROM, newest first in input).

    Pattern = 1st-prize tens digit of the last 3 draws; what follows = tens digits of the 3 prizes of the
    next draw. With fewer than `min_coincidencias` matching draws it drops to the last 2 draws, then to
    the overall frequency. `confidence`/`lift` = times more likely than chance (10 %)."""
    serie = _serie_decenas(sorteos, category)
    return _decena_desde([_extract_decena(s["primero"]) for s in serie],
                         [_decenas_premios(s) for s in serie],
                         [s.get("fecha", "") for s in serie], min_coincidencias)


def decena_backtest(sorteos: list[dict], category: str, last_n: int = 200) -> dict | None:
    """Walk-forward check over the last `last_n` draws of the category: recommend with the older draws
    only; a hit is the decena appearing in any of the target's prizes. Chance per draw = distinct
    decenas of its prizes ÷ 10. None with fewer than `last_n` + 30 draws since RECO_DATE_FROM."""
    serie = _serie_decenas(sorteos, category)
    if len(serie) < last_n + 30:
        return None
    claves = [_extract_decena(s["primero"]) for s in serie]
    siguientes = [_decenas_premios(s) for s in serie]
    fechas = [s.get("fecha", "") for s in serie]
    n = len(serie)
    aciertos = 0
    azar = 0.0
    for j in range(n - last_n, n):                   # target = serie[j]; history = serie[:j]
        rec = _decena_desde(claves[:j], siguientes[:j], fechas[:j], DECENA_MIN_COINCIDENCIAS)
        reales = set(siguientes[j])
        aciertos += bool(rec) and rec["recommended"] in reales
        azar += len(reales) / 10
    return {
        "sorteos": last_n,
        "aciertos": aciertos,
        "acierto_pct": round(100 * aciertos / last_n, 1),
        "acierto_pct_azar": round(100 * azar / last_n, 1),
    }


# ---------------------------------------------------------------------------
# Last-2-digits analysis (endings 00-99)
# ---------------------------------------------------------------------------

def _extract_endings(sorteos: list[dict], category: str | None = None) -> list[dict]:
    """Extract last-2-digit endings from all 3 prizes per draw."""
    results = []
    for s in sorteos:
        if category and s.get("cat") != category:
            continue
        for prize in ("primero", "segundo", "tercero"):
            p = s.get(prize, "")
            if p:
                results.append({
                    "ending": p[-2:],
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


def _rank_endings(ends: list[str], top: int = 10) -> list[dict]:
    """Recency-weighted ranking of ending strings (newest first: weight 2 → 1)."""
    if not ends:
        return []
    counter: Counter = Counter()
    total = len(ends)
    for idx, e in enumerate(ends):
        counter[e] += 1 + (total - idx) / total
    peso_total = sum(counter.values())
    scored = []
    for ending, score in counter.most_common(top):
        # Times more likely than chance (an ending has a 1 % chance): share of the weight × 100.
        lift = score / peso_total * 100
        scored.append({"ending": ending, "score": round(score, 1), "lift": round(lift, 2),
                       "confidence": min(round(lift, 2), 15.0)})
    return scored


def endings_recommendation(endings: list[dict], top: int = 10) -> list[dict]:
    """Recommend endings using recency-weighted frequency. `confidence` = lift vs chance (1.0 = chance)."""
    return _rank_endings([e["ending"] for e in endings], top)


def endings_backtest(sorteos: list[dict], category: str, last_n: int = 200, top: int = 10) -> dict | None:
    """Walk-forward check of the statistical endings for one category (draws newest first).

    For each of the last `last_n` draws, recommend with the older draws only and count how many of its
    prize endings fall in the top. Returns hits and draws with at least one hit, each next to chance.
    None when the category has too few draws (fewer than `last_n` + 30)."""
    draws = [s for s in sorteos if s.get("cat") == category]
    if len(draws) < last_n + 30:
        return None
    por_sorteo = [[s[p][-2:] for p in ("primero", "segundo", "tercero") if s.get(p)] for s in draws]
    plano, inicio = [], []
    for e in por_sorteo:
        inicio.append(len(plano))
        plano.extend(e)
    aciertos = alguna = 0
    aciertos_azar = alguna_azar = 0.0
    for k in range(last_n):
        recomendadas = {r["ending"] for r in _rank_endings(plano[inicio[k + 1]:], top)}
        reales = {e for e in por_sorteo[k] if len(e) == 2}
        h = len(recomendadas & reales)
        aciertos += h
        alguna += h > 0
        aciertos_azar += top * len(reales) / 100
        alguna_azar += 1 - comb(100 - len(reales), top) / comb(100, top)
    return {
        "sorteos": last_n,
        "aciertos": aciertos,
        "aciertos_azar": round(aciertos_azar, 1),
        "alguna_pct": round(100 * alguna / last_n, 1),
        "alguna_pct_azar": round(100 * alguna_azar / last_n, 1),
    }


def endings_trend(sorteos: list[dict], months: int = 12) -> list[dict]:
    """Monthly top-5 endings for trend visualization."""
    monthly: dict[str, Counter] = defaultdict(Counter)
    for s in sorteos:
        fecha = s.get("fecha", "")
        if len(fecha) >= 7:
            mk = fecha[:7]
            for prize in ("primero", "segundo", "tercero"):
                p = s.get(prize, "")
                if p:
                    monthly[mk][p[-2:]] += 1

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
# Other stats (series/folio, letras, prize stats, formats, monthly, trends)
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


def formatos_stats(sorteos: list[dict]) -> dict:
    """Stats for prizes that are not 4-digit: "2" (gordito/zodiaco 2º-3º, miercolito 1962-66)
    and "5" (extraordinario). Kept apart so they don't skew the 4-digit stats."""
    result = {}
    for width in (2, 5):
        numbers, by_cat, by_prize, fechas = [], Counter(), Counter(), []
        for s in sorteos:
            for prize in ("primero", "segundo", "tercero"):
                p = s.get(prize, "")
                if len(p) == width:
                    numbers.append(p)
                    by_cat[s.get("cat", "")] += 1
                    by_prize[prize] += 1
                    fechas.append(s.get("fecha", ""))
        result[str(width)] = {
            "total": len(numbers),
            "by_category": dict(by_cat.most_common()),
            "by_prize": dict(by_prize),
            "date_range": {"from": min(fechas), "to": max(fechas)} if fechas else None,
            "digit_frequency": digit_frequency(numbers),
            "position_frequency": position_frequency(numbers, width),
            "hot_cold": hot_cold(numbers),
        }
    return result


def monthly_recommendation(sorteos: list[dict]) -> dict:
    """Analyze historical patterns by calendar month to recommend numbers
    for the upcoming month. Returns per-month digit/position profiles and
    specific number recommendations."""
    today = _dt.date.today()
    # Target = next month (or current if early in month)
    if today.day <= 10:
        target_month = today.month
    else:
        target_month = today.month % 12 + 1
    target_year = today.year + (1 if target_month == 1 and today.month == 12 else 0)

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
            if _es_4_cifras(p):
                month_numbers[m].append(p)

    # --- Per-month digit profiles (all 12 months) ---
    monthly_profiles = []
    for m in range(1, 13):
        nums = month_numbers.get(m, [])
        if not nums:
            monthly_profiles.append({
                "month": m, "name": MONTH_NAMES_FULL[m],
                "draws": 0, "numbers": 0,
                "position_freq": [], "hot": [], "top_endings": [],
            })
            continue

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

        num_counter = Counter(nums)
        hot = [{"number": n, "count": c} for n, c in num_counter.most_common(10)]

        ending_counter = Counter(n[-2:] for n in nums)
        top_endings = [
            {"ending": e, "count": c}
            for e, c in ending_counter.most_common(10)
        ]

        monthly_profiles.append({
            "month": m, "name": MONTH_NAMES_FULL[m],
            "draws": month_draws.get(m, 0),
            "numbers": len(nums),
            "position_freq": pos_freq,
            "hot": hot,
            "top_endings": top_endings,
        })

    # --- Target month recommendation ---
    target_nums = month_numbers.get(target_month, [])
    target_reco = number_recommendation(target_nums, top=5) if target_nums else []

    all_nums = []
    for nums_list in month_numbers.values():
        all_nums.extend(nums_list)
    overall_pos = position_frequency(all_nums) if all_nums else [{} for _ in range(4)]
    target_pos = position_frequency(target_nums) if target_nums else [{} for _ in range(4)]

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
        "target_month_name": MONTH_NAMES_FULL[target_month],
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
                if _es_4_cifras(p):
                    for d in p:
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
# Gaps, Comparador, Simulador & Backtesting
# ---------------------------------------------------------------------------

def calcular_gaps(sorteos: list[dict]) -> dict:
    """Gap analysis: draws since each 4-digit number and 2-digit ending last appeared."""
    number_last: dict[str, int] = {}
    ending_last: dict[str, int] = {}
    number_count: dict[str, int] = defaultdict(int)
    ending_count: dict[str, int] = defaultdict(int)

    for i, s in enumerate(sorteos):
        for prize in ("primero", "segundo", "tercero"):
            p = s.get(prize, "")
            if not p:
                continue
            e = p[-2:]
            if e not in ending_last:
                ending_last[e] = i
            ending_count[e] += 1
            if _es_4_cifras(p):
                if p not in number_last:
                    number_last[p] = i
                number_count[p] += 1

    total = len(sorteos)

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
            "ratio": ratio,
            "count": count,
        })
    number_gaps.sort(key=lambda x: x["ratio"], reverse=True)

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

    popular_overdue = [g for g in number_gaps if g["count"] >= 5 and g["ratio"] > 1][:30]
    popular_ontime = [g for g in number_gaps if g["count"] >= 5 and g["ratio"] <= 1]
    popular_ontime.sort(key=lambda x: x["ratio"])
    popular_ontime = popular_ontime[:20]

    return {
        "total_sorteos": total,
        "overdue_numbers": popular_overdue,
        "ontime_numbers": popular_ontime,
        "overdue_endings": [e for e in ending_gaps if e["ratio"] > 1][:20],
        "ontime_endings": [e for e in ending_gaps if e["ratio"] <= 1][:20],
    }


def comparar_numeros(sorteos: list[dict], nums: list[str]) -> dict:
    """Compare multiple 4-digit numbers side by side across all draws."""
    total = len(sorteos)
    results = []
    for num in nums:
        exact = {"primero": 0, "segundo": 0, "tercero": 0}
        ending_match = 0
        last_date = None
        gap = None
        monthly: dict[int, int] = defaultdict(int)
        yearly: dict[str, int] = defaultdict(int)

        for i, s in enumerate(sorteos):
            for prize in ("primero", "segundo", "tercero"):
                p = s.get(prize, "")
                if not p:
                    continue
                if p == num:
                    exact[prize] += 1
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
        best_month = max(monthly, key=monthly.get) if monthly else None
        pos_digits = [num[i] for i in range(4)]

        results.append({
            "number": num,
            "total_exact": total_exact,
            "exact": exact,
            "ending_matches": ending_match,
            "frequency_pct": round(total_exact / max(total, 1) * 100, 3),
            "last_appearance": last_date,
            "gap": gap,
            "best_month": MONTH_NAMES_SHORT.get(best_month, "—") if best_month else "—",
            "best_month_count": monthly.get(best_month, 0) if best_month else 0,
            "monthly": {MONTH_NAMES_SHORT.get(m, str(m)): c for m, c in sorted(monthly.items())},
            "digits": pos_digits,
        })

    return {"numbers": results, "total_sorteos": total}


def simular_numero(sorteos: list[dict], numero: str, date_from: str = "",
                   date_to: str = "", cat: str = "") -> dict:
    """Simulate: how many times would a 4-digit number have won historically?"""
    filtered = sorteos
    if cat:
        filtered = [s for s in filtered if s.get("cat") == cat]
    if date_from:
        filtered = [s for s in filtered if s.get("fecha", "") >= date_from]
    if date_to:
        filtered = [s for s in filtered if s.get("fecha", "") <= date_to]

    total_sorteos = len(filtered)
    terminacion = numero[-2:]

    exact_1 = [s for s in filtered if s.get("primero") == numero]
    exact_2 = [s for s in filtered if s.get("segundo") == numero]
    exact_3 = [s for s in filtered if s.get("tercero") == numero]

    ending_1 = [s for s in filtered if s.get("primero", "")[-2:] == terminacion]
    ending_2 = [s for s in filtered if s.get("segundo", "")[-2:] == terminacion]
    ending_3 = [s for s in filtered if s.get("tercero", "")[-2:] == terminacion]

    def last_appearance(matches):
        if not matches:
            return None
        return matches[0].get("fecha", "")

    monthly: dict[str, int] = defaultdict(int)
    for s in exact_1 + exact_2 + exact_3:
        f = s.get("fecha", "")
        if len(f) >= 7:
            monthly[f[:7]] += 1

    cat_dist: Counter = Counter()
    for s in exact_1 + exact_2 + exact_3:
        cat_dist[s.get("cat", "")] += 1

    gap = None
    for i, s in enumerate(filtered):
        for prize in ("primero", "segundo", "tercero"):
            if s.get(prize) == numero:
                gap = i
                break
        if gap is not None:
            break

    total_exact = len(exact_1) + len(exact_2) + len(exact_3)
    total_ending = len(ending_1) + len(ending_2) + len(ending_3)

    def match_detail(matches, limit=10):
        return [{"fecha": s["fecha"], "cat": s.get("cat", ""), "tipo": s.get("tipo", "")}
                for s in matches[:limit]]

    return {
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


def statistical_backtest(sorteos: list[dict], last_n: int = 500) -> dict:
    """Backtest the statistical (frequency-weighted) method."""
    numbers = _extract_numbers(sorteos, prize="primero")
    if len(numbers) < 100:
        return {}

    eval_start = max(50, len(numbers) - last_n)
    n_eval = len(numbers) - eval_start

    pos_top1 = [0] * 4
    pos_top3 = [0] * 4
    pos_avg_p = [0.0] * 4

    for i in range(eval_start, len(numbers)):
        window = numbers[max(0, i - 200):i]
        total = len(window)
        if total < 20:
            continue

        for pos in range(4):
            counter = Counter()
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


def construir_stats(sorteos: list[dict], recent: list[dict], ml_batch: dict,
                    ml_info: dict, last_update: str) -> dict:
    """Build the complete `/api/stats` response payload from draws and ML batch output."""
    prizes = {prize: _prize_stats(sorteos, prize) for prize in ("primero", "segundo", "tercero")}
    all_cats = sorted(set(s.get("cat", "") for s in sorteos if s.get("cat")))

    ml_prizes = ml_batch.get("prize_reco", {})
    ml_general = ml_batch.get("general_reco", [])
    ml_endings = ml_batch.get("endings", [])
    ml_cat_reco = ml_batch.get("cat_reco", {})
    ml_cat_endings = ml_batch.get("cat_endings", {})

    # Per-category endings: the ones Seguimiento freezes, with their walk-forward check vs chance.
    endings_by_cat = {}
    for cat_key in all_cats:
        cat_endings = _extract_endings(recent, cat_key)
        if cat_endings:
            endings_by_cat[cat_key] = {
                "total_endings": len(cat_endings),
                "recommendations": endings_recommendation(cat_endings),
                "ml_recommendations": ml_cat_endings.get(cat_key, []),
                "backtest": endings_backtest(recent, cat_key),
            }

    decena_reco = {}
    for cat_key in all_cats:
        reco = decena_recommendation(recent, cat_key)
        if reco:
            reco["backtest"] = decena_backtest(recent, cat_key)
            decena_reco[cat_key] = reco

    stats_by_cat = {}
    for cat_key in all_cats:
        cat_nums = _extract_numbers(sorteos, cat_key, prize="primero")
        # Recommendations use every 4-digit prize: the three are drawn alike, and Seguimiento
        # scores them against all three.
        reco_nums = (_extract_numbers(recent, cat_key, prize=None)
                     or _extract_numbers(sorteos, cat_key, prize=None))
        if cat_nums:
            stats_by_cat[cat_key] = {
                "total": len(cat_nums),
                "digit_frequency": digit_frequency(cat_nums),
                "hot_cold": hot_cold(cat_nums),
                "recommendations": number_recommendation(reco_nums),
                "ml_recommendations": ml_cat_reco.get(cat_key, []),
            }

    numbers = _extract_numbers(sorteos, prize="primero")
    recent_numbers = _extract_numbers(recent, prize="primero")

    return {
        "total_sorteos": len(sorteos),
        "reco_from": RECO_DATE_FROM,
        "reco_sorteos": len(recent),
        "last_update": last_update,
        "digit_frequency": digit_frequency(numbers),
        "position_frequency": position_frequency(numbers),
        "last_digit_pairs": last_digit_pairs(numbers),
        "hot_cold": hot_cold(numbers),
        "recommendations": number_recommendation(recent_numbers),
        "ml_recommendations": ml_general,
        "ml_prizes": ml_prizes,
        "ml_endings": ml_endings,
        "ml_info": ml_info,
        "by_category": stats_by_cat,
        "endings_by_category": endings_by_cat,
        "series_folio": series_folio_stats(sorteos),
        "letras": letra_stats(sorteos),
        "prizes": prizes,
        "trends": trend_data(sorteos, 24),
        "endings": endings_stats(recent),
        "formatos": formatos_stats(sorteos),
        "decena_recomendada": decena_reco,
        "monthly_reco": monthly_recommendation(recent),
    }
