# Knowledge map

## datos
- [Categorías de sorteo](datos/categorias.md) — qué sorteos hay, sus otros nombres en la API (extraordinaria/extraordonario = extraordinario, zodiaco = gordito) y cuándo se juegan.

## sdd/specs
- [Seguimiento de recomendaciones](sdd/specs/seguimiento-recomendaciones.md) — registrar lo recomendado antes de cada sorteo, compararlo con el resultado, marcador frente al azar y ponderación ML/estadístico.
- [Modularizar el backend](sdd/specs/modularizar-backend.md) — separar el cálculo estadístico puro (`estadisticas.py`) de la capa HTTP/caché/BD (`app.py`).
- [Una sola categoría por sorteo](sdd/specs/categorias-unicas.md) — juntar las grafías de extraordinario y el zodiaco con el gordito al leer y al guardar.
- [Mejoras de UI (Esferas de Sorteo, Dashboard y Visualización)](sdd/specs/mejoras-ui-esferas.md) — esferas 3D para números y premios, panel protagonista del último sorteo en el Dashboard y mejoras en mapas de calor y tablas.
- [Migrar el front-end a React](sdd/specs/frontend-react.md) — reemplazar la interfaz vanilla JS por React + TypeScript, pestaña a pestaña, sin cambiar la API ni lo que se ve; enmienda MAJOR de la constitución.

## sdd
- [Plan — Seguimiento de recomendaciones](sdd/plans/seguimiento-recomendaciones.md)
- [Plan — Modularizar el backend](sdd/plans/modularizar-backend.md)
- [Plan — Mejoras de UI (Esferas de Sorteo, Dashboard y Visualización)](sdd/plans/mejoras-ui-esferas.md)
- [Plan — Migrar el front-end a React](sdd/plans/frontend-react.md)
- [Análisis — Migrar el front-end a React](sdd/analysis/frontend-react.md)
- [Verificación — Seguimiento (2026-10-31)](sdd/verifications/seguimiento-recomendaciones-2026-10-31.md)
- [Verificación — Modularizar el backend (2026-11-02)](sdd/verifications/modularizar-backend-2026-11-02.md)
- [Verificación — Mejoras de UI (2026-11-02)](sdd/verifications/mejoras-ui-esferas-2026-11-02.md)
- [Decisiones SDD](sdd/decisions.md)
- [Constitución (v2.0.0)](sdd/constitution.md)

## ftd
- [Documentos de tareas FTD](ftd/) — una página por cambio fusionado (PRs #1–#13).
