---
author: Rafael Williams
branch: feat/seguimiento-tarjetas
status: in-progress
---
# Seguimiento: tarjetas de «Recomendaciones congeladas» que se entienden solas

## Intent
Revisión del 2026-11-05 de la sección «Recomendaciones congeladas para el próximo sorteo». La lógica de congelar y comparar es correcta, pero la tarjeta confunde de cuatro formas:
1. No dice para qué sorteo es. Solo muestra la hora del registro.
2. Extraordinario muestra números de 4 cifras, congelados antes del PR #23, que nunca pueden acertar.
3. Sin ML, la combinada es idéntica al estadístico y se muestra como si fuera otro método.
4. No avisa de que lo congelado no cambia, aunque Predicciones se recalcule.

Decisión del dueño: aplicar los 4 puntos.

## Scope
- In:
  - `seguimiento._evaluar` → cada pendiente lleva `ultima_fecha` (el último sorteo conocido al congelar) y `numeros_aplican` (si la categoría tiene premios de 4 cifras, `_tiene_cuatro_cifras`).
  - Tarjeta:
    - «Para el próximo sorteo de <categoría> después del <fecha>». Extraordinario añade «se juega en abril, agosto y diciembre».
    - Con `numeros_aplican = false` se dice «sin números (premios de 5 cifras)», aunque la lista tenga números.
    - Sin ML, no se repite la combinada: una línea dice que es igual al estadístico.
  - Nota bajo el título de la sección: lo congelado no cambia aunque Predicciones se recalcule.
- Out: el orden de las tarjetas, marcar los registros hechos el mismo día del sorteo, los datos dudosos de la base y el marcador.

## Checklist
- [x] `ultima_fecha` y `numeros_aplican` en cada pendiente — prueba: pytest `test_pending_says_which_draw_and_if_numbers_apply` (rojo antes; incluye un registro viejo de extraordinario con números).
- [x] Tarjeta con sorteo objetivo, «sin números», combinada sin ML y nota — prueba: `node --check` OK; navegador con los datos reales (ver Evidence).
- [x] Suite completa en verde — prueba: `225 passed` (con `-W error::SyntaxWarning`).
- [x] `rsc risk` → tier 1; revisor de correctness: sin bloqueantes ni should-fix (225 passed, `node --check` OK). Comprobó tipos de `ultima_fecha`, categoría sin sorteos, XSS (todo por `esc`), respuestas viejas sin los campos nuevos y zona horaria de `formatDate`. Nit aceptado: el aviso de meses solo sale para `extraordinario` (no `extraordinaria`/`extraordonario`, que no tienen sorteos en los últimos 365 días y por eso nunca tienen registro). Los meses (abril, agosto y diciembre) los confirmó el dueño el 2026-11-05.

## Evidence
- Navegador, pestaña Seguimiento con los datos reales:
  - Nota: «Congeladas: no cambian hasta que salga su sorteo, aunque la pestaña Predicciones se recalcule…».
  - Dominical: «Para el próximo sorteo de Dominical después del 1 nov 2026.» ML, Estadístico y Combinada; peso ML 50 %.
  - Extraordinario: «… después del 16 ago 2026 (se juega en abril, agosto y diciembre).» «📊 Estadístico: sin números (premios de 5 cifras)», aunque el registro guarda 2276 · 2256 · …; sin fila de Combinada y con «Sin ML para esta categoría: la combinada es igual al estadístico.».
  - Gordito y miercolito: «después del 30 oct 2026» y «después del 5 nov 2026».

## Next
Push y PR a main.
