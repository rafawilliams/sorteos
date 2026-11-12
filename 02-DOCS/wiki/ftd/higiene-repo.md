---
author: rafawilliams
branch: chore/higiene-repo
status: done
---
# Higiene del repositorio: plan histórico y ramas remotas fusionadas

## Intent
`docs/plan-mejoras-pendientes.md` conserva al final las secciones de las Fases 2 a 5 como si estuvieran pendientes, aunque todas sus tareas ya están marcadas `[x]` en la sección «Completado». Además, en `origin` quedan ramas ya fusionadas de los PRs #1–#17.

## Scope
- In: actualizar `docs/plan-mejoras-pendientes.md` eliminando los bloques duplicados ya completados y enlazando a `02-DOCS/wiki/` como fuente viva; eliminar en `origin` las 17 ramas de trabajo ya fusionadas en `main` (preservando `main` y `rsc/knowledge`).
- Out: código de aplicación, `rsc/knowledge`.

## Checklist
- [x] `docs/plan-mejoras-pendientes.md` refleja únicamente el historial completado y apunta a `02-DOCS/wiki/index.md` — prueba: lectura del archivo (32 líneas).
- [x] Ramas remotas fusionadas en `main` eliminadas de `origin` — prueba: `git branch -r` muestra solo `origin/main` y `origin/rsc/knowledge`.
- [x] Suite de pruebas en verde (`pytest -q -W error`) — prueba: `153 passed` sin warnings.

## Evidence
- `git push origin --delete ...`: eliminadas las 17 ramas remotas de los PRs #1–#17 (`chore/*`, `ci/*`, `docs/*`, `feat/*`, `fix/*`).
- `git branch -r`: quedan únicamente `origin/main` y `origin/rsc/knowledge`.
- `pytest -q -W error`: `153 passed` con 0 warnings.

## Next
PR a main (2026-11-01).
