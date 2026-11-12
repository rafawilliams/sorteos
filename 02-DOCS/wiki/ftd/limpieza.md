---
author: rafawilliams
branch: chore/limpieza
status: done
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
- [x] 12 documentos FTD → `done` con su PR (`proteger-actualizar.md` incluido).
- [x] Botón «Actualizar datos» probado en el navegador — verificado con Playwright/Edge manejando `dialog` (`prompt()`): clic con token inválido → `401`, limpia `sessionStorage` y muestra `"Error: Token inválido"`; segundo clic vuelve a pedir token y con `ACTUALIZAR_TOKEN` válido → `200` (`ml_retrained: true`), persiste en `sessionStorage` y muestra `"Datos actualizados correctamente"`.

## Evidence
- Ver checklist.

## Next
Fusionado en PR #13 (2026-10-31); verificación en navegador y cierre de FTDs completados el 2026-11-01.
