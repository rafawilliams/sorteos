---
author: rafawilliams
branch: chore/limpieza
status: in-progress
---
# Limpieza tras la revisión del 2026-10-31

## Intent
Cerrar los cabos sueltos pequeños que quedaron después de los PRs #1–#12.

## Scope
- In: escape inválido en `tests/test_actualizar.py`; tamaño de `app.py` en `CLAUDE.md`; favicon; documentos FTD fusionados marcados como `done`; prueba del botón «Actualizar datos».
- Out: SQLAlchemy 2.x y la división de `app.py`/`app.js` (SDD aparte); licencia (decisión del dueño).

## Checklist
- [x] Sin `SyntaxWarning` en la suite — prueba: `pytest -W error::SyntaxWarning` en verde.
- [x] `CLAUDE.md`: `app.py ~1200 lines` (tiene 1193).
- [x] Favicon servido y enlazado — prueba: `GET /static/favicon.svg` → 200 `image/svg+xml`; el HTML lo enlaza.
- [x] 11 documentos FTD → `done` con su PR; `proteger-actualizar.md` sigue abierto.
- [ ] Botón «Actualizar datos» probado en el navegador — no verificado: el navegador automatizado falló dos veces (el `prompt()` lo cerraba el MCP; después se cerró el navegador). El log del servidor confirma que no llegó ninguna petición.

## Evidence
- Ver checklist.

## Next
Probar el botón a mano (token de `.env`), cerrar `proteger-actualizar.md` y este documento; PR a main.
