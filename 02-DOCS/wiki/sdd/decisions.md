# SDD decisions (append-only)

## 2026-10-31 — seguimiento-recomendaciones: alcance
- Objeción planteada: los sorteos son independientes y el backtest da ML y estadístico al nivel del azar; comparar no mejora la predicción.
- Decisión del dueño: marcador + ponderación de métodos (no reentrenar con errores).
- Se registra: top-5 por categoría y 10 terminaciones, por método (ML, estadístico, combinada). Decena fuera.
- Registro automático: el primero calculado tras el último sorteo de la categoría, congelado.
- Acierto de número: exacto en cualquier premio de 4 cifras.
- Ponderación: «Combinada» nueva, por media de dígitos en su posición en los últimos 20 sorteos comparados; 50/50 con menos de 10.
- 2026-10-31 — clarify: pesos proporcionales; azar teórico y «próximo sorteo» confirmados; rama feat/seguimiento; autopilot.

## 2026-11-01 — constitution: ratificación v1.0.0
- Opciones de barra de calidad: (1) mantener `pytest -W error::SyntaxWarning` + `pip-audit` + `node --check`; (2) añadir Ruff; (3) añadir Ruff + mypy. Elegida la opción 1 para reflejar el gate actual de CI sin añadir dependencias nuevas.
- Contradicción resuelta en §4 Branching: el borrador de onboarding indicaba `--workflow main`, pero el repositorio trabaja con `main` protegido y PRs (#1–#14). Se ratifica rama dedicada + Pull Request con CI en verde.
- Ratificada `02-DOCS/wiki/sdd/constitution.md` en versión `v1.0.0` (16 principios numerados y verificables + Definition of Done).

## 2026-11-02 — modularizar-backend: alcance y modo
- Objeción planteada: para el usuario final no cambia ningún comportamiento visible y mover código entre archivos puede romper importaciones de tests si no se reexporta.
- Opciones consideradas: (1) modularizar solo el backend (`app.py` → `estadisticas.py` + `app.py`); (2) modularizar backend y frontend (`static/app.js`); (3) no hacerlo ahora.
- Decisión del dueño: opción 1 (solo backend) y ejecución de la cadena SDD en autopilot en la rama `chore/modularizar-backend`.

## 2026-11-02 — mejoras-ui-esferas: alcance, dirección estética y modo
- Objeción planteada: un rediseño visual no altera el poder predictivo ni añade datos nuevos y puede afectar selectores DOM, accesibilidad o el tema claro si no se acota.
- Áreas elegidas por el dueño: B (Estética y tarjetas), C (Dashboard principal) y D (Gráficos, mapas de calor y tablas), descartando cambiar la barra de 14 pestañas (A).
- Opciones estéticas consideradas: (1) Gala & Billete Editorial (casillas cuadradas); (2) Esferas de Sorteo / Bolillero 3D (`.lotto-ball`); (3) Terminal Analítica Quant; (4) No construirlo.
- Decisión del dueño: Opción 2 (Esferas de Sorteo / Bolillero 3D) y ejecución en autopilot en la rama `feat/mejoras-ui-esferas`.
- 2026-11-02 — ship: elegida la Opción 2 (Pull Request) por el dueño; rama `feat/mejoras-ui-esferas` subida y PR #21 abierto (`https://github.com/rafawilliams/sorteos/pull/21`).

## 2026-11-11 — frontend-react: alcance y modo
- Objeción planteada: el usuario final no ve ningún cambio; React exige build con Node, la constitución v1.0.0 (principio 1) prohíbe bundlers y frameworks JS, y el 2026-11-02 se había descartado modularizar el frontend.
- Opciones consideradas: (a) no hacerlo; (b) módulos ES nativos sin framework; (c) React con migración total de una vez; (d) React pestaña a pestaña.
- Decisión del dueño: enmendar la constitución (MAJOR, v2.0.0), React con TypeScript, migración pestaña a pestaña, flujo con parada de aprobación en cada fase (sin autopilot). Rama `feat/react-frontend`.

## 2026-11-11 — frontend-react: decisiones del plan
- Convivencia: islas React sobre el armazón legacy con una interfaz `Store` como costura (`LegacyStore` sobre un puente `window.LP`); descartado «React dueño del armazón desde el primer día» (primera etapa enorme y puente inverso frágil).
- Build: Vite + TypeScript, salida con nombre fijo en `static/dist/` (no se commitea); Flask muestra un aviso si falta. Bucle de desarrollo: `build --watch`; servidor con recarga diferido a la etapa final.
- Chart.js: se empaqueta con el build (resuelve la decisión diferida de la spec); la CDN se quita en la etapa final.
- Contrato de la API: fixtures reales por endpoint (incluye variantes con nulos) + test pytest de estructura + `satisfies` en TypeScript.
- Pruebas: Vitest + Testing Library con doble de `Chart`; capturas con Playwright solo en local.
- Orden: Gaps → Seguimiento → Mis Números/Comparador → Simulador/Mensual → Precisión → Resultados → Decenas/Terminaciones → Predicciones → Estadísticas/Tendencias/Análisis → armazón. Etapas en serie porque todas editan `app.js` e `index.html`.
- Riesgo: la etapa 0 toca el workflow de CI (tier 2): panel de revisores y aprobación humana.

## 2026-11-11 — frontend-react: correcciones tras el análisis
- Primer `analyze`: BLOCKED (3 HIGH, 9 MEDIUM, 4 LOW). Corregidos los 16 en plan, tareas, constitución (alcance de T001) y spec; segunda pasada: PASS con 2 LOW.
- Decisión: la etapa 0 se hace en `feat/react-frontend` (spec vinculada a esa rama por el requisito tier 2 de `rsc`); su PR lleva también spec, plan y análisis (T059).
- Decisión: capturas contra una base sembrada aparte (`sorteos_capturas`) para no tocar datos reales ni la tabla `predicciones`.
- Decisión: relleno con ceros prohibido solo sobre premios; excepción acotada al número que teclea el usuario en el Simulador.
- Decisión: descubrimiento automático de islas (`import.meta.glob`); se quitan los `[P]` que compartían archivos.
- Cambio de spec (validado por el dueño al pedir la corrección): el armazón migra al final, no al principio.

## 2026-11-11 — sdd-init: calibración del runtime SDD
- Creado `02-DOCS/wiki/sdd/config.yaml`: strict TDD con pytest, modo interactivo, enrutado de modelos apagado.
- Presupuesto de revisión: el dueño eligió 900 líneas por PR (opciones: 400 por defecto o 900); el presupuesto de archivos sube de 12 a 25 por coherencia. Entrega `ask-on-risk`.
- Los comandos de front (tipos, pruebas, build) se añadirán a `testing.commands` con la tarea T002.

## 2026-11-11 — T004: comprobación de la API sin build  (feature: frontend-react, task: T004)
Context   — el done-check pedía que `/api/stats` siga respondiendo 200 sin el build.
Options    — (1) `/api/stats`; (2) `/api/sorteos?page=1&per_page=1`.
Decision   — se usa `/api/sorteos`.
Why        — `/api/stats` entrena el modelo (50-100 s) y registra filas en `predicciones` de la base real al correr en local; `/api/sorteos` demuestra igual que `/api/*` no depende del build y no escribe.

## 2026-11-11 — Mensaje genérico «Error del servidor» en el cliente de API  (feature: frontend-react, task: T011)
Context   — el plan fija `'Error de conexión'` y el `error` público del servidor, pero un 500 de `/api/stats`, `/api/gaps` o `/api/backtesting` y un 429 devuelven HTML de Flask, sin `error` público que mostrar.
Options    — (a) usar `'Error de conexión'` para todo; (b) mostrar el texto del cuerpo o de la excepción; (c) un segundo mensaje genérico para «el servidor respondió con error».
Decision   — (c): `'Error del servidor'` para toda respuesta de error sin `error` público aceptable (texto de hasta 200 caracteres, solo en `/api/comparar`, `/api/simulador` y `/api/actualizar`).
Why        — (a) confunde al usuario (la red funciona) y (b) puede filtrar trazas o datos internos; (c) distingue el fallo sin mostrar nada interno.

## 2026-11-11 — Estados de carga y vacío de las islas siguen al código antiguo  (feature: frontend-react, task: T017)
Context   — al migrar Gaps, el autor añadió un spinner propio y textos de vacío nuevos; el revisor señaló que el plan §5 pide esqueleto en la carga y «el mismo mensaje que muestra hoy app.js» en el vacío.
Options    — (a) conservar spinner y textos nuevos; (b) seguir el plan: `Skeleton` en la carga, vacío sin mensajes nuevos.
Decision   — (b). La carga se anuncia con `role="status"` y `aria-label` alrededor de los esqueletos, sin `aria-busy`; al reintentar el foco pasa a la región.
Why        — el plan está aprobado y mantiene la equivalencia visual con la referencia (AC1); un cambio de texto o de marcado se decide aparte, no se cuela en una migración.
