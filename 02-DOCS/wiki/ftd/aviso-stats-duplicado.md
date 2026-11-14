---
author: rafawilliams
branch: fix/aviso-stats-duplicado
status: in-progress
---
# Un solo aviso cuando falla `/api/stats` en Predicciones

## Intent
Cuando `/api/stats` falla, la sección Predicciones mostraba dos avisos idénticos («No se pudieron cargar las estadísticas.» + «Reintentar»): uno del panel de resumen de arriba y otro de la lista de recomendaciones. Era el nit (d) anotado en la revisión de [error-stats](error-stats.md). Debe salir uno solo.

## Scope
- In: opción `avisar` (por defecto `true`) en `EsperaStats`; `PrediccionesResumen` la usa con `false`.
- Out: el aviso de «No se pudo cargar el último sorteo» del resumen (otro fallo, otro mensaje); el resto de pestañas; el backend; los nits (b) y (c) de la revisión.

## Checklist
- [x] Con `avisar={false}` y `errorStats`, `EsperaStats` no pinta aviso ni esqueleto, conserva el `id` y sin error sigue pintando el esqueleto — prueba: `EsperaStats.test.tsx` (roja antes del cambio).
- [x] El resumen con `errorStats` no pinta aviso, botón ni esqueleto — prueba: `PrediccionesResumen.test.tsx` (la prueba anterior exigía el aviso; roja antes del cambio).
- [x] La sección Predicciones completa muestra un único `role="alert"` y un único «Reintentar» — prueba: `Secciones.test.tsx` (daba 2 antes del cambio).
- [x] Typecheck, Vitest y build en verde — ver Evidence.
- [ ] En el navegador, con `/api/stats` fallando, se ve un solo aviso — **no ejecutado**.

## Evidence
- Antes de implementar: 3 pruebas rojas (`avisar` no existía; el resumen pintaba aviso; la sección tenía 2 alertas).
- Después: `npm test -- --run` → 46 archivos, **1224 pruebas** en verde. `npm run typecheck` limpio. `npm run build` correcto. `pytest` no se ejecutó: el backend no cambia.

## Next
Revisar, subir la rama y abrir el PR. Probar en el navegador (puerto 5001, base sembrada) si se quiere.
