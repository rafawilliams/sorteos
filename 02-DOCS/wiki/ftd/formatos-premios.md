---
author: rafawilliams
branch: fix/formatos-premios
status: done
---
# Formatos de premio: 2, 4 y 5 cifras por separado

## Intent
Después del PR #9, todos los premios se rellenaban a 4 cifras al leer. El `98` del gordito pasaba a ser `0098`. Eso inflaba el dígito 0 en las dos primeras posiciones del 2º y 3er premio, metía filas falsas en el modelo ML y producía aciertos falsos en el simulador. Los 5 dígitos del extraordinario se trataban como si fueran de 4.

## Scope
- In: `loteria.formato_premio`/`premio_en_formato` (regla de formato); `get_sorteos` en formato real; estadísticas de 4 cifras y modelo ML solo con premios de 4 cifras; terminaciones y decenas con todos los formatos; `actualizar_db.py` guarda en formato real (en el PR #9 rellenaba `98` → `0098`); `/api/stats` → `formatos`; panel «Premios de Otros Formatos» en Estadísticas; la web muestra los premios sin `padStart`.
- Out: la BD no se toca. Recomendaciones o predicciones específicas para 2 y 5 cifras.

## Checklist
- [x] Regla de formato (gordito/zodiaco 2º-3º, miercolito ≤1966, 5 cifras, ceros perdidos) — prueba: 17 casos parametrizados en `tests/test_formatos_premios.py`.
- [x] Estadísticas de 4 cifras y entrenamiento ML solo con premios de 4 cifras — prueba: tests de `_extract_numbers`, `trend_data` y `_build_df`.
- [x] Simulador/comparar: `0098` ≠ `98` y `5309` ≠ `05309`; las terminaciones sí coinciden — prueba: tests.
- [x] `actualizar_db` guarda `8` del gordito como `08` y `123` del dominical/gordito-1ro como `0123` — prueba: test.
- [x] Panel visible con datos reales — prueba: navegador (puerto 5001), tabla de resultados muestra `5312 · 62 · 88`.
- [x] Suite verde — prueba: `pytest`.

## Evidence
- `/api/stats` con la BD real: 200 en 1 min 54 s (incluye reentrenar). Formatos: 2 cifras = 1405 premios (gordito 684, miercolito 717, zodiaco 4); 5 cifras = 477 (extraordinario).
- Dígito 0 en millares del 2º premio: 16,3 % (código anterior, puerto 5000) → 10,6 % (nuevo). Tercero: 16,2 % → 10,6 %. Muestras de entrenamiento ML: 10 717 → 9 751.
- Consola del navegador: solo el 404 de `favicon.ico`, que ya ocurría antes.

## Next
Fusionado en PR #10 (2026-10-31). Nota original: PR a main. Tras fusionar, reiniciar el servidor: el modelo guardado en `models/` de la carpeta principal se entrenó con los datos mezclados. Hay que reentrenarlo con `POST /api/actualizar` o borrando `models/predictor.joblib`.
