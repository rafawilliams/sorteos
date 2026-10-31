---
author: rafawilliams
branch: fix/datos-premios
status: in-progress
---
# Datos de premios: vacíos que contaban como 0000 y formato al leer

## Intent
La revisión vio premios con menos de 4 cifras, 59 sorteos sin 2º/3er premio y 2 pares con la misma fecha y categoría. La idea era normalizar la BD. Al mirar los datos se vio que casi todos los premios cortos son formatos reales, y que el fallo real estaba en el código: un premio vacío contaba como `0000`.

## Scope
- In: `loteria.normalizar_premio` (4 cifras; vacío → `""`); `app._row_to_dict` normaliza al leer; `/api/simulador` y `/api/comparar` ignoran premios vacíos; las terminaciones aceptan premios de 1 cifra; `actualizar_db.fila_a_loteria` normaliza los sorteos nuevos; `CLAUDE.md` describe los formatos reales.
- Out: no se modifica la BD (decisión del dueño). Estadísticas que mezclan formatos de 2, 4 y 5 cifras. Clave fecha+categoría de `actualizar_db.py`.

## Checklist
- [x] Premio vacío ≠ `0000` en simulador y comparar — prueba: tests fallan con el `app.py` anterior (`assert 4 == 0`) y pasan con el nuevo.
- [x] Premio de 1 cifra cuenta como terminación (`"7"` → `07`) — prueba: test (falla con el `app.py` anterior).
- [x] `get_sorteos` devuelve 4 cifras o `""` — prueba: test `_row_to_dict`.
- [x] `actualizar_db.py` guarda premios nuevos con 4 cifras — prueba: test `fila_a_loteria`.
- [x] Los 2 «duplicados» son sorteos reales — prueba: la API devuelve ids 562/566 (1973-02-07) y 4276/4277 (2002-12-29).
- [x] Suite verde — prueba: `pytest`.

## Evidence
- BD (9296 sorteos, solo lectura): 244/612/616 premios cortos. Gordito ≥1996: 338/339 con 2º y 3º de 2 cifras. Miercolito 1962–67: ~240 con 2 cifras. Extraordinario: 162 con 5 cifras. Vacíos: 57 gordito 1991–95 y 2 extraordinario 1940. Ningún valor no numérico.
- Verificación (base `39346a7` + cambios sin commit): `pytest` 90 passed; `pip-audit --ignore-vuln PYSEC-2026-217` (igual que el CI) sin vulnerabilidades; `py_compile` ok. Sin linter instalado (ruff/pyflakes): no se ejecutó.
- BD real con el código nuevo: `/api/simulador?numero=0000` → 19 exactos (antes 137 medido con el `app.py` anterior = 19 + 118 premios vacíos; terminación `00`: 423 → 305). Los 19 incluyen terceros `00` del gordito rellenados a `0000`: problema de formato previo, tarea aparte.
- Simulación de normalizar la BD: 649 filas cambiarían, entre ellas el `98`/`00` del gordito 2019-05-31. Descartado: cambiaría el significado del premio.

## Next
PR a main. Tareas aparte: (1) estadísticas por formato (2/4/5 cifras); (2) `actualizar_db.py` no guardaría un segundo sorteo con la misma fecha y categoría.
