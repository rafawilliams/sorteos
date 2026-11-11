---
type: progress
title: Progreso — Migrar el front-end a React
description: Registro append-only de la implementación de frontend-react, tarea a tarea, con evidencia, riesgo y cola de decisiones.
tags: [sdd, progress]
timestamp: 2026-11-11T16:10:00Z
topic: sdd
slug: frontend-react
---

# Progreso — Migrar el front-end a React

Spec: [frontend-react](../specs/frontend-react.md) · Plan y tareas: [plan](../plans/frontend-react.md) · Rama de la etapa 0: `feat/react-frontend`.

## Preparación (gate de implement) — 2026-11-11
- spec, plan, tareas y análisis (PASS, 2 LOW) existen y están aprobados; rama aislada en `.worktrees/feat-react-frontend`.
- Faltaba `02-DOCS/wiki/sdd/config.yaml`: creado con `sdd-init` (strict TDD, pytest, presupuesto 900 líneas / 25 archivos). Registro de skills refrescado (273 skills).
- Selected skills: `implement`, `constitution`; `python`/`testing` según la tarea.

## T001 — 2026-11-11
- status: complete
- qué: constitución enmendada a v2.0.0 (MAJOR): principios 1, 2, 3, 5, 6 y 14 y definición de hecho; las versiones anteriores quedan tachadas en «Principios reemplazados»; fila en el registro de enmiendas; índice del wiki actualizado.
- ratificación: el dueño ratificó el texto mostrado (opción «Ratifico v2.0.0») el 2026-11-11.
- done-check: `grep -c "v2.0.0"` = 10 (≥ 2); la frase «sin bundlers ni frameworks» ya no está en el principio 1 (solo en el bloque tachado); fila `2026-11-11 | v2.0.0` presente; el principio 5 menciona `npm audit`.
- risk: tier 0 (docs) — sin revisor.
- controls: tests n/a (solo documentación, sin código tocado) · build n/a · security n/a · traceability ✅ (AC11).
- nota: la v2.0.0 nombra `.nvmrc` para la versión de Node; T002 debe crearlo.
- nota: no existe `REVIEW.md` en la raíz (tampoco existía en la v1.0.0). Queda fuera de T001; ver cola de decisiones.

## Decision queue
- [review-after] Q1 — No existe `REVIEW.md` en la raíz del repo (lo lee el revisor de `implement` y `review`); sin él los revisores usan solo la constitución, evidencia: `ls REVIEW.md` no existe, T001 (se propone crearlo con la skill `constitution` antes de la primera revisión de tier 1, T002)

## T002 — 2026-11-11
- status: complete (commit 362d164)
- qué: `frontend/` con TypeScript estricto, Vite (salida fija `static/dist/app.js`), Vitest con jsdom y `passWithNoTests`, React 19.3.1, Chart.js 4.6.1 y librerías de prueba, todo con versión exacta y `package-lock.json`; `.nvmrc` = 22.23.4; entradas de `.gitignore`; comandos de front añadidos a `config.yaml`.
- done-check (códigos de salida reales): `npm ci` 0 · `typecheck` 0 · `test -- --run` 0 (sin archivos de prueba, `passWithNoTests`) · `build` 0 con `static/dist/app.js` presente · `git check-ignore` imprime `static/dist/app.js` y `frontend/node_modules` · `npm audit --audit-level=high`: 0 vulnerabilidades.
- risk: tier 1 (`rsc risk`) — un revisor.
- review: ronda 1 → 0 hallazgos, `VERDICT: pass`.
- controls: tests ✅ build ✅ security ✅ (npm audit) traceability ✅ (AC9).
- nota del revisor (sin acción): `tsconfig.json` ya incluye `fixtures/`, que llega con T008/T010.

## T003 + T004 — 2026-11-11
- status: complete
- red (T003): `pytest tests/test_frontend_build.py` con `FRONTEND_BUILD` solo como stub: 2 failed (`test_muestra_el_aviso_con_el_comando_para_construir`, `test_incluye_el_script_como_modulo`), 3 passed. Un primer intento sin el stub fallaba con `AttributeError` en el fixture (rojo por la razón equivocada) y se corrigió.
- green (T004): `index()` pasa `react_built=os.path.isfile(FRONTEND_BUILD)`; la plantilla muestra el aviso con `role="alert"` y el comando para construir si falta, o carga `dist/app.js` como `type="module"` si existe; estilo `.build-notice` con variables del tema. `pytest tests/test_frontend_build.py tests/test_ui_assets.py tests/test_api.py`: 23 passed.
- files: app.py, templates/index.html, static/style.css, tests/test_frontend_build.py
- desviación del done-check de T004: la comprobación «la API sigue respondiendo» usa `/api/sorteos` y no `/api/stats`, porque `/api/stats` tarda en entrenar el modelo y escribe recomendaciones en la tabla `predicciones` de la base real al ejecutarse en local. Ver decisions.md.
