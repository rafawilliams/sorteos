---
author: Rafael Williams
branch: test/decenas-limites
status: in-progress
---
# Decenas: tests de los límites que el revisor señaló

## Intent
En el PR #27 (decenas honestas), el revisor de tests señaló huecos. Este cambio los cubre sin tocar el código de la app:
- el mínimo de 20 no se probaba justo en su límite;
- el test del par solo comprobaba `>= 20`;
- no había empates en los patrones de 3 y de 2;
- no se probaba que otras categorías quedasen fuera;
- no había premios de 2 ni de 5 cifras.

## Scope
- In: `tests/test_decenas_limites.py`.
- Out: cambios en `estadisticas.py`. Si un test descubre un fallo, se para y se pregunta.

## Checklist
- [x] 20 coincidencias → triple; 19 → par, con el número exacto de coincidencias del par (24); par por debajo → frecuencia — prueba: `TestMinimoEnSuLimite`; mutante `<` → `<=`: 2 fallos.
- [x] Empates en el triple y en el par → el dígito más pequeño — prueba: `TestEmpates`; mutante «desempate por el mayor»: 2 fallos.
- [x] Otras categorías no cuentan — prueba: `test_other_categories_do_not_count`; mutante «sin filtro de categoría»: 1 fallo.
- [x] Seguidoras de 2 cifras (gordito) y de 5 cifras (extraordinario; «05309» → 0, no 3) — prueba: `test_two_digit_*`, `test_five_digit_*`; mutante «seguidoras solo del 1er premio»: 2 fallos.
- [x] Suite completa en verde — prueba: `261 passed` (con `-W error::SyntaxWarning`).
- [x] Revisor de tests (tier 1): sin bloqueantes. Sobrevivían 3 mutantes y un nit, ya cubiertos con 3 tests nuevos y comprobados contra la suite completa:
  - patrón de 1 dígito en vez de par → `test_pattern_length_is_two_not_one`;
  - saltarse la última ventana (patrones que se solapan, p. ej. 5-5-5) → `test_overlapping_windows_count_up_to_the_last_draw`;
  - mínimo fijo a 20, ignorando el parámetro → `test_custom_minimum_is_honoured`.
  - Quitar el filtro desde 1995 no sobrevive a la suite completa: lo detecta el `test_only_draws_since_1995` que ya existía (el revisor solo pasó este archivo).

## Evidence
- 11 tests nuevos; verdes con el código actual (no destapan ningún fallo).
- 7 mutantes temporales en `estadisticas.py` (4 propios y 3 del revisor), todos detectados (restaurado con `git checkout` tras cada uno).
- `rsc risk --base origin/main` → tier 1 (los tests cuentan como código): 1 revisor.

## Next
Push y PR a main.
