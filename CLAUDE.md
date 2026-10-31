# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lotería de Panamá — a full-stack web app for analyzing and predicting Panama lottery results. Flask REST API backend with MariaDB, scikit-learn ML models, and a vanilla JS frontend with Chart.js visualizations.

## Development Commands

```bash
# Setup
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements-dev.txt   # app deps + pytest + pip-audit

# Tests / security audit
pytest
pip-audit -r requirements.txt

# Run dev server (port 5000)
python app.py

# Sync new lottery draws from external API
python actualizar_db.py
```

**Preview server** is configured in `.claude/launch.json` — use preview_start with name `sorteos`.

**Environment**: Copy `.env.example` to `.env` and set `DATABASE_URL`, `LOTERIA_API_USER`, `LOTERIA_API_PASSWORD`. All are required (no hardcoded defaults); `base.require_env()` raises a clear error if one is missing. Optional `FLASK_DEBUG=1` enables Flask debug mode for local dev (off by default; parsed by `base.env_flag()`).

## Architecture

### Data Flow

```
External API (loteriapanama.net) → actualizar_db.py → MariaDB
                                                         ↓
                        Frontend (app.js) ← JSON ← Flask API (app.py)
                                                         ↑
                                              ml_model.py (predictions)
```

### Backend (app.py ~700 lines)

Single Flask file with all routes and statistics logic:
- **`GET /api/sorteos`** — Paginated draw results with filters (category, search, date range)
- **`GET /api/stats`** — Comprehensive statistics: digit frequencies, hot/cold numbers, ML predictions, endings analysis, decena recommendations, trends. Expensive (~seconds), cached 5 minutes.
- **`GET /api/backtesting?last_n=500`** — ML vs Statistical accuracy comparison over historical draws
- **`POST /api/actualizar`** — Syncs new draws, clears cache, retrains ML model. Requires header `X-Update-Token` = `ACTUALIZAR_TOKEN` (.env); 401 on mismatch, 503 if unset; 502 if the sync script fails, 500 on unexpected errors (details only in the server log, never in the response). Response includes `ml_retrained`. Frontend prompts for the token and keeps it in `sessionStorage`.

Key patterns:
- **Cache layer**: `_cache_get`/`_cache_set` with 5-minute TTL on `sorteos`, `stats`, `backtesting_{n}` keys
- **`_filter_recent()`**: Filters data from `RECO_DATE_FROM = "1995-01-01"` onwards for recommendations (not all 9000+ draws back to 1919)
- **`_json_safe()`**: Recursively converts numpy types for JSON serialization

### ML Model (ml_model.py)

Ensemble of **4 HistGradientBoostingClassifier** models, one per digit position (0-3) of the 4-digit lottery number.

- **Features** (~200+): rolling digit frequencies (windows 10/25/50), gap analysis, lag features, temporal features, ending frequencies, category encoding
- **Training**: `predictor.train(sorteos)` — fits all 4 classifiers, saves to `models/predictor.joblib`
- **Prediction**: Averages probabilities over last 20 draws, applies temperature smoothing (1.5), then Monte Carlo samples 50K numbers. Confidence capped at 15%.
- **Backtesting**: `predictor.backtest(sorteos, last_n)` — batch `predict_proba` evaluation with per-position Top-1/Top-3 accuracy metrics
- Singleton instance `predictor` is loaded at import time from joblib cache

⚠️ First `/api/stats` call triggers ML training if model not cached (~50-100s). Subsequent calls use cached model (<1s).

### Database (base.py + loteria.py)

SQLAlchemy ORM on MariaDB. Single table `sorteos` with columns: `id`, `tipo` (category), `fecha` (date), `primero`/`segundo`/`tercero` (prize strings), `letras`, `serie`, `folio`.

The DB keeps prizes **as published by the source — do not pad them in the DB**. Formats vary: gordito since 1996 has 2-digit `segundo`/`tercero`; miercolito 1962–1966 has 2-digit prizes; extraordinario has 5-digit prizes; 57 gordito 1991–1995 and 2 extraordinario 1940 have empty `segundo`/`tercero`. `get_sorteos()` (via `_row_to_dict` → `loteria.premio_en_formato`) returns each prize padded to its **real format** (`"98"`, `"0074"`, `"05309"`; empty stays `""`), so `len(premio)` tells the format. The rule lives in `loteria.formato_premio`; short values outside the known 2-digit formats are 4-digit numbers that lost their zeros. Two draws can share fecha+categoría (1973-02-07 miercolito, 2002-12-29 dominical are both real per the API).

### Frontend (static/app.js + static/style.css + templates/index.html)

Single-page app with vanilla JS. State variables:
- `allSorteos` — full draw array
- `stats` — computed statistics object from `/api/stats`
- `useML` — toggle between ML and Statistical prediction modes
- `currentPrize` — selected prize tier (primero/segundo/tercero)

**Theming**: CSS variables with `[data-theme="light"]` overrides, persisted in localStorage. Use `isLight()` helper and `chartOpts()` for theme-aware Chart.js config.

**Accessibility**: ARIA roles on all interactive elements, keyboard navigation (Arrow keys in tablists), skip-link, `focus-visible` styles.

**Sections** are tab-navigated: Predicciones, Decenas, Terminaciones, Resultados, Estadísticas, Tendencias, Análisis, Precisión.

## Key Conventions

- **Categories**: `dominical`, `miercolito`, `gordito`, `extraordinario`, `extraordinaria`, `zodiaco`, `extraordonario` (note the typo in source data — `extraordonario` is intentional to match the API)
- **Date format**: ISO 8601 (`YYYY-MM-DD`) throughout
- **Prize numbers**: never `.zfill(4)` a prize from `get_sorteos()` — it is already in its real format. 4-digit stats (positions, hot/cold, recommendations, trends, gaps, ML training) use only `len == 4` prizes (`_es_4_cifras`); endings (`p[-2:]`) and decenas (`p[-2]`) use every format. Non-4-digit prizes get their own stats in `/api/stats` → `formatos` ("Premios de Otros Formatos" panel in Estadísticas). The frontend shows prizes as received (no `padStart`).
- Each draw produces up to 3 rows in ML training data (one per 4-digit prize)
- Statistical recommendations use 50K Monte Carlo samples with recency-weighted digit frequencies
- The `decena_recommendation()` function uses a 3-sorteo pattern matching approach with 2-sorteo and frequency fallbacks
