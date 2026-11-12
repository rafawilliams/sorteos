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

## 2026-11-11 — La barra de pestañas pasa a menú lateral  (feature: frontend-react, rama feat/react-menu-navegacion)
Context   — el dueño pidió convertir las pestañas en un menú y, cuando la barra lateral se esconda, mostrar un icono de menú. La spec aprobada decía «mismo aspecto» (AC1) y excluía rediseñar.
Options    — (a) barra lateral fija con botón ☰ en pantallas estrechas; (b) menú desplegable arriba; (c) hamburguesa en todas las pantallas. Dónde: rama nueva ahora, después de la migración o dentro de la etapa 2.
Decision   — (a) en una rama nueva desde `main`, ahora. Se mantiene el mismo `<nav role="tablist">` (vertical) en vez de reescribirlo: el teclado, los ARIA, el puente y las islas no cambian; solo CSS, 3 marcas de grupo, un botón con icono y ~25 líneas de `app.js`. Punto de corte a 900 px, el mismo que ya usaba la hoja de estilos.
Why        — escala si se añaden secciones, agrupa las 14 por tipo y es el cambio de menor riesgo. Coste asumido: renovar las 28 capturas de referencia (cambia el ancho útil) con aprobación del dueño. Dos fallos que solo se vieron en un navegador real: el fondo oscuro tapaba la barra (`.app` crea su propio contexto de apilamiento) y `transition: all` en las pestañas incluía `visibility`, de modo que el foco fallaba justo al abrir.

## 2026-11-11 — Mis Números: cuatro cambios de comportamiento respecto al código antiguo  (feature: frontend-react, task: T023)
Context   — al migrar Mis Números el revisor señaló cambios que no estaban en el plan y que la decisión de T017 manda registrar aparte.
Options    — (a) reproducir el comportamiento antiguo tal cual; (b) corregir lo claramente defectuoso y registrarlo.
Decision   — (b), cuatro cambios: (1) un campo vacío ya no se rellena hasta «0000» y se añade como favorito: avisa «Ingresa un número de 4 dígitos»; (2) la lectura de `lp_favorites` descarta JSON roto, valores que no son una lista, entradas que no son de 4 cifras y repetidos, y no lanza aunque el navegador tenga bloqueado el almacenamiento; (3) si no se puede guardar se avisa con «No se pudo guardar la lista en este navegador» (y entonces no se muestra el aviso de éxito, que lo taparía: el `#toast` es uno solo); (4) la lista se resincroniza con otras pestañas del navegador por el evento `storage`, para que añadir desde una pestaña vieja no pise lo de otra. Además `normalizarNumero` se crea en T023 y no en T028, y se añade la acción de Store `simularNumero` (puente `LP.simular`) para el botón «Simular».
Why        — (1) un clic sin querer no debe crear un favorito basura; (2) el código antiguo ya toleraba JSON roto y no debe haber una regresión; (3) sin aviso la persona cree que se guardó y lo pierde al recargar; (4) el código antiguo releía el almacén en cada alta o baja. Coste: `runSimulation` (Simulador, aún código antiguo) sigue rellenando el vacío hasta «0000» hasta que T028 use `validarNumero`; `simularNumero` es una acción puente que T028 debe reimplementar sobre la isla del Simulador (o retirar).

## 2026-11-11 — El componente Chart (T027) se adelanta a la etapa 3  (feature: frontend-react, tasks: T024, T027)
Context   — el Comparador (T024, etapa 3) tiene un gráfico de barras por mes, pero el plan asignaba el componente `Chart` a T027 (etapa 4) y la fila de T024 no declaraba esa dependencia (`T022`).
Options    — (a) dejar el gráfico del Comparador en el `app.js` antiguo; (b) escribir un gráfico propio solo para esa isla; (c) adelantar T027 como tarea con su revisión y declarar la dependencia.
Decision   — (c). T027 se hace antes de T024; la fila de T024 pasa a depender de `T022, T027`. El componente registra solo los tipos de Chart.js que usa la interfaz, se destruye y recrea al cambiar tema, tipo o funciones de datos y opciones, y desactiva la animación con `prefers-reduced-motion` (también si cambia con la página abierta). Chart.js va empaquetado: el bundle pasa de 220 kB a 432 kB (140 kB gzip) y la CDN se mantiene hasta que `app.js` desaparezca.
Why        — (a) dejaba una pestaña migrada con un trozo antiguo y contradecía «una pestaña migrada no tiene ya render* en app.js»; (b) duplicaba lo que T027 iba a hacer. Un Chart.js empaquetado no cuelga de `window.Chart`, por eso el script de capturas ya emula movimiento reducido en vez de apagar la animación por el global. Quien use `Chart` debe memorizar `datos` y `opciones` (`useCallback`/constante de módulo) o el gráfico se recrea en cada render.
