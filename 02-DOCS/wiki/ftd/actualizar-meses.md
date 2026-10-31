---
author: rafawilliams
branch: fix/actualizar-meses
status: in-progress
---
# actualizar_db.py: consultar desde el último sorteo hasta hoy

## Intent
`actualizar_db.py` tiene fijos los meses 2026-02 y 2026-03 y el rango 2026-02-19..2026-03-22. El botón "Actualizar datos" nunca trae sorteos de otros meses.

## Scope
- In: `meses_a_consultar(desde, hasta)` (meses entre el último sorteo y hoy, ambos incluidos); `filtrar_nuevos(data, existentes, hasta)` (sin duplicados por fecha+categoría, sin fechas futuras ni vacías); BD vacía → mes actual; argumento opcional `--desde YYYY-MM`.
- Out: rellenar el `zfill(4)` de premios guardados sin ceros (p. ej. "62"), reintentos de red.

## Checklist
- [x] `meses_a_consultar` cubre mismo mes, cambio de año y desde > hasta — prueba: `tests/test_actualizar_db.py`.
- [x] `filtrar_nuevos` descarta existentes, futuros, sin fecha y duplicados dentro de la respuesta — prueba: tests.
- [x] Sin meses fijos en el código — prueba: `grep "2026" actualizar_db.py` vacío.
- [x] Suite verde local y en CI — prueba: `pytest` + check del PR.
- [x] Ejecución real contra la API — prueba: salida de `python actualizar_db.py` (depende de que la API responda).

## Evidence
- `tests/test_actualizar_db.py` (9 tests): error de import antes; suite local `73 passed` después.
- `grep 2026 actualizar_db.py`: sin resultados.
- Ejecución real: último sorteo 2026-10-30 → consulta `2026-10`; API devolvió 10; insertó 2 que faltaban (miercolito 2026-10-01 y 2026-10-15).
- Segunda ejecución: `0 sorteos insertados` (sin duplicados).
- CI: ver check del PR.

## Next
PR a main.
