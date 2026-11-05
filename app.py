"""
Lotería de Panamá - Aplicación Web
Backend Flask con datos desde MariaDB, caché y rutas HTTP.
Los cálculos estadísticos puros viven en `estadisticas.py`.
"""

import hmac
import logging
import os
import subprocess
import sys
import time

from flask import Flask, jsonify, render_template, request
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from sqlalchemy import desc, func

from base import Session, engine, Base, env_flag
from estadisticas import (
    CAT_LABELS, RECO_DATE_FROM, _es_4_cifras, _extract_decena, _extract_endings,
    _extract_numbers, _filter_recent, _prize_stats, calcular_gaps, comparar_numeros,
    construir_stats, decena_recommendation, digit_frequency, endings_by_prize, endings_frequency,
    endings_hot_cold, endings_recommendation, endings_stats, endings_trend,
    formatos_stats, hot_cold, last_digit_pairs, letra_stats, monthly_recommendation,
    number_recommendation, position_frequency, series_folio_stats, simular_numero,
    statistical_backtest, trend_data,
)
from loteria import Loteria, categoria_canonica, premio_en_formato
from ml_model import predictor
import seguimiento

SeguimientoSession = Session  # replaced in tests

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


def _row_to_dict(r) -> dict:
    """DB row → API dict. Prizes keep their real format: "98" (2 digits), "0074" (4), "05309" (5),
    or "" when the draw has no such prize. Use len(premio) to tell formats apart."""
    cat = categoria_canonica(r.tipo)
    return {
        "id": str(r.id),
        "fecha": r.fecha.isoformat() if r.fecha else "",
        "cat": cat,
        "primero": premio_en_formato(cat, r.fecha, "primero", r.primero),
        "segundo": premio_en_formato(cat, r.fecha, "segundo", r.segundo),
        "tercero": premio_en_formato(cat, r.fecha, "tercero", r.tercero),
        "letra": r.letras or "",
        "serie": r.serie or "",
        "folio": r.folio or "",
    }


def get_sorteos() -> list[dict]:
    cached = _cache_get("sorteos")
    if cached is not None:
        return cached

    session = Session()
    try:
        rows = session.query(Loteria).order_by(desc(Loteria.fecha)).all()
        data = [_row_to_dict(r) for r in rows]
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

    cat = categoria_canonica(request.args.get("cat"))       # ?cat=zodiaco → gordito
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
    result, _ = _calcular_stats()
    return jsonify(result)


def _calcular_stats() -> tuple[dict, list[str]]:
    """Compute and cache /api/stats, freezing Seguimiento records on the way.

    Returns the stats and the categories whose recommendations were frozen now."""
    sorteos = get_sorteos()
    recent = _filter_recent(sorteos)

    # Train ML model if not yet trained
    if not predictor.trained:
        log.info("Training ML model (%d sorteos)...", len(recent))
        t0 = time.time()
        predictor.train(recent)
        log.info("ML training complete in %.1fs", time.time() - t0)

    all_cats = sorted(set(s.get("cat", "") for s in sorteos if s.get("cat")))
    ml_batch = predictor.batch_predict(recent, categories=all_cats)
    result = construir_stats(sorteos, recent, ml_batch, predictor.get_info(), get_last_update())

    # Freeze recommendations for each category's next draw (never breaks stats)
    hechos = _registrar_seguro(
        sorteos,
        _recos_por_categoria(
            recent,
            result["by_category"],
            ml_batch.get("cat_reco", {}),
            ml_batch.get("cat_endings", {}),
        ),
    )

    _cache_set("stats", result)
    log.info("Stats computed and cached (%d sorteos, %d recent)", len(sorteos), len(recent))
    return result, hechos


def _recos_por_categoria(recent: list[dict], stats_by_cat: dict, ml_cat_reco: dict,
                         ml_cat_endings: dict) -> dict:
    """Top-5 numbers and 10 endings per category and method, as frozen by `seguimiento`."""
    recos = {}
    for cat, st in stats_by_cat.items():
        est_nums = [r["number"] for r in st.get("recommendations", [])][:seguimiento.N_NUMEROS]
        if not est_nums:
            continue
        est_ends = [e["ending"] for e in endings_recommendation(
            _extract_endings(recent, cat), top=seguimiento.N_TERMINACIONES)]
        ml_nums = [r["number"] for r in ml_cat_reco.get(cat, [])][:seguimiento.N_NUMEROS]
        ml_ends = [e["ending"] for e in ml_cat_endings.get(cat, [])][:seguimiento.N_TERMINACIONES]
        recos[cat] = {
            "estadistico": {"numeros": est_nums, "terminaciones": est_ends},
            "ml": {"numeros": ml_nums, "terminaciones": ml_ends} if ml_nums else None,
        }
    return recos


def _registrar_seguro(sorteos: list[dict], recos: dict) -> list[str]:
    """Freeze recommendations; any failure is logged and ignored (stats must still answer)."""
    session = SeguimientoSession()
    try:
        hechos = seguimiento.registrar(session, sorteos, recos)
        if hechos:
            log.info("Seguimiento: registradas recomendaciones para %s", ", ".join(hechos))
        return hechos
    except Exception:
        session.rollback()
        log.exception("Seguimiento: no se pudieron registrar las recomendaciones")
        return []
    finally:
        session.close()


@app.route("/api/seguimiento")
def api_seguimiento():
    """Frozen recommendations vs real results, scoreboard against chance, current ML weight."""
    session = SeguimientoSession()
    try:
        return jsonify(_json_safe(seguimiento.resumen(session, get_sorteos())))
    except Exception:
        log.exception("Seguimiento: error al construir el resumen")
        return jsonify({"error": "No se pudo cargar el seguimiento"}), 500
    finally:
        session.close()


@app.route("/api/gaps")
def api_gaps():
    """Gap analysis: draws since each number/ending last appeared."""
    cached = _cache_get("gaps")
    if cached is not None:
        return jsonify(cached)

    result = calcular_gaps(get_sorteos())
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

    return jsonify(comparar_numeros(get_sorteos(), nums))


@app.route("/api/simulador")
def api_simulador():
    """Simulate: how many times would a number have won historically?"""
    numero = request.args.get("numero", "").strip().zfill(4)
    date_from = request.args.get("from", "").strip()
    date_to = request.args.get("to", "").strip()
    cat = categoria_canonica(request.args.get("cat"))       # ?cat=zodiaco → gordito

    if not numero or len(numero) != 4 or not numero.isdigit():
        return jsonify({"error": "Número inválido. Debe ser un número de 4 dígitos."}), 400

    return jsonify(simular_numero(get_sorteos(), numero, date_from=date_from, date_to=date_to, cat=cat))


@app.route("/api/actualizar", methods=["POST"])
@limiter.limit("2 per minute")
def api_actualizar():
    """Run the actualizar_db.py script to sync new draws from the API.

    Requires header X-Update-Token matching ACTUALIZAR_TOKEN from .env.
    If ACTUALIZAR_TOKEN is not configured, the endpoint is disabled.
    """
    expected = os.getenv("ACTUALIZAR_TOKEN", "")
    if not expected:
        log.warning("Data update rejected: ACTUALIZAR_TOKEN not configured")
        return jsonify({"ok": False, "error": "Actualización deshabilitada: falta ACTUALIZAR_TOKEN en .env"}), 503
    given = request.headers.get("X-Update-Token", "")
    if not hmac.compare_digest(given.encode(), expected.encode()):
        log.warning("Data update rejected: invalid token from %s", get_remote_address())
        return jsonify({"ok": False, "error": "Token inválido", "auth_required": True}), 401
    log.info("Data update requested")
    # Error details (stderr, exception text) go to the server log only: they can contain
    # tracebacks and server paths that must not reach the browser.
    try:
        result = subprocess.run(
            # The script must not freeze Seguimiento itself: done here once, after retraining.
            [sys.executable, "actualizar_db.py", "--sin-seguimiento"],
            capture_output=True, text=True, timeout=60,
        )
    except subprocess.TimeoutExpired:
        log.error("Data update timed out after 60s")
        return jsonify({"ok": False, "error": "Timeout: la actualización tardó más de 60s"}), 504
    except Exception:
        log.exception("Data update could not start")
        return jsonify({"ok": False, "error": "Error interno al lanzar la actualización. Revisa el log del servidor."}), 500

    if result.returncode != 0:
        log.error("actualizar_db.py failed (exit %s):\n%s", result.returncode, result.stderr)
        return jsonify({
            "ok": False,
            "error": "La sincronización con la API de la lotería falló. Revisa el log del servidor.",
        }), 502

    _cache_clear()
    ml_retrained = True
    try:
        predictor.update(_filter_recent(get_sorteos()))
    except Exception:
        ml_retrained = False
        log.exception("ML retrain after data update failed")

    # Freeze recommendations for the next draws now, not on the next visit (also warms the cache).
    # Not with an untrained model: training would run here again, inside the request (50-100 s).
    seguimiento_registrado = []
    if not predictor.trained:
        log.warning("Seguimiento: ML model not trained after update; registration left for the next visit")
    else:
        try:
            _, seguimiento_registrado = _calcular_stats()
        except Exception:
            log.exception("Seguimiento: stats after data update failed; nothing frozen")

    return jsonify({
        "ok": True,
        "output": result.stdout,
        "ml_retrained": ml_retrained,
        "seguimiento_registrado": seguimiento_registrado,
        "last_update": get_last_update(),
    })


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
    # Debug only when FLASK_DEBUG is set in .env: Werkzeug's debugger allows code execution.
    app.run(debug=env_flag("FLASK_DEBUG"), port=5000)
