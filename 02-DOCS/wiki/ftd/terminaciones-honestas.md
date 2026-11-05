---
author: Rafael Williams
branch: feat/terminaciones-honestas
status: in-progress
---
# Terminaciones: confianza honesta, por categoría y con su backtest a la vista

## Intent
Revisión del 2026-11-05 con datos reales. En un backtest hacia delante de 300 sorteos, el top-10 estadístico de terminaciones acierta como el azar:

| Categoría | Sorteos con al menos 1 acierto | Azar |
| --- | --- | --- |
| dominical | 26,7 % | 27,2 % |
| miercolito | 23,3 % | 27,1 % |
| gordito | 23,7 % | 27,0 % |

Hay tres problemas más:
- La confianza del estadístico es relativa: la primera terminación siempre marca 99,9 %.
- La del ML usa `prob × 1000`, con tope 15: una terminación igual de probable que el azar se ve como «10 %».
- La pestaña mezcla todas las categorías, pero Seguimiento congela las terminaciones de cada categoría.

Decisión del dueño: aplicar las 3 propuestas.

## Scope
- In:
  - `confidence` de las terminaciones = veces más probable que el azar (1,0 = 1 %). Estadístico: peso de la terminación ÷ peso total × 100. ML: `prob × 100`. Tope 15 en los dos. Campo nuevo `lift`.
  - `/api/stats` → `endings_by_category[cat]` con `recommendations` (estadístico), `ml_recommendations` (ML) y `backtest` (últimos 200 sorteos de la categoría desde 1995, recomendando solo con los anteriores).
  - Pestaña Terminaciones: selector de categoría para las recomendaciones; «×N azar»; aviso con el backtest de la categoría elegida.
  - Texto «¿Cómo funciona?» de Predicciones: quitar «Se generan 50,000 combinaciones», obsoleto desde el PR #25.
- Out: calientes/fríos, mapa de calor, por premio y tendencias de terminaciones (siguen generales); Seguimiento; decenas.

## Checklist
- [x] Confianza estadística = lift (1,0 con terminaciones uniformes; tope 15) — prueba: pytest `TestConfianzaEstadistica` (orden sin cambios: `test_ranking_unchanged`, verde también antes).
- [x] Confianza ML = `prob × 100` — prueba: pytest `TestConfianzaML`.
- [x] `endings_backtest` calcula aciertos frente al azar sin mirar el sorteo objetivo — prueba: pytest `TestBacktest` (incluye `test_target_draw_is_not_used_to_recommend`).
- [x] `endings_by_category` en `construir_stats` — prueba: pytest `TestPorCategoria`.
- [x] Frontend: selector, «×N azar» y aviso — prueba: `node --check` OK; navegador (ver Evidence).
- [x] Suite completa en verde y tiempo medido — prueba: `197 passed`; `construir_stats` 0,8 s (antes 0,5 s).
- [ ] Revisor de correctness (tier 1) — en curso.

## Evidence
- Rojo: 8 fallos antes del cambio. Dos fallos posteriores eran de mis tests, no del código: tolerancia de redondeo, y un fixture con 60 sorteos cuando el backtest exige ≥ 230.
- Backtest de 200 sorteos con datos reales (al menos 1 acierto):

  | Categoría | Aciertos | Al menos 1 acierto |
  | --- | --- | --- |
  | dominical | 57 (azar 59,5) | 26,5 % (azar 27,1 %) |
  | miercolito | 50 (azar 59,3) | 22,0 % (azar 27,1 %) |
  | gordito | 47 (azar 59,1) | 23,0 % (azar 27,0 %) |

  Extraordinario y zodiaco no tienen datos suficientes (None).
- Navegador:
  - Todos «39 ×1.24 azar | 79 ×1.23 | 58 ×1.19 | 03 ×1.16», con el aviso general.
  - Dominical «56 ×1.37 azar | 58 ×1.30 | 30 ×1.28 | 03 ×1.28», con el aviso del backtest.
  - Zodiaco «×15.00» (tope) con el aviso «muy pocos sorteos (6 terminaciones)».
  - ML de dominical «71 ×1.26 | 75 ×1.22 | 70 ×1.18 | 41 ×1.17».
  - «¿Cómo funciona?» ya dice «probabilidad exacta».
- `rsc risk --base origin/main` → tier 1, 1 revisor.

## Next
Esperar al revisor; después commit, push y PR.
