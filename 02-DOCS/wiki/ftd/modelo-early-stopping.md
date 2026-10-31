---
author: rafawilliams
branch: fix/modelo-early-stopping
status: in-progress
---
# Modelo ML: early stopping siempre activo

## Intent
Tras el PR #10, el entrenamiento usa solo premios de 4 cifras: 9 751 filas. `HistGradientBoostingClassifier(early_stopping="auto")` solo activa la parada temprana por encima de 10 000 muestras. Por eso el modelo pasó de 10–39 iteraciones a 300: sobreajuste y un archivo 10 veces mayor (2,9 → 30,6 MB).

## Scope
- In: `early_stopping=True` en `_new_classifier` (afecta al entrenamiento y al backtest).
- Out: otros hiperparámetros.

## Checklist
- [x] `early_stopping` es `True` — prueba: `tests/test_ml_model.py` (falla antes del cambio).
- [x] Sin pérdida de precisión fuera de muestra — prueba: backtest de los últimos 500 con la BD real.
- [x] Suite verde — prueba: `pytest`.

## Evidence
- Modelos guardados: antes del PR #10, `n_iter_` = [39, 34, 14, 10] con 10 717 muestras; después, [300, 300, 300, 300] con 9 751.
- Backtest (500, fuera de muestra): `auto` → top-1 10,1 %, top-3 28,6 %, prob. media del dígito real por posición 9,5/10,1/9,5/9,9 %, 94 s. `True` → top-1 9,6 %, top-3 29,2 %, 9,9/10,0/10,0/10,0 %, 4 s. Ambas al nivel del azar (10 %/30 %); la diferencia de acierto es ruido (±1,3 pp).

## Next
PR a main. Tras fusionar, reentrenar (`POST /api/actualizar` o borrar `models/predictor.joblib` y llamar a `/api/stats`).
