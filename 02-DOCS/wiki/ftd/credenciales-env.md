---
author: rafawilliams
branch: fix/credenciales-env
status: done
---
# Credenciales a .env

## Intent
Sacar del código las credenciales (API loteriapanama.net y BD) y leerlas de `.env`, porque el repo es público.

## Scope
- In: `actualizar_db.py`, `sorteosJson.py`, `base.py`, `tests/sorteo.http`, `.env.example`, `.env` local, CLAUDE.md.
- Out: reescribir el historial de git (las credenciales de la API son genéricas y públicas; `root:root` es solo local).

## Checklist
- [x] `base.py` exige `DATABASE_URL` (sin default `root:root`) y expone `api_credentials()` — prueba: tests nuevos en `tests/test_config.py` pasan.
- [x] Scripts usan `api_credentials()` — prueba: `grep loteriaGeneric *.py tests/` sin resultados.
- [x] `tests/sorteo.http` usa `{{$dotenv ...}}` — prueba: grep.
- [x] `.env.example` documenta las variables; `.env` local las tiene — prueba: `grep -o '^[A-Z_]*=' .env`.
- [x] Suite existente sigue verde — prueba: `pytest`.

## Evidence
- `tests/test_config.py`: 5 failed antes del cambio → incluidos en `46 passed` después.
- `grep loteriaGeneric|root:root` en *.py/*.http/CLAUDE.md: solo la aserción del test.
- `.env` claves: DATABASE_URL, LOTERIA_API_USER, LOTERIA_API_PASSWORD.
- `import actualizar_db` OK; `api_credentials()` devuelve username/password.
- NO verificado: login real a la API — `ReadTimeout` en el handshake TLS (servidor no respondió, previo al envío de credenciales). Reintentar con `python actualizar_db.py`.

## Next
Fusionado en PR #1 (2026-10-31). Nota original: Push de la rama y PR a main.
