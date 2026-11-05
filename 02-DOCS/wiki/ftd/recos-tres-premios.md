---
author: Rafael Williams
branch: feat/recos-tres-premios
status: in-progress
---
# Recomendaciones por categoría con los 3 premios

## Intent
Las recomendaciones por categoría (estadística y bono «ya salió» del ML) solo usaban el 1er premio. Era herencia del commit inicial, sin motivo documentado. Pero el ML entrena con los 3 premios y Seguimiento puntúa contra los 3. Los 3 premios se sortean igual, así que usar solo el 1º tira dos tercios de los datos y deja a Seguimiento incoherente. Decisión del dueño (2026-11-05): usar los 3 premios de 4 cifras. No mejora la probabilidad de acierto; da coherencia y datos más estables.

## Scope
- In:
  - `by_category[cat].recommendations` (estadístico) con 1º, 2º y 3º premio de 4 cifras, el más reciente primero.
  - `cat_reco` del ML: el bono por «ya salió» cuenta los 3 premios.
  - Frontend: con una categoría elegida, las recomendaciones se rotulan «cualquier premio de 4 cifras» y se muestran con cualquier premio seleccionado.
- Out: recomendaciones generales (ya tienen selector por premio), frecuencias, calientes/fríos y radar por categoría (siguen con el 1º), la fórmula de puntuación, el entrenamiento ML.

## Checklist
- [x] Estadístico por categoría usa los 3 premios de 4 cifras (gordito: solo el 1º, porque el 2º y el 3º son de 2 cifras) — prueba: pytest `TestRecosTresPremios` (en rojo antes del cambio).
- [x] Bono ML por categoría cuenta los 3 premios — prueba: pytest `test_predict_from_probs_all_prizes_counts_third_prize` y `test_predict_from_probs_primero_ignores_other_prizes`.
- [x] Frontend rotula y muestra las recomendaciones por categoría — prueba: `node --check` OK; navegador con datos reales.
- [x] Suite completa en verde — prueba: `pytest -q -W error::SyntaxWarning` → `184 passed`.
- [x] Revisor de correctness (tier 1): sin hallazgos; 184 passed. Nit aceptado: un número repetido en dos premios del mismo sorteo suma dos veces al bono «ya salió».

## Evidence
- Rojo: 4 fallos antes del cambio; verde: `184 passed in 10.44s`.
- Navegador, estadístico: con el 1er o el 3er premio seleccionado, dominical muestra «Recomendaciones para cualquier premio de 4 cifras | 1995 0351 3927 9517 8483» y gordito «5066 9026 9324 7429 1039». Antes, con el 3er premio, una categoría mostraba «No hay suficientes datos». La vista general sigue por premio (1º: «5444 9826 4238 0074 6714»; 3º: «7795 6802 2679 2529 2917»).
- Origen de los números de dominical: 1995 (2º 2026-06-21; 3º 2002 y 1998), 0351 (3º 2019, 1º 2011, 2º 1995), 3927 (2º 2019 y 2013), 9517 (2º 2003 y 2002), 8483 (1º 2016, 2º 2014). Ahora entran el 2º y el 3º. Todos son números que ya salieron 2-3 veces: domina el bono «ya salió» de la fórmula (fuera de alcance).
- `rsc risk --base origin/main` → tier 1, 1 revisor.

## Next
Push y PR a main.
