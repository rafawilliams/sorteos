---
author: rafawilliams
branch: fix/proteger-actualizar
status: in-progress
---
# Proteger POST /api/actualizar con token

## Intent
Cualquiera con acceso al servidor puede lanzar la sincronización y el reentrenamiento ML (50–100 s de CPU). Exigir un token secreto de `.env`.

## Scope
- In: cabecera `X-Update-Token` comparada con `ACTUALIZAR_TOKEN` (comparación en tiempo constante); sin token configurado → endpoint deshabilitado (503); frontend pide el token y lo guarda en `sessionStorage`; `.env.example`, CLAUDE.md, `.env` local.
- Out: sistema de usuarios/login, ocultar `str(e)` en errores 500.

## Checklist
- [x] Sin cabecera / token incorrecto → 401, no ejecuta el script — prueba: tests en `tests/test_api.py`.
- [x] Token correcto → ejecuta el script (mock) — prueba: test.
- [x] Sin `ACTUALIZAR_TOKEN` → 503 — prueba: test.
- [ ] (NO verificado en navegador) Frontend envía el token y lo vuelve a pedir si es 401 — prueba: navegador.
- [x] Suite verde — prueba: `pytest`.

## Evidence
- `tests/test_actualizar.py` (5 tests, script y reentreno simulados): 4 fallaban antes; suite completa `64 passed` después.
- Servidor real (`FLASK_DEBUG=0`): sin token → 401; token incorrecto → 401; log `Data update rejected: invalid token from 127.0.0.1`.
- No probado con token correcto contra el servidor real (lanzaría la sincronización externa + reentreno).
- Frontend: no probado en navegador; `prompt()` bloquea la automatización del navegador.

## Next
Probar el botón "Actualizar datos" en el navegador con el token de .env; luego PR a main.
