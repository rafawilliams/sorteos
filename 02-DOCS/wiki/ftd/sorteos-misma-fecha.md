---
author: rafawilliams
branch: fix/sorteos-misma-fecha
status: in-progress
---
# Sincronización: dos sorteos el mismo día y categoría

## Intent
`actualizar_db.py` identificaba un sorteo por fecha + categoría. Si la fuente publicaba dos sorteos con la misma fecha y categoría, como el dominical del 2002-12-29 (ids de la API 4276 y 4277), el segundo no se guardaba.

## Scope
- In: `clave_sorteo(fecha, cat, primero)` = fecha + categoría + 1er premio en formato real; alias `zodiaco` → `gordito` solo para comparar claves.
- Out: no se cambian categorías guardadas en la BD. La BD no guarda el id de la API.

## Checklist
- [x] Dos sorteos del mismo día y categoría con distinto 1er premio entran los dos — prueba: tests.
- [x] El `74` de la BD y el `0074` de la API se reconocen como el mismo sorteo — prueba: test.
- [x] `zodiaco` (BD) = `gordito` (API) — prueba: test.
- [x] Ningún falso «nuevo» con datos reales — prueba: meses reales de la API contra las claves de la BD, sin insertar.
- [x] Suite verde — prueba: `pytest`.

## Evidence
- Claves únicas en la BD: 9296 de 9296 filas (con la clave vieja eran 9294: los 2 pares chocaban).
- Meses de la API frente a la BD (solo lectura): 1973-02, 2002-12, 2020-03, 1966-10, 2019-08, 1996-09 y 2026-10 → 0 nuevos. 2023-12 daba 2 «nuevos» porque la API ahora llama `gordito` a los `zodiaco` de la BD; esto también pasaba con la clave vieja. Con el alias → 0 nuevos.
- Una consulta a la API agotó el tiempo (15 s); al reintentar respondió bien.

## Next
PR a main. Riesgo conocido: si la fuente corrige el 1er premio de un sorteo ya guardado, se insertaría como sorteo nuevo. La sincronización solo consulta desde el último mes guardado, así que solo afectaría a correcciones recientes.
