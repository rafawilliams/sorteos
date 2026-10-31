---
author: rafawilliams
branch: fix/errores-actualizar
status: in-progress
---
# Errores de POST /api/actualizar: sin filtrar detalles internos

## Intent
El endpoint devuelve al navegador `str(e)` y el `stderr` completo del script (trazas con rutas del servidor), y oculta con `except: pass` los fallos del reentrenamiento ML.

## Scope
- In: script falla → 502 con mensaje genérico, `stderr` solo en el log, sin reentrenar; excepción inesperada → 500 genérico + `log.exception`; fallo del reentrenamiento → `log.exception` y `ml_retrained: false` en la respuesta; el frontend guarda el token si la respuesta no es 401.
- Out: otros endpoints.

## Checklist
- [x] Script con exit≠0 → 502, la respuesta no contiene el stderr, no reentrena — prueba: test.
- [x] Excepción inesperada → 500 sin el mensaje interno — prueba: test.
- [x] Reentreno falla → 200, `ml_retrained: false`, error en el log — prueba: test con `caplog`.
- [x] Éxito → `ml_retrained: true` — prueba: test.
- [x] Suite verde local y en CI — prueba: `pytest` + check del PR.

## Evidence
- 4 tests nuevos en `tests/test_actualizar.py`: fallaban antes; suite local `77 passed` después.
- `grep "str(e)" app.py` y `except Exception: pass`: sin resultados.
- Servidor real con token correcto: HTTP 200 en 16,6 s, `ok: true`, `ml_retrained: true`, 0 sorteos nuevos.
- No forzado contra el servidor real el caso de fallo del script (cubierto por test).
- CI: ver check del PR.

## Next
PR a main (requiere check `test` en verde por la protección de main).
