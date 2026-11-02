---
type: plan
title: Plan — Modularizar el backend
description: HOW de la spec modularizar-backend — extracción de estadisticas.py, adelgazamiento de app.py, reexportación compatible y pruebas.
tags: [sdd, plan]
timestamp: 2026-11-02T11:05:00Z
topic: sdd
slug: modularizar-backend
status: implemented (autopilot)
---

# Plan — Modularizar el backend

Spec: [modularizar-backend](../specs/modularizar-backend.md) · Constitution: [v1.0.0](../constitution.md)

## Arquitectura
- **Módulo nuevo `estadisticas.py` (dominio puro, sin Flask ni SQLAlchemy):**
  - Constantes: `RECO_DATE_FROM`, `CAT_LABELS`, `MONTH_NAMES_FULL`, `MONTH_NAMES_SHORT`.
  - Filtros y extractores: `_filter_recent`, `_extract_decena`, `_es_4_cifras`, `_extract_numbers`, `_extract_endings`.
  - Estadística de 4 cifras y recomendaciones: `digit_frequency`, `position_frequency`, `last_digit_pairs`, `hot_cold`, `number_recommendation`, `_prize_stats`.
  - Decenas: `decena_recommendation`.
  - Terminaciones (00–99): `endings_frequency`, `endings_by_prize`, `endings_hot_cold`, `endings_recommendation`, `endings_trend`, `endings_stats`.
  - Otros formatos y atributos: `series_folio_stats`, `letra_stats`, `formatos_stats`.
  - Mensual y tendencias: `monthly_recommendation`, `trend_data`.
  - Cálculos extraídos de rutas:
    - `calcular_gaps(sorteos: list[dict]) -> dict` (usada por `GET /api/gaps`).
    - `comparar_numeros(sorteos: list[dict], nums: list[str]) -> dict` (usada por `GET /api/comparar`).
    - `simular_numero(sorteos: list[dict], numero: str, date_from: str = "", date_to: str = "", cat: str = "") -> dict` (usada por `GET /api/simulador`).
  - Backtesting: `statistical_backtest(sorteos: list[dict], last_n: int = 500) -> dict`.
- **`app.py` (< 450 líneas, solo capa web, caché y acceso a BD):**
  - Conserva `app`, `limiter`, `_json_safe`, `log_request`, caché (`_cache_get`, `_cache_set`, `_cache_clear`), acceso a BD (`_row_to_dict`, `get_sorteos`, `get_last_update`), integración de seguimiento (`_recos_por_categoria`, `_registrar_seguro`) y las rutas HTTP.
  - Importa y reexporta las funciones y constantes de `estadisticas.py` para que `tests/test_stats.py`, `tests/test_datos_premios.py` y `tests/test_formatos_premios.py` sigan funcionando sin tocar una sola línea.
  - Las rutas `/api/gaps`, `/api/comparar` y `/api/simulador` validan parámetros / caché y delegan el cálculo a `calcular_gaps`, `comparar_numeros` y `simular_numero`.

## Análisis de consistencia (analyze gate)
- **Constitución v1.0.0 Principio 7 (formatos de premios):** `_es_4_cifras`, `_extract_numbers`, `_extract_endings` y `formatos_stats` se mueven intactos sin alterar ninguna regla de 2, 4 o 5 cifras.
- **Constitución v1.0.0 Principio 8 (errores y JSON):** `_json_safe()` y las respuestas HTTP de error (`400`, `401`, `500`, `502`, `503`, `504`) permanecen intactas en `app.py`.
- **Constitución v1.0.0 Principio 15 (caché):** `_cache_get`/`_cache_set` en `/api/sorteos`, `/api/stats`, `/api/gaps` y `/api/backtesting` permanecen en `app.py`.

## Riesgos
- Si un test hace `from app import X`, funciona gracias a la reexportación en `app.py`. Ningún test existente hace `monkeypatch` de funciones internas dentro de `estadisticas.py` (los `monkeypatch` existentes en `tests/` son sobre `app.get_sorteos`, `app.SeguimientoSession`, `app.subprocess.run`, `app.predictor.update` y `seguimiento.*`, que siguen todos en `app.py` / `seguimiento.py`).

## Tareas
| # | Tarea | Done-check | Depende |
|---|---|---|---|
| T1 | Crear `estadisticas.py` con todas las funciones puras (incluidas `calcular_gaps`, `comparar_numeros`, `simular_numero`) sin importar Flask ni SQLAlchemy | `python -c "import estadisticas"` funciona sin Flask/DB y sin `flask`/`sqlalchemy` en su AST | — |
| T2 | Refactorizar `app.py` para importar/reexportar desde `estadisticas.py` y delegar `/api/gaps`, `/api/comparar` y `/api/simulador` | `app.py` < 450 líneas y las 153 pruebas existentes pasan sin cambios (`pytest -q -W error`) | T1 |
| T3 | Añadir `tests/test_estadisticas_modulo.py` probando aislamiento del módulo, `calcular_gaps`, `comparar_numeros`, `simular_numero` y paridad con `app.py` | Suite completa pasa con 0 warnings (`pytest -q -W error`) | T2 |
| T4 | Actualizar `CLAUDE.md` y `README.md` con `estadisticas.py` y el nuevo tamaño de `app.py`; ejecutar `verify` | `02-DOCS/wiki/sdd/verifications/modularizar-backend-2026-11-02.md` en PASS | T3 |
