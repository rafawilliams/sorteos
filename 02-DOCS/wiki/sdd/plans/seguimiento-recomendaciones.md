---
type: plan
title: Plan — Seguimiento de recomendaciones
description: HOW de la spec seguimiento-recomendaciones — datos, módulos, API, web, pruebas y tareas.
tags: [sdd, plan]
timestamp: 2026-10-31T13:30:00Z
topic: sdd
slug: seguimiento-recomendaciones
status: implemented (autopilot)
---

# Plan — Seguimiento de recomendaciones

Spec: [seguimiento-recomendaciones](../specs/seguimiento-recomendaciones.md)

## Arquitectura
- **Módulo nuevo `seguimiento.py`.** Contiene el modelo `Prediccion` (tabla `predicciones`), las funciones puras (comparar, pesos, combinar, valores del azar) y dos funciones con sesión inyectada: `registrar(session, sorteos, recos)` y `resumen(session, sorteos)`. `app.py` solo las llama, y así no crece más.
- **Tabla `predicciones`:** id, categoria, ultima_fecha (último sorteo de la categoría al registrar), ultimo_id (id máximo de `sorteos` al registrar), metodo (`ml`/`estadistico`/`combinada`), numeros (JSON, 5), terminaciones (JSON, 10), peso_ml, creado_en. Se crea con `checkfirst` la primera vez que se registra. No se toca la tabla `sorteos`.
- **Sorteo objetivo de un registro:** el primero, por (fecha, id), de su categoría con `id > ultimo_id` y `fecha >= ultima_fecha`. Los sorteos nuevos entran con id creciente, así que también resuelve dos sorteos del mismo día.
- **Congelado:** si la categoría tiene un registro sin sorteo objetivo todavía (pendiente), no se registra nada más. Cuando llega el objetivo, el siguiente cálculo crea el registro del próximo sorteo.
- **Categorías registradas:** las que tuvieron algún sorteo en los últimos 365 días. Así se evitan registros eternamente pendientes de categorías extinguidas (`extraordinaria`, `extraordonario`…).

## Flujo
1. `/api/stats` (cuando el caché expira) ya calcula el top-5 por categoría de ambos métodos. Además: terminaciones por categoría (estadístico: `endings_recommendation` sobre `_extract_endings(recent, cat)`; ML: `batch_predict` devuelve `cat_endings`, que sale de las mismas probabilidades por categoría).
2. `_registrar_seguro(...)` llama a `seguimiento.registrar` dentro de try/except. Si falla, solo `log.exception`; la respuesta de stats no cambia.
3. `registrar` calcula `peso_ml` con los últimos 20 sorteos comparados (proporcional; 0,5 con menos de 10; 0 sin ML) y la combinada (`combinar` por puntuación de rango ponderada), y guarda 3 filas (2 sin ML).
4. `GET /api/seguimiento` → `resumen`: sorteos comparados (recomendado frente a resultado y métricas), sin registro, pendientes (las recomendaciones congeladas actuales, incluida la combinada), marcador acumulado por método con el esperado del azar, peso vigente.

## Métricas (por método y sorteo)
- `exactos`: números del top-5 iguales a algún premio de 4 cifras. Azar: 5 × k / 10 000 (k = premios de 4 cifras).
- `terminacion_numeros`: números del top-5 cuya terminación coincide con alguna terminación de premio.
- `digitos_media`: media de dígitos coincidentes en posición sobre (número × premio de 4 cifras). Azar: 0,4.
- `terminaciones_aciertos`: de las 10 terminaciones, cuántas están entre las terminaciones de los premios (todos los formatos). Azar: 10 × d / 100 (d = terminaciones distintas). Y `alguna_terminacion` (sí/no). Azar: 1 − C(100−d,10)/C(100,10).

## Web
Pestaña nueva **«Seguimiento»**: peso vigente; recomendaciones congeladas pendientes por categoría (ML / estadístico / combinada); marcador (tabla método × medida con el azar); historial (sorteo a sorteo, con los aciertos resaltados; «sin registro» en gris). Se reutilizan `card`, `grid-2` y las tablas existentes, y se añade el ARIA de las pestañas.

## Pruebas
- `tests/test_seguimiento.py` con SQLite en memoria: métricas, pesos, combinar, objetivo, congelado, sin ML, resumen/sin registro, endpoint (monkeypatch de la sesión), fallo de registro sin romper.
- Verificación real: `/api/stats` + `/api/seguimiento` con la BD real; el registro se crea y no cambia al recalcular; navegador.

## Riesgos
- Un registro hecho después de celebrarse un sorteo, pero antes de sincronizarlo, se compara con ese sorteo. Es justo, porque el modelo no conocía el resultado, pero el usuario podría haberlo visto. Se acepta.
- El estadístico usa azar sin semilla: lo que ves en Predicciones puede diferir del registro congelado. La pestaña muestra el congelado.

## Tareas
| # | Tarea | Done-check | Depende |
|---|---|---|---|
| T1 | Funciones puras: `digitos_en_posicion`, `comparar`, `peso_ml`, `combinar`, azar | tests de métricas/pesos/combinar en verde | — |
| T2 | Modelo `Prediccion`, `objetivo`, `registrar` (congelado, sin ML) | tests SQLite de registro en verde | T1 |
| T3 | `resumen` (comparados, sin registro, pendientes, marcador) | tests de resumen en verde | T2 |
| T4 | `batch_predict` → `cat_endings`; `/api/stats` registra con `_registrar_seguro`; `GET /api/seguimiento` | tests de endpoint y de fallo seguro en verde | T3 |
| T5 | Pestaña «Seguimiento» en la web | navegador: se ve con datos reales, sin errores de consola | T4 |
| T6 | Verify con BD real + docs (CLAUDE.md, FTD/verificación) | registro creado y congelado en BD real; suite verde | T5 |
