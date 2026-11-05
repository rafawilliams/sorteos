---
author: Rafael Williams
branch: fix/sync-duplicados
status: in-progress
---
# Sincronización: no insertar sorteos con fecha corregida ni copias de otra categoría

## Intent
Investigación del 2026-11-05 contra la API (`api.loteriapanama.net`):
- **9368** (miercolito 30-09) y **9378** (01-10) son el mismo sorteo: 8674 · 6643 · 3271. La API le cambió la fecha y `filtrar_nuevos` lo tomó por nuevo, porque su clave es fecha + categoría + 1er premio.
- **9379** (miercolito 15-10) es una copia exacta del dominical del 11-10 (9371): 1548 · 7612 · 5841, letras ADAD. Es un error de la API.

Los dos meten sorteos falsos en las estadísticas, en el ML y en Seguimiento.

## Scope
- In: `actualizar_db.py`. Antes de insertar se descarta, con aviso en la salida:
  - **fecha corregida:** misma categoría y mismos 3 premios que un sorteo, guardado o ya aceptado, a ≤ 7 días;
  - **copia:** mismos 3 premios que un sorteo de **otra** categoría a ≤ 7 días.

  Solo se comparan sorteos con los 3 premios no vacíos. Los nuevos se procesan del más antiguo al más reciente, así que se queda el original.
- Out: limpiar los datos ya guardados (9379, 9368/9378, 9381 sin confirmar). Queda pendiente de confirmar las fechas en la fuente oficial. Tampoco se tocan los registros de Seguimiento.

## Checklist
- [x] Fecha corregida descartada (guardado y dentro del mismo lote) — prueba: pytest `TestFechaCorregida` (incluye alias zodiaco→gordito y premios sin ceros).
- [x] Copia de otra categoría descartada; se queda el original aunque llegue después en la lista — prueba: pytest `TestCopiaOtraCategoria`.
- [x] Sin falsos positivos: fuera de la ventana (8 días), límite de 7 días dentro, premios vacíos, mismo 1er premio con 2º/3º distintos, dos sorteos reales el mismo día, semana normal — prueba: pytest `TestSinFalsosPositivos`.
- [x] `actualizar()` usa la protección y avisa — prueba: pytest `TestActualizar` (sesión y API simuladas: 3 filas → 1 insertada, 2 avisos).
- [x] Suite completa en verde — prueba: `224 passed` (con `-W error::SyntaxWarning`).
- [x] `rsc risk` → tier 1; revisor de correctness sin bloqueantes. Should-fix corregido: una fecha rara de la API (`2026-10-01T00:00:00`, `2026-10`, `2026-13-45`) lanzaba `ValueError` y paraba la sincronización entera. Ahora esa fila no se compara y falla sola, como antes — prueba: `test_malformed_dates_do_not_abort_the_batch` (rojo sin el arreglo, verde con él).
- Límite aceptado (should-fix de diseño): se da por bueno lo ya guardado. Si lo guardado es la copia o la fecha mala, el sorteo bueno se descarta en cada sincronización, con su AVISO. Por eso hay que limpiar los sorteos malos que ya están en la base (9379, uno de 9368/9378 y los dos históricos de la Evidence).

## Evidence
- Rojo: el módulo de tests no cargaba (`descartar_sospechosos` no existía).
- Prueba en seco sobre la base real (9.298 sorteos tratados como nuevos, 0,03 s, con índice por premios): 4 descartados.
  - 2026-10-01 miercolito 8674 6643 3271 — fecha corregida (← 2026-09-30). Conocido.
  - 2026-10-15 miercolito 1548 7612 5841 — copia (← dominical 2026-10-11). Conocido.
  - 2021-06-13 dominical 5139 2401 6484 — fecha corregida (← 2021-06-06). Nuevo hallazgo.
  - 2001-05-20 dominical 1960 2767 7793 — copia (← miercolito 2001-05-16). Nuevo hallazgo.
- `rsc risk --base origin/main` → tier 1, 1 revisor.

## Next
Push y PR a main.
