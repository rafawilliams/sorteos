---
author: Rafael Williams
branch: fix/puntuacion-estadistico
status: in-progress
---
# Puntuación del estadístico: determinista y honesta

## Intent
Revisión del 2026-11-05, con datos reales:
- El top-5 estadístico cambiaba en cada cálculo. Con 5 ejecuciones, dominical dio 25 números distintos y ninguno se repitió. La causa: un Monte Carlo sin semilla sobre dígitos casi uniformes (1,10–1,18× entre el más y el menos probable).
- El bono «ya salió» (+400 por aparición) decidía el orden. El Monte Carlo solo aportaba entre 6 y 10 puntos.
- La «confianza» mostraba 99,9 % en números con probabilidad real de alrededor del 0,03 %.

Decisión del dueño: aplicar las tres propuestas. El bono «ya salió» queda como desempate (opción por defecto, porque el dueño no eligió entre desempate y quitarlo).

## Scope
- In: `estadisticas.number_recommendation`:
  - Orden por la probabilidad exacta de los 4 dígitos (producto de las frecuencias por posición, con el mismo peso por antigüedad). Sin Monte Carlo, así que es determinista.
  - Desempate por veces que ya salió y, después, por número.
  - `confidence` = cuántas veces más probable que el azar (`prob × 10⁴`; 1,0 = azar), con tope 15, igual que el ML. Campos nuevos `lift` y `veces`.
  - Frontend: la confianza de las tarjetas de números (estadístico y ML, misma escala), el panel resumen y Mensual se muestran como «×N azar».
- Out: el ML, las terminaciones, las decenas, la fórmula de pesos por antigüedad, Seguimiento.

## Checklist
- [x] Determinista: dos llamadas con los mismos datos dan lo mismo — prueba: pytest `test_deterministic`.
- [x] Orden por probabilidad exacta y desempate por «ya salió» — prueba: pytest `test_ranked_by_exact_digit_probability`, `test_already_drawn_only_breaks_ties`.
- [x] Confianza = lift, con tope 15 (1,0 con dígitos uniformes) — prueba: pytest `test_confidence_is_lift_vs_chance`.
- [x] Frontend muestra «×N azar» — prueba: `node --check` OK; navegador: panel «📊 Estadístico · ×1.36 azar || 🤖 Machine Learning · ×1.20 azar»; dominical estadístico «8357 ×1.25 azar | 8557 ×1.25 | 8757 ×1.25 | 8359 ×1.25 | 8559 ×1.24».
- [x] Suite completa en verde y datos reales estables — prueba: `188 passed`; 5 ejecuciones por categoría con el mismo top-5.
- [x] Revisor de correctness (tier 1): sin hallazgos; 188 passed. Nits aceptados: la barra se llena a partir de ×2 azar; con números de menos de 4 cifras devuelve `[]` (inalcanzable: todos los llamadores pasan solo premios de 4 cifras).

## Evidence
- Rojo: 4 fallos antes del cambio (una corrección de mi propio test: la lista «uniforme» necesitaba orden simétrico para compensar el peso por antigüedad).
- Datos reales, 5 ejecuciones: dominical, miercolito y gordito estables, unos 25 ms cada uno; `construir_stats` completo 0,5 s.
- Top-5 nuevo (número, lift, veces): dominical 8357 1,25 1 · 8557 1,25 0 · 8757 1,25 0 · 8359 1,25 0 · 8559 1,24 1; miercolito 0031 1,32 0 · 0030 · 0034 (veces 2) · 1031 · 1030; gordito 5081 3,02 · 5021 2,81 · 5083 · 5086 · 5061.
- Observaciones:
  - Al ordenar por producto, el top-5 sale muy parecido entre sí (varía 1 dígito).
  - Gordito da un lift más alto (unos 3×) porque solo tiene 351 premios de 4 cifras: es ruido de muestra pequeña, no señal.
  - Como desempate, el bono «ya salió» casi nunca actúa: los empates exactos son raros.
- `rsc risk --base origin/main` → tier 1, 1 revisor.

## Next
Push y PR a main.
