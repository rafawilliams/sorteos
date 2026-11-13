---
type: verification
title: Verification — frontend-react — 2026-11-12
description: Veredicto con pruebas del cierre de la migración del front-end a React — puertas de la constitución v2.0.0, criterios de aceptación, tareas, y lo que no se ejecutó.
tags: [sdd, verification]
timestamp: 2026-11-12T21:00:00Z
topic: sdd
slug: frontend-react
source_state: feat/react-etapa-10-cierre (sobre main en fc70b90)
---

# Verification — frontend-react — 2026-11-12

La interfaz entera es React + TypeScript; `static/app.js` ya no existe; la plantilla de Flask solo trae `<div id="root">`. Esta verificación cubre las 10 etapas de la migración (el detalle de cada tarea y de cada PR está en `progress/frontend-react.md`). Todo lo que figura como «no ejecutado» no se ejecutó: no se da por pasado.

## Puertas de la constitución v2.0.0 (Definition of Done)
Ejecutadas hoy sobre `main` (fc70b90) en un worktree limpio:
- `pytest -q -W error::SyntaxWarning` (base sembrada `sorteos_capturas`, 600 sorteos) → **579 passed, 1 skipped**.
- `npm --prefix frontend run typecheck` (`tsc --noEmit`) → **exit 0**.
- `npm --prefix frontend test -- --run` → **45 archivos, 1192 pruebas, todas en verde**.
- `npm --prefix frontend run build` → build correcto en `static/dist/app.js`.
- `pip-audit -r requirements.txt --ignore-vuln PYSEC-2026-217` → `No known vulnerabilities found, 1 ignored` (la ignorada es la de siempre).
- `npm --prefix frontend audit --audit-level=high` → `found 0 vulnerabilities`.
- CI real (GitHub Actions) en los PR #57, #58, #59 y #60: los jobs `test` y `frontend` terminaron en **success**, y también el push a `main` de #58, #59 y #60.
- `test -e static/app.js` falla (no existe); `grep -c cdn.jsdelivr templates/index.html` imprime 0; `grep -rn "static/app.js" tests` imprime 0.

## Criterios de aceptación (spec)
1. **Capturas de las 14 pestañas en ambos temas igual a la referencia** — **NO EJECUTADO como comprobación de máquina.** Cada etapa generó y comparó capturas contra `main` (etapas 1 a 8, registradas en el progreso) y el dueño aprobó las pestañas una a una. Las 28 capturas finales de T057 no se generaron con `frontend/scripts/capturas.mjs`; el dueño aprobó T042, T051 y T057 («si y apruebo todo») sobre la aplicación en marcha. Hay una captura de escritorio de Predicciones revisada a ojo en la etapa 10.
2. **Etapa a medias: todas las pestañas funcionan y comparten modo ML, premio y tema** — cumplido durante la migración (cada PR dejó la app entera usable, con el CI en verde y la comprobación en navegador de cada etapa); ya no aplica, porque no quedan pestañas antiguas. Hoy lo cubren `shell/Armazon.test.tsx` (el interruptor ML de Terminaciones y el de Predicciones comparten el estado) y `store/reactStore.test.ts`.
3. **Flechas, Inicio y Fin: foco, selección y roles ARIA** — pruebas con `userEvent` de `Tablist` (28), de la barra principal y el menú (`shell/Tabs.test.tsx`, 40) y de las subpestañas de cada isla. En Chromium se comprobaron con eventos del DOM, **no con teclas reales** (ver «No ejecutado»).
4. **Barra lateral fija, en grupos, sección activa marcada; con ≤ 900 px se esconde, la abre ☰, cierra con Escape, fuera o al elegir sección, y escondida no recibe foco** — `shell/Tabs.test.tsx`, `shell/Armazon.test.tsx` y `tests/test_menu_lateral.py` (reglas de CSS: posición fija, punto de corte, `visibility:hidden`). En Chromium real con 800 px: la barra cerrada queda `hidden` y fuera de pantalla; el botón la abre; elegir una sección, Escape y el fondo la cierran y devuelven el foco al botón; el resto de la página queda `inert`.
5. **Premios de 2, 4, 5 cifras o vacíos con el texto idéntico al recibido** — `frontend/src/sin-relleno.test.ts` (ningún archivo del front rellena con ceros salvo el número del Simulador), `components/Balls.test.tsx`, y las pruebas de cada isla con premios de 2 y 5 cifras (`Estadisticas.test.tsx`, `Resultados.test.tsx`, `PrediccionesResumen.test.tsx`). El tooltip de la dispersión muestra los premios tal como llegan.
6. **Token solo durante la sesión; actualización con 401, 503, 502 y 500 opacos** — `shell/Actualizar.test.tsx` (35 pruebas: `sessionStorage` y nunca `localStorage`, 401 lo olvida, 503/502/500 con el texto público o el genérico, nunca el cuerpo ni `output`) y `api/client.test.ts`. Contra el servidor real solo se ejercitó la ruta del **401** (token incorrecto: aviso «Error: Token inválido», token no guardado); 503, 502 y 500 solo con `fetch` falso, y **no se llamó nunca a `POST /api/actualizar` con un token válido** (sincronizaría datos reales).
7. **Un cambio que rompe el tipo de una respuesta hace fallar la compilación** — demostrado hoy: cambiar `total_sorteos: number` a `string` en `api/types.ts` hace que `tsc --noEmit` falle (`fixtures.check.ts`: «Types of property 'total_sorteos' are incompatible», exit 1); revertido, vuelve a pasar. El job `frontend` del CI ejecuta `npm run typecheck`.
8. **`pytest -q -W error::SyntaxWarning` y la comprobación del front en CI pasan, y ningún archivo de la interfaz anterior queda sin uso** — pasa localmente (579 passed). `static/app.js` está borrado, `LegacyStore`, `montaje.tsx` y sus pruebas también, y no hay fuentes ni fixtures del front huérfanos (comprobado en T056). **Diferencia:** el CI ejecuta `pytest -q` a secas, sin `-W error::SyntaxWarning`; el criterio lo pide con ese filtro. Pasa con él (arriba), pero el CI no lo exige.
9. **Clon sin interfaz construida: aviso de cómo construirla y la API sigue respondiendo** — `tests/test_frontend_build.py` (5) y, en vivo hoy: con `static/dist/` ausente el servidor devuelve 200 con el aviso `npm --prefix frontend run build`, sin el script del build, y `/api/sorteos` responde con 600 sorteos.
10. **El CI construye la interfaz, comprueba tipos y pasa las pruebas** — `.github/workflows/tests.yml`, job `frontend`: `npm ci`, `typecheck`, `npm test -- --run`, `build`, `npm audit --audit-level=high`. En success en los PR #57 a #60.
11. **Una prueba de componente equivalente por cada regla que cubrían las comprobaciones por texto** — esferas sin ceros: `Balls.test.tsx` y `sin-relleno.test.ts`; etiquetas de categoría sin variantes: `lib/formato.test.ts` y `tests/test_categorias_unicas.py::test_ui_labels_have_no_variants` (ahora lee `CAT_LABELS` de `frontend/src/lib/formato.ts`); mapa de calor, leyenda y `cell-peak`: `Analisis.test.tsx`; `prize-chip`: `Resultados.test.tsx`; la guardia `tests/test_ids_retirados.py` impide reintroducir ids antiguos.
12. **Constitución enmendada a v2.0.0 con su entrada en el registro de cambios** — `constitution.md` en `version: v2.0.0`; el principio 1 pasó de «JavaScript vanilla sin frameworks» a TypeScript con React; entrada MAJOR del 2026-11-11 en el registro append-only.

## Tareas (plan)
Cada tarea tiene su entrada en `progress/frontend-react.md` con su evidencia.
- [x] Etapa 0 (T001 a T007, T059): constitución v2.0.0, andamiaje, aviso de «no construida», job de CI del front, script de capturas y referencia.
- [x] Etapa 1 (T008 a T019): contrato por fixtures, tipos, cliente de API, `Balls`, `Store`, primera isla (Gaps).
- [x] Etapa 2 (T020 a T022): Seguimiento. Menú lateral (enmienda del dueño).
- [x] Etapa 3 (T023 a T027): Mis Números, Comparador y `Chart`.
- [x] Etapa 4 (T028 a T031): Simulador y Mensual.
- [x] Etapa 5 (T032 a T034): Precisión.
- [x] Etapa 6 (T035 a T037): Resultados.
- [x] Etapa 7 (T038 a T042): `Tablist`, Decenas y Terminaciones.
- [x] Etapa 8 (T043 a T046): Predicciones.
- [x] Etapa 9 (T047 a T051): Estadísticas, Tendencias y Análisis.
- [x] Etapa 10 (T052 a T057): `ReactStore`, barra de pestañas y menú, botón de actualizar, armazón en React sin `app.js`, servidor de desarrollo y poda.
- [x] T058: esta verificación.

## Decisiones abiertas al cerrar (cola de decisiones)
- **Resueltas por el código:** Q6 (ya no existe `renderFull`), Q8 (`simularNumero` está en `ReactStore`), Q10 y Q12 (`ReactStore` implementa `simulacion` y `errorSorteos` y pasa la suite de contrato), Q13 (la barra principal pasa `controla`), Q17 (el interruptor ML de Terminaciones es `InterruptorML`).
- **Siguen abiertas, sin bloquear el cierre (no se reevaluaron):** Q1 (no hay `REVIEW.md` en la raíz), Q3 y Q5 (arreglos de la ronda 3 sin revisión posterior), Q4 (`aria-label` de las esferas), Q7 (esqueleto sin `aria-busy`), Q9 (estabilidad de `datos` y `opciones` de `Chart`; las pruebas de Estadísticas y Tendencias la comprueban, la de Terminaciones no, ver Q15), Q11 (Simulador con `stats` nulo), Q14 (categorías de Terminaciones como región y no `tabpanel`), Q15 y Q16 (sin señal de error de `/api/stats`).

## No ejecutado
- Las 28 capturas finales de T057 con `capturas.mjs` y su comparación contra la referencia (criterio 1): aprobado por el dueño sin ellas.
- Revisión manual del teclado con teclas reales en T042, T051 y T057 (criterios 3 y 4): cubierta por pruebas automáticas y eventos del DOM.
- Revisión de tier 1 con un revisor (`review`) de T047 a T057 (etapas 9 y 10): se hicieron revisiones en las etapas anteriores (T028, T029, T032, T035, T038 a T045), no en estas.
- `POST /api/actualizar` con un token válido contra el servidor real, y los 503, 502 y 500 contra el servidor real (criterio 6).
- `-W error::SyntaxWarning` en el CI (criterio 8): se ejecutó a mano.

## Verdict: PASS con cinco comprobaciones no ejecutadas
Las puertas de la constitución, el CI y los criterios 2, 5, 7, 9, 10, 11 y 12 pasan con evidencia de hoy. Los criterios 1, 3, 4, 6 y 8 pasan en lo automático y tienen la parte no ejecutada anotada arriba; el dueño los aprobó con esas salvedades.
