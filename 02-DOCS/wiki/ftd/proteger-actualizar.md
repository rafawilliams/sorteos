---
author: rafawilliams
branch: fix/proteger-actualizar
status: done
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
- [x] Frontend envía el token y lo vuelve a pedir si es 401 — prueba: navegador (Playwright/Edge contra servidor real en `127.0.0.1:5002`).
- [x] Suite verde — prueba: `pytest`.

## Evidence
- `tests/test_actualizar.py` (5 tests, script y reentreno simulados): 4 fallaban antes; suite completa `64 passed` después.
- Servidor real (`FLASK_DEBUG=0`): sin token → 401; token incorrecto → 401; log `Data update rejected: invalid token from 127.0.0.1`.
- Navegador real (Playwright sobre Edge, 2026-11-01):
  1. Clic en `#updateBtn` con token inválido en `prompt()` → `POST /api/actualizar` devuelve `401` (`{"auth_required":true,"error":"Token inválido","ok":false}`), `sessionStorage.getItem('updateToken') === null`, toast `"Error: Token inválido"`.
  2. Segundo clic en `#updateBtn` → vuelve a abrir `prompt()`, envía `ACTUALIZAR_TOKEN` válido → `POST /api/actualizar` devuelve `200` (`ml_retrained: true`, `ok: true`), guarda `updateToken` en `sessionStorage` y muestra toast `"Datos actualizados correctamente"`.

## Next
Fusionado en PR #3 (2026-10-31); verificación en navegador completada el 2026-11-01.
