---
author: Rafael Williams
branch: fix/seguimiento-registro
status: in-progress
---
# Seguimiento: registro fiable y sin números imposibles

## Intent
La revisión de Seguimiento del 2026-11-05 encontró tres fallos en el registro:
1. En extraordinario se congelan números de 4 cifras, pero sus premios son de 5 cifras desde 1995. Esos números nunca pueden acertar, y la especificación deja fuera los premios de 5 cifras.
2. Dos cálculos a la vez pueden congelar dos registros del mismo sorteo, y la pestaña muestra el segundo. Rompe la regla de «queda congelado el primero».
3. Solo se registra al abrir la web. Si nadie entra entre una sincronización y el siguiente sorteo, ese sorteo queda sin registro.

Dato del dueño (2026-11-05): el extraordinario solo se juega en abril, agosto y diciembre. El registro de extraordinario espera hasta el siguiente de esos meses; `DIAS_CATEGORIA_ACTIVA = 365` cubre los 4 meses entre sorteos.

## Scope
- In:
  - Sin premios de 4 cifras en sus sorteos recientes, una categoría congela solo terminaciones.
  - Un sorteo sin premios de 4 cifras no puntúa en las medidas de números: se muestra «no aplica» y no cuenta en el marcador. Así también se trata bien el registro de extraordinario que ya existe.
  - Índice único (categoría, último id, método) y manejo del choque sin error.
  - Registrar al terminar `POST /api/actualizar` y al terminar `python actualizar_db.py` cuando entran sorteos nuevos (`--sin-seguimiento` para saltarlo; el endpoint lo pasa para no calcular dos veces).
- Out: cambiar la fórmula de pesos, las medidas existentes de categorías con 4 cifras, o borrar o editar filas ya guardadas en `predicciones`.

## Checklist
- [x] Fallo 1: tests de registro (extraordinario sin números) y de comparación («no aplica», fuera del marcador) — prueba: pytest (`TestSinCuatroCifras`, en rojo antes del arreglo).
- [x] Fallo 2: test de registro duplicado (segunda inserción rechazada, sin excepción, el primero intacto) e índice añadido a una tabla vieja — prueba: pytest (`TestRegistroDuplicado`).
- [x] Fallo 3: tests de registro tras `/api/actualizar` y del flag del script — prueba: pytest (`TestActualizarSeguimiento`, `TestMainSeguimiento`, `test_calcular_stats_registers_and_caches`).
- [x] Frontend muestra «no aplica» en vez de «0 exactos» — prueba: `node --check` OK; navegador con datos simulados de extraordinario y con los datos reales.
- [x] Suite completa — prueba: `pytest -q -W error::SyntaxWarning` → `179 passed`.
- [x] Revisor de correctness (tier 1): sin bloqueantes. Arreglados sus 2 should-fix: índice único protegido ante filas duplicadas (test `test_existing_duplicates_do_not_break_the_tab`) y registro tras actualizar saltado si el modelo no está entrenado (test `test_skips_registration_when_model_is_not_trained`). Aceptados como nits: un choque descarta todo el lote (se reintenta en el siguiente cálculo); el script usa el modelo guardado en disco.
- [ ] `pip-audit` — falla por `mariadb 1.1.14 PYSEC-2026-217`, sin versión corregida publicada. Ya estaba en `main`: este cambio no toca `requirements.txt`.
- [x] Índice único creado sobre la tabla real sin errores — prueba: `seguimiento.resumen()` contra MariaDB → `indices unicos ['uq_predicciones_registro']`.

## Evidence
- Rojo: 10 fallos + 11 errores antes del arreglo; verde: `177 passed in 8.35s`.
- MariaDB: 4 pendientes como antes; marcador estadístico `sorteos 1, sorteos_numeros 1, exactos 0, digitos_media 0.2`, igual que antes del cambio.
- Navegador (datos simulados): pendiente «sin números (premios de 5 cifras)»; marcador «—» en números exactos y terminación de números; historial «números: no aplica · term. 2/10 (86 53)».
- Navegador (datos reales): 1 comparado, 4 esperando, 0 sin registro; dominical 01-11 «0 exactos · dígitos 0.53 · term. 0/10».
- `rsc risk --base origin/main` → tier 1, 1 revisor, sin aprobación humana.
- El registro de extraordinario del 31-10 conserva sus 5 números (no se editan filas); al compararse en diciembre saldrán como «no aplica».

## Next
PR a main.
