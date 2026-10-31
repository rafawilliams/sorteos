---
author: rafawilliams
branch: fix/debug-env
status: in-progress
---
# Modo debug configurable por .env

## Intent
`app.run(debug=True)` está fijo en `app.py`. Con debug activo, el depurador de Werkzeug permite ejecutar código en el servidor. Debe estar apagado salvo que se active explícitamente.

## Scope
- In: `base.env_flag()`, `app.py` lee `FLASK_DEBUG` (default apagado), `.env.example`, CLAUDE.md.
- Out: servidor de producción (gunicorn/waitress), puerto configurable.

## Checklist
- [x] `env_flag()` interpreta 1/true/yes/on y por defecto False — prueba: tests en `tests/test_config.py`.
- [x] `app.py` sin `debug=True` fijo — prueba: grep + test.
- [x] `.env.example` documenta `FLASK_DEBUG` — prueba: grep.
- [x] Suite verde — prueba: `pytest`.

## Evidence
- Tests nuevos (`TestEnvFlag`, 13 casos): fallaban antes; suite completa `59 passed` después.
- `grep FLASK_DEBUG .env.example CLAUDE.md`: documentado en ambos.
- Arranque real: `FLASK_DEBUG=0` → ` * Debug mode: off`; `FLASK_DEBUG=1` → ` * Debug mode: on`.
- `.env` local con `FLASK_DEBUG=1` para conservar el comportamiento de desarrollo.

## Next
PR a main.
