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
- [x] Suite completa en verde — prueba: `258 passed` (con `-W error::SyntaxWarning`).

## Evidence
- 8 tests nuevos; verdes con el código actual (no destapan ningún fallo).
- 4 mutantes temporales en `estadisticas.py`, todos detectados (restaurado con `git checkout` tras cada uno).
- `rsc risk --base origin/main` → tier 1 (los tests cuentan como código): 1 revisor.

## Next
Push y PR a main.
