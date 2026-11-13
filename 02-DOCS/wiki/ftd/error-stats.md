---
author: rafawilliams
branch: feat/error-stats
status: in-progress
---
# Aviso y reintento cuando falla `/api/stats`

## Intent
Si `/api/stats` falla tras sus 3 intentos (límite de 180 s cada uno), las pestañas que leen `stats` se quedan para siempre en su esqueleto «Cargando…», sin mensaje ni reintento. Cierra la decisión abierta Q16 de la migración a React. Se sigue el patrón que ya existe para los sorteos (`errorSorteos`, Q12): una señal `errorStats` en el Store y un aviso con «Reintentar» en las pestañas.

## Scope
- In: `errorStats` en el contrato del Store (`tipos.ts`), en `ReactStore`, en `storeFalso` y en la suite de contrato; el hook `useErrorStats`; un componente compartido que pinta el esqueleto o el aviso con «Reintentar»; su uso en todas las pestañas que hoy se quedan en esqueleto con `stats` nulo (Predicciones, PrediccionesResumen, Decenas, Terminaciones, Estadísticas, Tendencias, Análisis, Mensual, Mis Números).
- Out: cambiar el límite de 180 s o los 3 intentos; el Simulador con `stats` nulo (Q11, decisión aparte); el backend; Q15 y las demás decisiones abiertas; mostrar el error si ya hay estadísticas viejas (se conservan, como con los sorteos).

## Checklist
- [ ] El Store pone `errorStats` a `true` cuando fallan los 3 intentos y no hay `stats`; lo baja a `false` al empezar otra carga — prueba: `reactStore.test.ts` (falla antes).
- [ ] Con `stats` ya cargadas, un fallo posterior no activa `errorStats` y conserva las viejas — prueba: `reactStore.test.ts`.
- [ ] `storeFalso` y la suite de contrato cubren `errorStats` — prueba: `storeFalso.test.ts`, `contratoStore.test.ts`.
- [ ] `useErrorStats` lee el campo — prueba: `hooks.test.tsx`.
- [ ] El componente muestra el esqueleto mientras carga y el aviso (`role="alert"`) con «Reintentar» si hay error; el botón llama a `reload` — prueba: test del componente.
- [ ] Cada pestaña del alcance muestra el aviso cuando `errorStats` es `true` y `stats` es nulo — prueba: un test por pestaña.
- [ ] Typecheck, suite de Vitest, build y `pytest` en verde — prueba: salida de los comandos.
- [ ] En el navegador, con `/api/stats` fallando, aparece el aviso y «Reintentar» recupera la página — prueba: servidor de prueba en 5001 + navegador (no ejecutado si no se llega a hacer).

## Evidence
(pendiente)

## Next
Escribir las pruebas del Store (`errorStats`) y verlas fallar.
