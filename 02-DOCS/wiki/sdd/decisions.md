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

## 2026-11-11 — Comparador: las celdas de la tabla se ven sin fuente monoespaciada, como hoy  (feature: frontend-react, task: T026)
Context   — al comparar las capturas con datos del Comparador (código antiguo frente a la isla), 6.465 píxeles diferían en la tabla: en `renderCompResults` el `style` de las celdas era `text-align:center;font-family:"JetBrains Mono";` dentro de un atributo entre comillas dobles, de modo que el navegador lo cortaba en la segunda comilla y las celdas se veían con la fuente por defecto, no con la monoespaciada que se pretendía.
Options    — (a) reproducir lo que se ve hoy (sin fuente propia en las celdas de valores); (b) usar la monoespaciada pretendida y que la captura difiera.
Decision   — (a). Las cabeceras de número conservan la monoespaciada, como hoy. Una prueba fija las dos cosas.
Why        — el criterio de la migración es que se vea igual (AC1) y la referencia aprobada es lo que ve la persona; cambiar la tipografía de una tabla se decide aparte, no se cuela en una migración. Si se quiere la monoespaciada, es una línea en `Comparador.tsx` y una prueba.

## 2026-11-12 — «Simular» desde Mis Números llega a la isla por el campo `simulacion` del Store  (feature: frontend-react, task: T028)
Context   — el botón «Simular» de Mis Números escribía en `#simNumero` y llamaba a `runSimulation()` por el puente `LP.simular`; con la isla del Simulador esos dos desaparecen. La deuda Q8 dejaba elegir entre reimplementar el puente sobre la isla o retirarlo.
Options    — (a) evento del DOM (`lp:simular`) que la isla escucha; (b) campo declarativo `simulacion: { numero, id } | null` en el estado compartido, con un `id` que crece en cada petición; (c) la isla guarda la petición en una variable de módulo.
Decision   — (b). `LP.simular(n)` fija la petición, activa la pestaña y avisa; la isla la lee con `useSimulacion()` y simula por cada `id` nuevo (pedir el mismo número otra vez es otra petición). Una petición anterior al montaje no cuenta. El contrato (`contratoStore.ts`) la exige a toda implementación y 5 almacenes rotos a propósito prueban que la comprobación falla. En el estado «recién creado» solo se exige `null`: las pestañas de `app.js` se enganchan en el arranque y nadie pulsa «Simular» antes de que lleguen los datos.
Why        — (a) deja un acoplamiento invisible al DOM que `ReactStore` (T052) tendría que imitar; (c) esconde estado que debería ser del Store y no sobrevive a un cambio de implementación. Coste: un campo más en `Snapshot` (afecta a `tipos.ts`, `storeFalso.ts`, `contratoStore.ts`, `hooks.ts`, `app.js`).

## 2026-11-12 — Simulador: tres cambios de comportamiento respecto al código antiguo  (feature: frontend-react, task: T028)
Context   — al migrar el Simulador hay comportamientos del `app.js` que no encajan con el patrón de las islas ya aprobadas (Comparador, Seguimiento).
Options    — (a) reproducir tal cual el aviso emergente, el cargador y el relleno hasta «0000»; (b) alinearlo con el resto de islas y registrarlo.
Decision   — (b), tres cambios: (1) un campo vacío o inválido se rechaza con «Ingresa un número de 4 dígitos» y ya no se rellena hasta «0000» (cierra Q8); (2) un error del servidor o de red se ve dentro de la pestaña («No se pudo simular. …» con «Reintentar», que repite lo que se pidió aunque el formulario haya cambiado) en vez de un aviso emergente que desaparece y deja la zona vacía; (3) mientras llega la respuesta se ve un esqueleto «Buscando...» (antes un cargador giratorio) y, con `stats` nulo, el esqueleto ocupa el lugar del formulario porque las categorías salen de `stats.by_category`. El «gráfico» siguen siendo las barras CSS de `.bar-chart` (el Simulador antiguo no usaba Chart.js), con la clave de categoría tal como llega.
Why        — (1) un clic sin querer no debe simular «0000» (igual que Mis Números, T023); (2) y (3) son los mismos estados que ya aprobó el dueño en el Comparador. Las capturas con datos (T031) comparan lo que se ve tras una simulación correcta, que no cambia.

## 2026-11-12 — Botón «Copiar» compartido y tres diferencias con el código antiguo  (feature: frontend-react, task: T029)
Context   — la recomendación mensual necesita el botón «Copiar» de `copyNumber`/`.copy-btn`, que también necesitará Predicciones (T044). El plan solo lo menciona dentro de T044, sin definir un componente.
Options    — (a) copiarlo dentro de la isla Mensual y repetirlo en T044; (b) un componente `BotonCopiar` compartido, con sus pruebas, creado ahora.
Decision   — (b). `components/BotonCopiar.tsx` copia al portapapeles, avisa «Copiado: …» y se marca «OK» 1,5 s. Tres diferencias con `app.js`: (1) el nombre accesible lleva el número («Copiar 9541»), para que varios botones no sean indistinguibles; (2) solo se marca el botón pulsado, no todos los `.copy-btn[data-num]` de la página; (3) si el portapapeles falta o rechaza se avisa «No se pudo copiar» (antes lanzaba un error sin capturar), y si el botón desaparece antes de que responda no avisa ni deja temporizadores.
Why        — (a) duplica lógica con temporizadores y portapapeles que conviene probar una vez; (1) es accesibilidad sin coste visual; (2) y (3) son lo que se espera de un componente. Si T044 prefiere el marcado de todos los botones del mismo número, es un cambio local en este componente.

## 2026-11-12 — T030 se absorbe en T028 y T029  (feature: frontend-react, tasks: T028, T029, T030)
Context   — el plan separa la isla (T028, T029) de la retirada del código antiguo y de los ids (T030). Al sustituir un bloque de la plantilla por `<div data-react-root>` el JS antiguo deja de encontrar sus contenedores: `renderMonthlySection` escribe en un `getElementById` que ya no existe y rompería `renderAll`.
Options    — (a) dejar el JS antiguo muerto hasta T030, protegiéndolo con comprobaciones de nulo; (b) retirar cada pestaña en el mismo cambio que su isla.
Decision   — (b), también para Mensual. La guardia de ids retirados se amplía con los ids y funciones de ambas pestañas. T030 queda cumplida y T031 (capturas y aprobación del dueño) pasa a depender de T029.
Why        — (a) añade código solo para sobrevivir unos commits y deja una ventana en la que la guardia no vigila; el criterio AC10 pide que una pestaña migrada no conserve su `render*`. Coste: el cambio de cada isla es mayor.

## 2026-11-12 — Mensual: estados nuevos respecto al código antiguo  (feature: frontend-react, task: T029)
Context   — `renderMonthlySection` no pintaba nada si faltaba `stats.monthly_reco` y dejaba las tarjetas estáticas de la plantilla vacías; el plan pide esqueleto con `stats` nulo y un estado vacío.
Decision   — con `stats` nulo, esqueleto «Cargando recomendación mensual»; sin `monthly_reco`, el mensaje «Aún no hay datos mensuales.»; con un número de perfiles distinto de 12 no hay gráfico y con una tabla de ventaja que no tenga 4 filas no hay tabla, pero sus tarjetas con título se ven, como antes. El gráfico usa el componente `Chart` (que aporta su propio `.chart-container`) y `datos`/`opciones` memorizadas (cierra Q9 para esta isla).
Why        — son los estados que el plan exige a toda isla; lo demás conserva la estructura que ve la persona (AC1).

## 2026-11-12 — Simulador: con `stats` nulo el formulario se ve igual (cierra Q11)  (feature: frontend-react, task: T028)
Context   — la isla devolvía un esqueleto de toda la pestaña mientras `stats` era `null`. La primera carga de `/api/stats` entrena el modelo (50-100 s, a veces minutos) y puede fallar y dejarlo en `null`; `/api/simulador` solo usa `get_sorteos()` y no depende de `stats`. De `stats` el Simulador solo toma las categorías del selector. El revisor de T028 lo planteó como pregunta y el dueño eligió la opción B.
Options    — (a) mantener el esqueleto, como decía el done-check; (b) mostrar siempre el formulario, con «Todas» como única categoría hasta que lleguen las estadísticas.
Decision   — (b), como el código antiguo. El done-check de T028 en el plan se enmienda. Se prueba que con `stats` nulo se ve el formulario, se puede simular, y al llegar `stats` el selector gana sus categorías sin perder lo tecleado, los filtros ni el resultado; también el flujo desde Mis Números. Si `stats` no llega nunca, el selector se queda con «Todas» sin aviso: un estado de error de `stats` se decide en T052.
Why        — (a) dejaba la pestaña inutilizable durante minutos, o para siempre si la carga fallaba, por una dependencia que no existe en el servidor.

## 2026-11-12 — Mensual y BotonCopiar: lo que cambia tras la revisión de T029  (feature: frontend-react, task: T029)
Context   — el revisor de T029 devolvió 1 should-fix, 3 nits y 1 pregunta. El should-fix señalaba que `role="img"` sobre el contenedor de la tabla de ventaja vuelve presentacional su contenido (ARIA) y, con un número de filas distinto de 4, deja una «imagen» vacía con nombre. El código antiguo hacía lo mismo (paridad), pero es un defecto de accesibilidad (AC3).
Verificación — no se lanzó un `finding-verifier` (la autorización cubría solo al revisor): se comprobó a mano. La regla ARIA es de la especificación («Children Presentational: True» para `img`). Medido en Chromium con el árbol de accesibilidad real (CDP), las 61 filas y celdas seguían expuestas, de modo que el efecto en un lector de pantalla depende de la plataforma y no se pudo medir aquí; el caso de tabla ausente sí es seguro (imagen vacía). `ariaSnapshot` de Playwright no sirve para esto: no aplica la regla de hijos presentacionales.
Decision   — (1) se quita el contenedor `role="img"`: la tabla lleva su `aria-label` y, sin 4 filas, no se pinta nada; (2) el nombre accesible de `BotonCopiar` acompaña al estado («Copiar 9541» → «Copiado 9541»); (3) el aviso de la copia sale siempre, también si el botón desaparece antes de que responda el portapapeles (la copia se hizo), y solo el estado y el temporizador se omiten: antes el fallo avisaba y el éxito no; (4) `BotonCopiar` lleva `data-numero` y no `data-num`, para que el `copyNumber` antiguo no reescriba su texto cuando un número coincide con el de un botón de Predicciones o Decenas (la pregunta del revisor); (5) se borra la prueba «cambiar de pestaña y volver» de Mensual: la isla no lee `activeTab`, así que no podía fallar y la identidad de `datos` y `opciones` ya la cubre otra prueba.
Why        — (1) quita una ambigüedad de accesibilidad sin cambiar nada visible; (3) el aviso es global (`#toast`), no del botón; (4) elimina el DOM compartido con código imperativo en lugar de depender de que sea transitorio hasta T044.

## 2026-11-12 — Al migrar, el texto mixto de una ficha va en nodos enteros  (feature: frontend-react, task: T031)
Context   — al comparar píxel a píxel la pestaña Mensual del código antiguo con la isla, las fichas de números y terminaciones diferían en centésimas de píxel (el ancho de `(1)` era 20,41 px en el antiguo y 20,44 px en la isla) y arrastraban a las demás fichas de la fila. Las cajas del resto de la página eran idénticas. La causa: el JSX `{n.number} <small>({n.count})</small>` escribe cinco nodos de texto («4653», « », «(», «1», «)»), mientras que el HTML antiguo escribía dos («4653 » y «(1)»), y Chromium compone cada nodo de texto por separado.
Decision   — el texto que en el código antiguo era una sola cadena se escribe en una sola cadena: `{`${n.number} `}` y `<small>{`(${n.count})`}</small>`. Una prueba fija la estructura de nodos de las fichas (de 3.581 y 4.511 píxeles distintos a 54 y 37 en Mensual). Regla para las islas que quedan (T032 en adelante): en texto mixto (número más unidad, paréntesis, signos) usar plantillas de cadena, no varios `{expresiones}` pegadas al texto.
Why        — el criterio AC1 pide que la pestaña se vea igual y esto es lo que lo rompía sin que ninguna prueba de DOM lo viera. Coste: una línea más por ficha.

## 2026-11-12 — Cómo se comparan las capturas (T031)  (feature: frontend-react, task: T031)
Context   — dos artefactos de la propia captura fingían diferencias: (1) la posición de la sección en la página tiene una parte fraccionaria distinta en cada versión y Chromium redondea distinto el recorte (6.400 píxeles falsos en el Simulador); (2) tras pulsar «Simular» el puntero se queda sobre el botón y lo deja en `:hover`, y si la sección se desplaza deja de estarlo (4.700 píxeles falsos).
Decision   — las capturas de referencia con datos alinean la sección a un píxel entero (misma corrección en las dos versiones) y apartan el puntero antes de capturar. `frontend/scripts/capturas.mjs` no lo hace todavía; conviene incorporarlo cuando se renueve la referencia (junto con ocultar el `.toast`, ya anotado).
Why        — sin esto la comparación píxel a píxel mide el redondeo de la captura y no la interfaz.

## 2026-11-12 — Precisión: carga propia, sin `stats`, y tres diferencias con el código antiguo  (feature: frontend-react, tasks: T032, T033)
Context   — `loadBacktesting` pedía `/api/backtesting?last_n=500` al activar la pestaña, guardaba la respuesta en `backtestData` y no la volvía a pedir; si la petición fallaba, `backtestData` quedaba en `null`, la página en blanco y el siguiente cambio de pestaña la reintentaba. El plan pedía «`stats` nulo → esqueleto» para todas las islas, pero el backtesting no depende de `stats` (la lección de Q11).
Decision   — la isla pide al pasar a ser la activa y no repite si ya tiene datos; si falló, reintenta al volver. No lee `stats`. Tres cambios de comportamiento: (1) un error se ve dentro de la pestaña («No se pudo cargar la precisión. …» con «Reintentar», foco a la región) en vez de una página en blanco; (2) sin modelo entrenado la API responde `ml_better: true` (el propio tipo `Backtesting` lo advierte) y antes se coronaba con «Mejor» a una tarjeta de ML vacía: ahora «Mejor» solo sale si hay datos de los dos métodos, la tarjeta vacía dice «Sin modelo entrenado.» (o «Sin datos suficientes.» la del Estadístico) y con los dos vacíos (pocos sorteos) se ve «Aún no hay suficientes sorteos para calcular la precisión.» más la nota de cómo interpretarlo; (3) el distintivo de lift ya no escribe `background:var(--accent-green)20`, que en `app.js` era CSS inválido (un `var()` con «20» pegado) y el navegador descartaba: el resultado visual es el mismo y se evita declarar una regla muerta. Se mantiene `||` en las cifras del resumen (un 0 se muestra como «—», como antes).
Why        — (1) la ausencia de aviso era indistinguible de «no hay datos»; (2) coronar a un método sin datos es información falsa; (3) paridad visual sin código muerto. T033 (retirada del código antiguo y de los ids) se absorbe en T032 como en la etapa 4: dejar `loadBacktesting` apuntando a un contenedor que ya no existe lo rompería. Texto mixto en nodos enteros (plantillas de cadena), como se anotó tras T031.
