---
type: verification
title: Verification — seguimiento-recomendaciones — 2026-10-31
description: Veredicto con pruebas para seguimiento-recomendaciones — suite, criterios de aceptación y prueba con la BD real.
tags: [sdd, verification]
timestamp: 2026-10-31T13:45:00Z
topic: sdd
slug: seguimiento-recomendaciones
source_state: b25ce6c + cambios de UI/docs sin commit (dirty)
---

# Verification — seguimiento-recomendaciones — 2026-10-31

## Stack gate
- `pytest -q -W error::SyntaxWarning` → **153 passed** (28 nuevos: `tests/test_seguimiento.py` 22, `tests/test_seguimiento_api.py` 6).
- `pip-audit -r requirements.txt --ignore-vuln PYSEC-2026-217` (igual que el CI) → sin vulnerabilidades.
- `node -e "new Function(app.js)"` → JS sintácticamente válido.

## Tareas (plan)
- [x] T1 funciones puras — tests de métricas/pesos/combinar en verde.
- [x] T2 registro y congelado — tests SQLite en verde.
- [x] T3 resumen — tests en verde.
- [x] T4 integración `/api/stats` + `GET /api/seguimiento` — tests de endpoint y de fallo seguro en verde.
- [x] T5 pestaña — navegador (5001): carga, 4 tarjetas congeladas, sin errores de consola.
- [x] T6 BD real + docs — ver abajo; `CLAUDE.md` actualizado.

## Criterios de aceptación
- [x] Registro al calcular por primera vez — BD real: `/api/stats` (200, 34,6 s) creó 11 filas (dominical, gordito, miercolito: 3 métodos; extraordinario: 2, sin ML). Log: «registradas recomendaciones para dominical, extraordinario, gordito, miercolito».
- [x] No cambia al recalcular — BD real: `_cache_clear()` + `/api/stats` de nuevo → 11 filas, contenido idéntico (`True`).
- [x] Recomendado frente a resultado, con aciertos marcados — `TestResumen::test_pending_then_compared`; render en el navegador con un sorteo de ejemplo pintado solo en el cliente (el acierto exacto se marca en verde).
- [x] Top-5 con el 3er premio = 1 exacto — `test_comparar_third_prize_is_exact_hit`.
- [x] Gordito con 2º/3º de 2 cifras — `test_gordito_two_digit_prizes_only_count_for_endings`.
- [x] Menos de 10 → 50/50 — `test_fewer_than_10_is_half`; BD real: `peso_ml` 0,5 y la web lo explica («van 0»).
- [x] Más de 20 con ML mejor → peso ML > 50 % y solo cuentan los 20 recientes — `test_only_last_20_count`.
- [x] 0,45/0,40 → 53 % — `test_proportional` (0,529).
- [x] Sin registro → aparece y no cuenta — `test_draw_without_record`; fila gris en el navegador (ejemplo).
- [x] Azar junto a cada medida — tabla «Marcador frente al azar» en el navegador.
- [x] Fallo al guardar → stats igual y sin detalles — `test_registrar_seguro_never_raises`; `test_api_seguimiento_error_is_generic`.

## Capas no ejecutadas
- **SUSTITUIDA** — comparación con un resultado real: el primer sorteo registrado es el dominical del 2026-11-01, que aún no existe. La sustituyen los tests con datos sintéticos y un render de ejemplo en el cliente. No puede detectar un desajuste entre el formato real de la API y la clave del objetivo; se revisará tras sincronizar el 1-nov.
- **HERRAMIENTA-AUSENTE** — linter (ruff/pyflakes) y tipos (mypy): no instalados; no se ejecutó nada en su lugar.

## Hallazgos descartados
- «El caché de 5 min impide registrar» — descartado: el registro ocurre en cada fallo de caché de `/api/stats`, y `/api/actualizar` limpia el caché (verificado con `_cache_clear()` en la BD real).

## Verdict: PASS — con la comparación real pendiente del primer sorteo (2026-11-01).
