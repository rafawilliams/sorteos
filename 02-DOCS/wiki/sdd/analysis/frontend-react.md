---
type: analysis
title: Análisis de consistencia — Migrar el front-end a React
description: Lectura cruzada de constitución, spec, plan y tareas de frontend-react antes de implementar; segunda pasada tras corregir los 16 hallazgos de la primera.
tags: [sdd, analysis]
timestamp: 2026-11-11T15:00:00Z
topic: sdd
slug: frontend-react
---

# Análisis de consistencia — Migrar el front-end a React

Artefactos leídos: [constitución v1.0.0](../constitution.md) · [spec](../specs/frontend-react.md) · [plan y tareas](../plans/frontend-react.md). Perfil: `technical_level: technical`.
Contrastado también con `static/app.js`, `app.py`, `tests/seed_db.py`, `ml_model.py` y la salida de `rsc risk` y `rsc review ledger`.
Este informe sustituye al de la primera pasada (3 HIGH, 9 MEDIUM, 4 LOW); el historial queda en git.

## Veredicto

**GATE: PASS** — 0 CRITICAL, 0 HIGH, 0 MEDIUM, **2 LOW** nuevos (no bloquean).

Los 16 hallazgos de la primera pasada están resueltos (tabla de abajo). Al releer aparecen 2 detalles menores de redacción que se pueden aceptar tal cual o limpiar al empezar `implement`.

## Comprobaciones mecánicas sobre la tabla de tareas

| Comprobación | Resultado |
| --- | --- |
| Tareas con 7 campos bien formados | 59 de 59 |
| IDs únicos y estables (T059 añadida al final, sin renumerar) | sí |
| Dependencias que apuntan a una tarea inexistente | ninguna |
| Ciclos en el grafo de dependencias | ninguno |
| Criterios AC1–AC11 con al menos una tarea | los 11 (AC1: 14 tareas, AC5: 3, el que menos) |
| Tareas `[P]` | T005, T006, T012: archivos disjuntos entre sí y con sus vecinas |
| Islas (15) con estados de carga, vacío y error en su done-check | 15 de 15 |
| Islas que añaden su `<div data-react-root>` | 14 de 15; T044 reutiliza el de T043 (misma sección) |
| Bloques Interfaces | T011, T012, T013, T014, T015, T016, T027, T038 |
| `rsc review ledger panel <slug>/<task> --lenses …` usado en T059 | coincide con la sintaxis de la herramienta |
| `rsc risk .github/workflows/tests.yml` | tier 2, 3 revisores, aprobación humana; la rama `feat/react-frontend` es la enlazada en la spec |

## Mapa de cobertura (spec → plan → tareas)

| REQ | Requisito de la spec (corto) | Plan | Tareas | Estado |
| --- | --- | --- | --- | --- |
| AC1 | 14 pestañas × 2 temas iguales a la referencia | §5, §6, §7 riesgo 8 | T006, T007 y una tarea de capturas por etapa | covered (referencia sobre base sembrada aparte) |
| AC2 | Etapa a medias: todo funciona y comparte ML, premio y tema | §2, §3, §4, §5 | T014–T016 y cada isla | covered (prueba del puente con HTML de la plantilla) |
| AC3 | Teclado y roles ARIA | §0, §5 | T038, T040, T044, T053 y revisión manual en cada tarea de capturas | covered |
| AC4 | Premios idénticos a lo recibido | §0 | T012, T013, T035, T043, T045, T047 | covered (relleno prohibido sobre premios, con una excepción acotada) |
| AC5 | Token de actualización | §0, §3 | T011, T054 | covered |
| AC6 | Un tipo roto falla la compilación | §3 | T008, T009, T010 | covered |
| AC7 | Migración completa en verde, sin archivos viejos | §6 etapa 10 | T052, T055, T056, T058 | covered |
| AC8 | Clon sin build muestra aviso | §3 | T003, T004 | covered |
| AC9 | CI construye, comprueba tipos y audita | §2, §5 | T002, T005, T059 | covered |
| AC10 | Pruebas por texto sustituidas sin perder cobertura | §5 | T012, T018 … T056 | covered |
| AC11 | Constitución v2.0.0 | §1 | T001 | covered |
| B-err / B-vacío | Estados de error, vacío y carga | §5 (estados obligatorios) | los done-checks de las 15 islas | covered |
| B-conv | Sin duplicar peticiones | §0, §4 | T015 | covered |
| — | Servidor de desarrollo con recarga | §2 | T056 | suposición de la spec, ya rotulada así en la tarea |

## Hallazgos resueltos de la primera pasada

| # | Sev. | Qué se hizo | Dónde |
| --- | --- | --- | --- |
| 1 | HIGH | El relleno queda prohibido **sobre premios**; única excepción `normalizarNumero` en `lib/numeroSimulador.ts`, y la guardia de T013 lo permite solo ahí | Plan §0, §5; T013, T028 |
| 2 | HIGH | La etapa 0 se hace en `feat/react-frontend` (la rama enlazada en la spec); T059 abre ese PR con el panel registrado | Plan §6, §7 riesgo 5; T059 |
| 3 | HIGH | Las capturas usan una base sembrada aparte (`sorteos_capturas`), la misma en todas las etapas; el servidor de capturas no toca la base real | Plan §5, §7 riesgo 8; T006, T007 |
| 4 | MEDIUM | La spec ahora dice «armazón al final», con entrada en `## Revisions` | Spec, Points to clarify |
| 5 | MEDIUM | T002 depende de T001 | T002 |
| 6 | MEDIUM | El principio 5 se amplía a Node; `npm audit` en el job de front y en el cierre | T001, T005, T058; plan §1, §5 |
| 7 | MEDIUM | Estados de carga, vacío, error y aislamiento exigidos a toda isla | Plan §5; 15 done-checks |
| 8 | MEDIUM | Formato de consultas en §0; `SimParams`; interfaces de T012, T013 y `Skeleton` | Plan §0; T011, T012, T013, T016 |
| 9 | MEDIUM | Las islas se descubren con `import.meta.glob`; cada tarea añade su marcado; se quitaron los `[P]` que compartían archivos | Plan §3; T016 y 14 islas |
| 10 | MEDIUM | La prueba del puente lee `templates/index.html` y sustituye sus dos `url_for` | Plan §5; T015 |
| 11 | MEDIUM | T059 lleva spec, plan y análisis a `main` junto con la etapa 0 | T059 |
| 12 | MEDIUM | Cada tarea de capturas incluye revisión manual del teclado y del tema (trace AC1, AC3) | 10 tareas de capturas |
| 13 | LOW | Vitest con `passWithNoTests` | T002 |
| 14 | LOW | Se retira la comparación por píxeles del plan; T009 compara claves en los dos sentidos y las variantes con nulos | Plan §5, §7; T009 |
| 15 | LOW | T056 rotula el servidor con recarga como suposición opcional | T056 |
| 16 | LOW | T016 ya no repite el `<script>` de T004; T008 no depende de T004 | T016, T008 |

## Hallazgos nuevos

| # | Sev. | Tipo | Artefacto A | Artefacto B | Conflicto | Resolver en |
| --- | --- | --- | --- | --- | --- | --- |
| 17 | LOW | Ambigüedad | T007 («desde `main`») | T006, que vive en esta rama | La referencia debe salir del comportamiento de `main`, pero el script de capturas está en `feat/react-frontend`. Mientras `app.js` no se toque (hasta T015) ambas dan lo mismo; conviene decir «con el servidor de esta rama antes de T015». Además, el dueño debe poder crear la base `sorteos_capturas` en su MariaDB local | tasks (T007) |
| 18 | LOW | Duplicación | Plan §2, fila de `main.tsx` («monta la isla registrada») | Plan §3 y T016 (descubrimiento automático, sin registro) | Resto de redacción de antes del cambio | plan (§2) |

## Enrutado recomendado
Ninguno bloquea. Si se quieren limpiar antes de empezar: el 17 y el 18 son dos frases (tasks y plan). Lo siguiente es `implement`, empezando por la etapa 0 en `feat/react-frontend`.

## Qué no comprobó este análisis
No ejecutó nada del código ni de las tareas: lee artefactos y los contrasta con el repositorio. Los done-checks se evaluaron por si son ejecutables en papel, no ejecutándolos. Las comprobaciones mecánicas miran la estructura de la tabla, no si el diseño es correcto.
