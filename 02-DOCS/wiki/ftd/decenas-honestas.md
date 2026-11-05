---
author: Rafael Williams
branch: fix/decenas-honestas
status: in-progress
---
# Decenas: confianza honesta, muestra mínima, backtest y datos coherentes

## Intent
Revisión del 2026-11-05, con un backtest hacia delante de 300 sorteos.

| Categoría | Acierto real (azar 10 %) | Confianza media mostrada | Coincidencias (mediana) |
| --- | --- | --- | --- |
| dominical | 9,7 % | 39 % | 5 |
| miercolito | 10,7 % | 49 % | 3 |
| gordito | 8,7 % | 63 % | 2 |
| extraordinario | 8,6 % | 57 % | 2 |

Extraordinario llegaba a mostrar «100 %» con 1 sola coincidencia. Además, se usaban datos desde 1919 y solo el 1er premio, cuando el resto usa desde 1995 y los 3 premios.

Decisión del dueño: aplicar las 4 propuestas.

## Scope
- In (`estadisticas.decena_recommendation` + la tarjeta de Decenas):
  - **Datos:** sorteos desde 1995 (`recent`).
  - **Patrón:** las decenas del 1er premio de los 3 últimos sorteos (un valor por sorteo).
  - **Lo que viene después:** las decenas de los 3 premios del sorteo siguiente, en cualquier formato, según la convención de `CLAUDE.md` (`p[-2]` en todos los formatos).
  - **Muestra mínima:** 20 sorteos coincidentes. Con menos, se baja de 3 a 2 sorteos y luego a la frecuencia general. El método se muestra siempre.
  - **Confianza** = veces más probable que el azar (proporción ÷ 10 %), con tope 15. Se muestra con el tamaño de la muestra.
  - `decena_backtest`: los últimos 200 sorteos de la categoría, recomendando solo con los anteriores. Un acierto es que la decena salga en alguno de sus premios; el azar de cada sorteo es el número de decenas distintas de sus premios ÷ 10.
  - Aviso en cada tarjeta con ese backtest, y texto del subtítulo al día.
- Out: Seguimiento (sigue sin registrar decenas), la forma visual del triángulo.
- Out (decisión del dueño, 2026-11-05): actualizar `CLAUDE.md`. Editarlo sube la rama a riesgo nivel 2 (es configuración del asistente). Su línea sobre `decena_recommendation()` queda desfasada hasta un cambio aparte.

## Checklist
- [x] Usa desde 1995 y los 3 premios como lo que viene después — prueba: pytest `test_only_draws_since_1995` (rehecho porque la primera versión pasaba con el código viejo) y `test_followers_count_the_three_prizes`.
- [x] Muestra mínima de 20, con cascada triple → par → frecuencia — prueba: pytest `test_below_minimum_*`.
- [x] Confianza = lift (1,0 con decenas uniformes; tope 15), empates deterministas — prueba: pytest `TestConfianza`.
- [x] `decena_backtest` sin mirar el sorteo objetivo, con el azar de las decenas distintas ÷ 10 — prueba: pytest `TestBacktest` (incluye `test_chance_uses_distinct_decenas`).
- [x] Tarjeta: «×N azar», muestra, método y aviso — prueba: `node --check` OK; navegador (ver Evidence).
- [x] Suite completa en verde y tiempo medido — prueba: `209 passed`; `construir_stats` 1,2 s (antes del cambio 0,8 s; 1,8 s antes de construir las listas una sola vez).
- [x] Revisor de correctness (tier 1). Hallazgo should-fix corregido: el azar contaba premios (`1 − 0,9^k`) en vez de decenas distintas. Nits corregidos: el test del «tope 15» no lo ejercía (en decenas el máximo es ×10) y el rendimiento (listas construidas una vez). Recomendaciones y aciertos idénticos tras el cambio.

## Evidence
- Rojo: 10 fallos antes del cambio.
- Datos reales: las 4 categorías caen en «frecuencia», porque con datos desde 1995 ningún patrón de 3 ni de 2 sorteos llega a 20 coincidencias.

  | Categoría | Decena | Confianza | Sorteos | Backtest |
  | --- | --- | --- | --- | --- |
  | dominical | 5 | ×1,05 | 1.531 | 27,5 % (azar 26,7 %) |
  | miercolito | 3 | ×1,06 | 1.619 | 23,5 % (azar 27,2 %) |
  | gordito | 8 | ×1,19 | 351 | 31,0 % (azar 26,6 %) |
  | extraordinario | 4 | ×1,25 | 93 | — (muy pocos sorteos) |

- Navegador: «Dominical [FRECUENCIA GENERAL] dec 5 :: ×1.05 azar · 1531 sorteos (ningún patrón llega a 20 coincidencias) · 4593 decenas // ℹ Prueba con los últimos 200 sorteos: … 27.5% … frente al 27.1% del azar». Extraordinario: «ℹ Muy pocos sorteos desde 1995 para comprobarlo».
- Antes se mostraba «33,3 %» (dominical), «14,7 %» (miercolito), «25 %» (gordito) y «100 %» (extraordinario).

## Next
Push y PR a main.
