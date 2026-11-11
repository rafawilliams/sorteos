---
type: analysis
title: Análisis de consistencia — Migrar el front-end a React
description: Lectura cruzada de constitución, spec, plan y tareas de frontend-react antes de implementar; veredicto, mapa de cobertura y hallazgos.
tags: [sdd, analysis]
timestamp: 2026-11-11T14:00:00Z
topic: sdd
slug: frontend-react
---

# Análisis de consistencia — Migrar el front-end a React

Artefactos leídos: [constitución v1.0.0](../constitution.md) · [spec](../specs/frontend-react.md) · [plan y tareas](../plans/frontend-react.md). Perfil: `technical_level: technical`.
Comprobado también contra el código: `static/app.js`, `app.py`, `tests/seed_db.py`, `ml_model.py` y la salida de `rsc risk`.

## Veredicto

**GATE: BLOCKED** — 0 CRITICAL, **3 HIGH**, 9 MEDIUM, 4 LOW.

Los tres HIGH son baratos de arreglar (una frase en el plan, un criterio de la guardia, una decisión sobre qué base de datos usar), pero si se implementa sin arreglarlos fallan a mitad de la etapa 0 o invalidan la prueba visual. El resto se puede aceptar o resolver sin bloquear.

## Mapa de cobertura (spec → plan → tareas)

| REQ | Requisito de la spec (corto) | Plan | Tareas | Estado |
| --- | --- | --- | --- | --- |
| AC1 | 14 pestañas × 2 temas iguales a la referencia | §5, §6 | T006, T007, T019, T022, T026, T031, T034, T037, T042, T046, T051, T057 | covered, **pero la referencia no es fiable (H3)** |
| AC2 | Etapa a medias: todo funciona y comparte ML, premio y tema | §2, §3, §4 | T014–T016 y cada isla | covered; **T015 sin diseño de prueba (M10)** |
| AC3 | Teclado y roles ARIA | §0, §5 | T038, T040, T044, T053 | covered; la spec pide repetirlo en cada etapa (M12) |
| AC4 | Premios idénticos a lo recibido | §0 | T012, T013, T035, T043, T045, T047 | covered, **pero choca con el Simulador (H1)** |
| AC5 | Token de actualización | §0, §3 | T011, T054 | covered |
| AC6 | Un tipo roto falla la compilación | §3 | T008, T009, T010 | covered; faltan las variantes con nulos en la prueba (L14) |
| AC7 | Migración completa en verde, sin archivos viejos | §6 etapa 10 | T052, T055, T056, T058 | covered |
| AC8 | Clon sin build muestra aviso | §3 | T003, T004 | covered |
| AC9 | CI construye y comprueba tipos | §2 | T002, T005 | covered; **push de T005 bloqueado por rsc (H2)**; sin auditoría npm (M6) |
| AC10 | Pruebas por texto sustituidas sin perder cobertura | §5 | T012, T018, T021 … T056 | covered |
| AC11 | Constitución v2.0.0 | §1 | T001 | covered; orden respecto a T002 (M5) |
| B-err | Error genérico, reintento, una pestaña caída no tumba las demás | §3, §4 | solo T017 lo comprueba | **AMBIGUOUS (M7)** |
| B-vacío | Mensajes vacíos iguales y estado de carga lento | §7 riesgo 7 | ninguna lo comprueba | **AMBIGUOUS (M7)** |
| B-conv | Sin duplicar peticiones a la API | §0, §4 | T015 | covered |
| — | Servidor de desarrollo con recarga | §2 | T056 | DRIFT leve: en la spec es solo una suposición (L15) |
| — | Diferencia por píxeles «como aviso» | §5 | ninguna | plan sin tarea (L14) |
| — | Aterrizar spec, plan y análisis en `main` | — | ninguna | GAP de proceso (M11) |

## Hallazgos

| # | Sev. | Tipo | Artefacto A | Artefacto B | Conflicto | Resolver en |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | HIGH | Contradicción | Plan §0 («Prohibido `padStart`, `zfill`») y T013 (prueba que falla si aparece en `frontend/src`) | Spec Behaviour / AC «mismo comportamiento»; `static/app.js:1038` | El Simulador de hoy rellena a 4 cifras el **número que teclea el usuario** (`padStart(4,'0')`, no un premio). T028 no podrá portarlo fielmente sin romper la guardia de T013 | plan (§0) y tasks (T013) |
| 2 | HIGH | Contradicción | Plan §7 riesgo 5 («spec vinculada a la rama, ya lo está») | `rsc risk` sobre `.github/workflows/tests.yml` | La spec lleva `branch: feat/react-frontend`, pero T005 irá en la rama de la etapa 0 (`feat/react-etapa-0-…`). `rsc` rechaza push y PR de una rama tier 2 sin una spec vinculada **a esa rama** | plan (§7) y spec (frontmatter) |
| 3 | HIGH | Contradicción | T007 («con la base de datos de siempre») | Plan §5 («base sembrada igual en ambas capturas») y §7 riesgo 8 («base sembrada fija»); `tests/seed_db.py` | `seed_db.py` se niega a sembrar una BD con datos; la BD real cambia con cada sorteo nuevo, y `/api/stats` **escribe** en `predicciones` (Seguimiento congela recomendaciones al calcular). Capturar contra la BD real da referencias que se mueven y con efectos secundarios | plan (§5/§7) y tasks (T006, T007) |
| 4 | MEDIUM | Contradicción | Spec, Points to clarify: «el orden empieza por el armazón» | Plan §2 y §6: el armazón migra al final (etapa 10) | Una suposición aprobada dice lo contrario de lo que se va a construir. El dueño vio la decisión del plan, pero la spec quedó vieja | clarify (spec) |
| 5 | MEDIUM | Constitución | T001 (enmienda) y T002 (andamiaje) | Constitución principio 1 | T001 y T002 no dependen una de otra: se podría añadir Vite antes de enmendar el principio que lo prohíbe. La constitución manda | tasks (T002 depende de T001) |
| 6 | MEDIUM | Constitución | Constitución principio 5 (solo `pip-audit`) y T001 (no lista el 5) | Plan §7 (riesgo de cadena de suministro) y T005 | Se añade una cadena de dependencias de Node sin auditoría equivalente en el CI | constitution (T001) y tasks (T005) |
| 7 | MEDIUM | Ambigüedad | Spec Behaviour (edge y error paths) | Tareas T020–T049 | Solo T017 comprueba «error con reintento». Ninguna isla comprueba el estado de carga con `stats` nulo ni «una pestaña caída no tumba las demás», aunque el plan §7 riesgo 7 dice que «se prueba» | tasks |
| 8 | MEDIUM | Ambigüedad (portador) | Plan §0 y T011 | `static/app.js:766` y `1046` | Falta en §0 el formato de las consultas: `/api/comparar?numeros=a,b,c`, `/api/simulador?numero=&cat=&from=&to=`, `/api/backtesting?last_n=500`. `SimParams` no está definido. Faltan bloques Interfaces para T012 (utilidades), T013 (props de `Balls`) y `Skeleton`, consumidos por T017, T035 y T043 | tasks (Interfaces) y plan (§0) |
| 9 | MEDIUM | Ambigüedad / `[P]` | T023/T024, T028/T029, T039/T040, T047–T049 marcadas `[P]` | T016 (registro central de islas) y plantilla | Cada isla debe añadir su `<div data-react-root>` a `index.html` y registrarse; ni las tareas lo dicen ni los `[P]` lo respetan: comparten esos archivos | tasks (y plan §3: registro por descubrimiento automático) |
| 10 | MEDIUM | Ambigüedad | T015 («carga el `app.js` real en jsdom») | `templates/index.html` (Jinja) y `app.js` (script clásico con `getElementById` al cargar) | El plan no explica cómo se obtiene el HTML en la prueba (la plantilla usa `url_for`) ni qué parte del DOM necesita `app.js` para arrancar. Sin eso, el done-check de T015 no es ejecutable | plan (§5) |
| 11 | MEDIUM | Cobertura | Spec/plan/análisis (4 archivos en esta rama) | Tareas | Ninguna tarea los lleva a `main`; las etapas parten de `main` y la guardia de ids, las verificaciones y el índice los citan | tasks (tarea previa a T001: PR de documentación) |
| 12 | MEDIUM | Cobertura | Spec «How it proves it» («repetida en cada etapa») | Tareas (AC3 solo en T038, T040, T044, T053) | La spec exige repetir la prueba de teclado en cada etapa; las tareas la ponen solo donde hay subpestañas nuevas y en el armazón | clarify (spec: aceptar «cuando se toca») o tasks |
| 13 | LOW | Ambigüedad | T002 (done-check `FE test` en verde) | Vitest | Con cero archivos de prueba, Vitest sale con error; el done-check no pasaría | tasks (`--passWithNoTests` o prueba de humo) |
| 14 | LOW | Cobertura | Plan §5 (píxeles como aviso) y §7 riesgo 4 (test de campos sin fixture) | T009 | Dos mitigaciones prometidas sin tarea; T009 no exige el fixture con nulos | tasks |
| 15 | LOW | Drift | T056 (servidor con recarga, trazado a AC7 y AC10) | Spec: solo suposición tomada | El trazado es forzado; es una comodidad opcional, no un criterio | tasks (trazar a la suposición) |
| 16 | LOW | Duplicación | T016 («cargar el bundle desde la plantilla») | T004 (ya sirve el `<script>`); T008 depende de T004 | T016 repite T004; T008 depende de T004 sin necesitarlo (necesita la BD sembrada, no el aviso) | tasks |

### Por qué importan los HIGH

1. **Hallazgo 1.** O la guardia falla al portar el Simulador, o alguien la relaja sin criterio y deja entrar `padStart` en el código de premios, que es justo lo que la constitución (principio 7) quiere impedir. La regla correcta es «ningún relleno sobre premios».
2. **Hallazgo 2.** La etapa 0 se quedaría sin poder subir su rama a medio camino, con el CI ya editado en local. Se arregla vinculando la spec a la rama de esa etapa o haciendo que el PR de la etapa 0 salga de esta misma rama.
3. **Hallazgo 3.** AC1 es el criterio que el dueño más va a mirar, y se apoya en una referencia que cambia con cada sorteo y que además altera la tabla `predicciones` al capturarla. Con una base sembrada aparte (`tests/seed_db.py` sobre una BD vacía) la referencia y el «después» son comparables y sin efectos laterales. Nota a favor: el ML usa semillas fijas (`random_state=42`, `default_rng(42)`), así que con datos fijos las recomendaciones salen iguales.

## Enrutado recomendado

| Fase dueña | Hallazgos | Qué hay que decidir |
| --- | --- | --- |
| **plan** | 1 (§0), 2 (§7), 3 (§5/§7), 8 (§0), 9 (§3), 10 (§5) | Regla de relleno solo sobre premios; cómo se vincula la spec a la rama tier 2; base sembrada aparte para capturas; formato de consultas en §0; registro de islas por descubrimiento; cómo se prueba el puente en jsdom |
| **tasks** | 2, 3, 5, 6, 7, 8, 9, 11, 13, 14, 15, 16 | Dependencias de T001→T002; T007 con BD sembrada; Interfaces de T012/T013/Skeleton; estados de carga, vacío y error en cada isla; quitar los `[P]` que comparten archivos; tarea de PR de documentación |
| **constitution** | 6 | Extender el principio 5 a la auditoría de dependencias del front (T001) |
| **clarify (spec)** | 4, 12 | Actualizar la suposición del orden (armazón al final) y aceptar o no «prueba de teclado solo donde se toca» |

Si el dueño prefiere no reabrir la spec, 4 y 12 pueden aceptarse conscientemente: ninguno bloquea.

## Qué no comprobó este análisis
No ejecutó nada del código ni de las tareas: lee artefactos y los contrasta con el repositorio. Los done-checks se evaluaron por si son ejecutables en papel, no ejecutándolos.
