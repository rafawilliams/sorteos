---
author: rafawilliams
branch: feat/error-stats
status: done
merged: 2026-11-14
pr: #63
---
# Aviso y reintento cuando falla `/api/stats`

## Intent
Si `/api/stats` falla tras sus 3 intentos (límite de 180 s cada uno), las pestañas que leen `stats` se quedaban para siempre en su esqueleto «Cargando…», sin mensaje ni reintento. Cierra la decisión abierta Q16 de la migración a React. Se sigue el patrón que ya existe para los sorteos (`errorSorteos`, Q12): una señal `errorStats` en el Store y un aviso con «Reintentar» en las pestañas.

## Scope
- In: `errorStats` en el contrato del Store (`tipos.ts`), en `ReactStore`, en `storeFalso` y en la suite de contrato; el hook `useErrorStats`; un componente compartido (`EsperaStats`) que pinta el esqueleto o el aviso con «Reintentar»; su uso en todas las pestañas que se quedaban en esqueleto con `stats` nulo (Predicciones, PrediccionesResumen, Decenas, Terminaciones, Estadísticas, Tendencias, Análisis, Mensual, Mis Números).
- Out: cambiar el límite de 180 s o los 3 intentos; el Simulador con `stats` nulo (Q11, decisión aparte); el backend; Q15 y las demás decisiones abiertas; mostrar el error si ya hay estadísticas viejas (se conservan, como con los sorteos).

## Checklist
- [x] El Store pone `errorStats` a `true` cuando fallan los 3 intentos y no hay `stats`; lo baja a `false` al empezar otra carga — prueba: `reactStore.test.ts` (7 pruebas fallaban antes del cambio, ahora pasan).
- [x] Con `stats` ya cargadas, un fallo posterior no activa `errorStats` y conserva las viejas — prueba: `reactStore.test.ts`.
- [x] `storeFalso` y la suite de contrato cubren `errorStats` — prueba: `storeFalso.test.ts`, `contratoStore.test.ts` (la comprobación nueva y 3 mutantes que la hacen fallar).
- [x] `useErrorStats` lee el campo — prueba: `hooks.test.tsx`.
- [x] El componente muestra el esqueleto mientras carga y el aviso (`role="alert"`) con «Reintentar» si hay error; el botón llama a `reload` y pasa el foco al contenedor — prueba: `EsperaStats.test.tsx` (6 pruebas; fallaban antes por no existir el componente).
- [x] Cada pestaña del alcance muestra el aviso cuando `errorStats` es `true` y `stats` es nulo — prueba: una prueba por pestaña, 9 (fallaban antes del cambio).
- [x] Typecheck, suite de Vitest, build y `pytest` en verde — prueba: ver Evidence.
- [x] Revisión tier 1 con un revisor de contexto limpio — Approved, sin blockers ni should-fix.
- [x] En el navegador, con `/api/stats` fallando, aparece el aviso y «Reintentar» recupera la página — prueba: servidor en el puerto 5001 con la base sembrada `sorteos_capturas` (600 sorteos), ver Evidence.

## Evidence
- `npx vitest run src/store/reactStore.test.ts` antes de implementar: 7 pruebas rojas (todas por falta de `errorStats`). Las 9 pruebas de pestañas: 9 rojas. `EsperaStats.test.tsx`: error de importación (el componente no existía).
- Después: `npm test -- --run` → 46 archivos, **1222 pruebas** en verde (1213 antes de añadir el contrato y el hook). `npm run typecheck` limpio. `npm run build` correcto. `pytest -q -W error::SyntaxWarning` → 569 passed, 11 skipped.
- `npx @ericrisco/rsc risk` → tier 1 (clases `default` y `docs`), 1 revisor, sin aprobación humana.
- Revisión (un revisor, lente correctness): Approved. Comprobó que `errorStats` no queda en `true` con `stats` presente ni en `false` tras un fallo definitivo, que pedir una recarga mientras corre otra devuelve la misma promesa, que `aria-controls` sigue apuntando al `id` en los dos estados, y que ninguna pestaña del alcance quedó en esqueleto sin aviso.
- Nits del revisor, **anotados sin cambios** (ninguno altera el comportamiento):
  - (d) La sección Predicciones monta `PrediccionesResumen` y `Predicciones` a la vez: con `errorStats` salen dos avisos y dos «Reintentar» con el mismo texto. Es redundante, no incorrecto.
  - (b) Tras un «Reintentar» con éxito el contenedor enfocado se desmonta y el foco vuelve a `<body>` (el mismo comportamiento que ya tiene Resultados).
  - (c) En Mis Números el `role="alert"` queda dentro de una región `aria-live="polite"`; puede anunciarse dos veces.
  - Un suscriptor que llamara a `reload()` dentro del aviso de `cambiar({ errorStats: false })` arrancaría una segunda carga; hoy ninguno lo hace.

- Prueba en el navegador (2026-11-14), servidor en el 5001 con `/api/sorteos` → `total` 600 (no la base real) y `/api/stats` forzado a 500: la página mostró «No se pudieron cargar las estadísticas.» con «Reintentar» tras 3 respuestas 500 (consola). Al quitar el fallo y pulsar «Reintentar», `/api/stats` respondió 200 y Predicciones mostró las recomendaciones. El nit (d) se vio tal cual: dos avisos iguales en Predicciones.

## Next
Fusionado en main el 2026-11-14 (c334313).
