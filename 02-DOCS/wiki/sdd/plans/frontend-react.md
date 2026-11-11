---
type: plan
title: Plan — Migrar el front-end a React
description: HOW de la spec frontend-react — convivencia por islas con un puente de estado, build con Vite y TypeScript, contrato de la API por fixtures, pruebas por etapa y orden de migración de las 14 pestañas.
tags: [sdd, plan]
timestamp: 2026-11-11T13:00:00Z
topic: sdd
slug: frontend-react
status: draft
branch: feat/react-frontend
---

# Plan — Migrar el front-end a React

Spec: [frontend-react](../specs/frontend-react.md) (aprobada 2026-11-11) · Constitution: [v1.0.0](../constitution.md), que la etapa 0 enmienda a v2.0.0.

## 0. Global constraints
Valores exactos que toda tarea debe respetar, copiados del código actual (`static/app.js`, `app.py`). Un implementador sin contexto y su revisor solo ven esta sección.

- **Premios:** se muestran tal como llegan de `/api/sorteos` y `/api/stats` (`"98"`, `"0074"`, `"05309"`, `""`). Prohibido `padStart`, `zfill` o cualquier relleno. Prohibido `dangerouslySetInnerHTML` (React ya escapa; sustituye a `esc()`).
- **Almacenamiento del navegador:** `localStorage['theme']` = `'light'` | `'dark'`; el tema se aplica como atributo `data-theme` en `<html>`. `localStorage['lp_favorites']` = JSON con un array de números (lectura tolerante: si falla el JSON, `[]`). `sessionStorage['updateToken']` = token de actualización; se borra con 401 y se guarda con cualquier otra respuesta; cabecera `X-Update-Token`. Se pide con `window.prompt('Token de actualización (ACTUALIZAR_TOKEN):')`.
- **Datos:** carga de sorteos `GET /api/sorteos?all=true` (acepta `data.data || data`); estadísticas `GET /api/stats` con límite de 180 000 ms y hasta 3 intentos. Otras rutas: `/api/gaps`, `/api/comparar`, `/api/simulador`, `/api/seguimiento`, `/api/backtesting`, `POST /api/actualizar`. Ninguna pestaña migrada vuelve a pedir `/api/sorteos` ni `/api/stats` mientras convivan las dos versiones.
- **Etiquetas de categoría:** exactamente `dominical: 'Dominical'`, `miercolito: 'Miercolito'`, `gordito: 'Gordito del Zodiaco'`, `extraordinario: 'Extraordinario'`; categoría desconocida = primera letra en mayúscula. Clase CSS de categoría: minúsculas y solo `[a-z0-9_-]`.
- **Formatos:** fecha `new Date(d+'T00:00:00').toLocaleDateString('es-PA',{year:'numeric',month:'short',day:'numeric'})`, y `'—'` si falta. Confianza `×N.NN azar` (`fmtLift`, `'—'` si es nulo). Barra de lift = `min(x/2*100, 100)`.
- **Colores de gráficos:** se portan literales de `chartOpts()` (claro: texto `#5c554a`, tenue `#9a9189`, rejilla `rgba(139,105,20,0.1)`, tooltip `#ffffff`; oscuro: `#8a8693`, `#4a4656`, `rgba(212,175,55,0.06)`, `#111118`) y de `DIGIT_COLORS`/`ENDING_COLORS` (10 colores). Tipografías `DM Sans` y `JetBrains Mono`.
- **Marcado:** se conservan las clases CSS y los `id` que usa `static/style.css` (esferas `lotto-ball ball-*`, `dashboard-hero-grid`, `heatmap-table`, `cell-peak`, `prize-chip`, etc.). Las hojas de estilo no se editan salvo para quitar reglas de código eliminado.
- **ARIA:** `tablist`/`tab`/`tabpanel`, `aria-selected`, `aria-controls`, `aria-labelledby`, `aria-live` y `role="status"` como en `templates/index.html`; subpestañas de premio y de categoría con flechas, Inicio y Fin.
- **Proceso:** una rama y un PR por etapa; commits con gitmoji y descripción en español; sin `Co-Authored-By`. Dependencias del front con versión exacta y `package-lock.json`.

## 1. Context & constraints
- La constitución fija hoy «JS vanilla, sin bundlers ni frameworks» (principio 1) y exige versiones exactas (3), `pytest -q -W error::SyntaxWarning` (4) y validar la sintaxis de `static/app.js` (6). La spec ordena enmendarla (spec §What it must respect). Se enmiendan 1, 2, 6, 14 (referencia a `isLight()`) y la definición de hecho.
- No hay despliegue en el repo; solo `python app.py` y el CI de tests (spec §Clarifications). Por eso el build no se commitea y Flask avisa si falta.
- No hay CSP ni cabeceras de seguridad en `app.py`: un `<script type="module">` desde `/static` funciona sin cambios en el servidor.
- El front actual es un script clásico con variables globales (`allSorteos`, `stats`, `useML`, `currentPrize`, `currentStatsPrize`) y ~30 funciones `render*` que escriben en el DOM por `id`. Eso fija el reto central: dos mundos escribiendo sobre la misma página (spec §Behaviour, convivencia).
- Pestañas con carga propia al activarse: Precisión, Seguimiento y Gaps (`activateNavTab`). El resto se pinta cuando `renderQuick()` y `renderFull()` terminan.

## 2. Architecture

```
Navegador
 ┌──────────────────────────────────────────────────────────────────┐
 │ templates/index.html (Flask)                                     │
 │   cabecera, nav de 14 pestañas, loader, <section id="sec-…">     │
 │                                                                  │
 │  [LEGACY]  static/app.js ──────────────┐   se va reduciendo       │
 │   carga datos, tema, pestañas, token   │                          │
 │        │ expone                        ▼                          │
 │        └──► window.LP  (puente: estado + eventos + acciones)      │
 │                                 │                                 │
 │  [REACT]  static/dist/app.js    │ lee / escucha                   │
 │   main.tsx monta una isla en cada <div data-react-root="gaps">…   │
 │     store/  (interfaz Store; implementación LegacyStore)          │
 │     tabs/   (una isla por pestaña migrada)                        │
 │     components/ (Balls, Chart, Skeleton…)  api/ (cliente + tipos) │
 └──────────────────────────────────────────────────────────────────┘
            │ fetch                                  ▲ JSON
            ▼                                        │
        Flask API (app.py, sin cambios de contrato) ─┘
```

**Decisión principal: islas sobre el armazón actual, con una interfaz `Store` como costura.** Mientras queden pestañas sin migrar, el armazón (cabecera, tema, barra de pestañas, loader, carga de datos, botón de actualizar) sigue en `app.js` y es la fuente de verdad. Cada pestaña migrada se monta como una isla React dentro de su `<section id="sec-…">`, y lee el estado a través de una interfaz `Store`. Su primera implementación (`LegacyStore`) envuelve el puente `window.LP`. Cuando todas las pestañas son React, una última etapa mueve el armazón a React y cambia `LegacyStore` por una implementación propia: los componentes de las pestañas no se tocan.

Alternativas descartadas:
- **React dueño del armazón desde el primer día**, con las pestañas viejas dentro de contenedores React. Hace que la primera etapa sea enorme y obliga a un puente inverso, más frágil, para ~25 funciones `render*` que leen variables globales.
- **Todo de una vez:** descartado por el dueño en la spec.

Recomendación: islas. Cada etapa deja la app entera usable, que es el objetivo de la spec.

Componentes (responsabilidad única):

| Componente | Responsabilidad | Interno/externo |
| --- | --- | --- |
| `static/app.js` (existente) | Armazón legacy y puente `window.LP`; pierde código en cada etapa | interno |
| `frontend/src/store/` | `Store` (contrato), `LegacyStore`, `StoreProvider`, hooks `useSorteos`, `useStats`, `useML`, `usePrize`, `useTheme`, `useActiveTab` | interno |
| `frontend/src/api/` | Cliente tipado por endpoint, errores opacos (`'Error de conexión'`), tipos de las respuestas | interno, toca la API |
| `frontend/src/components/` | Piezas compartidas: `Balls`, `Chart` (envoltorio de Chart.js con tema), `Skeleton`, `PrizeTabs`, `CategoryTabs`, `Toast` vía puente | interno |
| `frontend/src/tabs/*` | Una isla por pestaña (14) | interno |
| `frontend/src/main.tsx` | Busca `[data-react-root]` y monta la isla registrada | interno |
| Build (Vite + TypeScript) | Genera `static/dist/app.js` (nombre fijo, sin hash) y su CSS si lo hubiera | herramienta |
| `app.py` `index()` | Entrega la plantilla; si falta `static/dist/app.js`, la plantilla muestra el aviso de cómo construir | externo (Flask) |
| CI | Job de front (instalar, tipos, pruebas, build) además del de Python | externo |

**Chart.js:** se empaqueta con el build (paquete npm, importado por el componente `Chart`). Resuelve la decisión diferida de la spec: el build lo hace natural y quita la dependencia de la red externa. El `<script>` de la CDN se mantiene mientras `app.js` use el `Chart` global, y se quita en la etapa final.

**Bucle de desarrollo:** `npm run build -- --watch` más recargar la página. El servidor de desarrollo con recarga en caliente queda diferido a la etapa final, porque durante la convivencia la página la sirve Flask con el armazón legacy.

## 3. Interfaces & contracts

```
Store
  getSnapshot() -> Snapshot
  subscribe(listener) -> unsubscribe
  actions: setUseML(bool), setPrize(Prize), setStatsPrize(Prize), toast(msg, ms?), reload()

Snapshot = { sorteos: Sorteo[]; stats: Stats | null; useML: bool;
             prize: 'primero'|'segundo'|'tercero'; statsPrize: same;
             theme: 'light'|'dark'; activeTab: TabId; ready: bool }
```
- `stats === null` mientras no llegó `/api/stats`: toda isla muestra su esqueleto; nunca renderiza datos a medias.
- `ready` pasa a verdadero cuando llegó la lista de sorteos.
- Los hooks usan `useSyncExternalStore`; en las pruebas se inyecta un `Store` falso por `StoreProvider`.

**Puente `window.LP`** (lo define `app.js`; es el contrato entre mundos):
```
LP.getSnapshot() / LP.subscribe(fn)       // lectura y suscripción
LP.setUseML / setPrize / setStatsPrize    // escriben en las variables legacy y re-emiten
LP.toast(msg, ms)  /  LP.reload()         // delegan en showToast() y loadData()
evento DOM 'lp:change' (detail: clave cambiada) tras: sorteos, stats, useML, prize,
                     statsPrize, theme, activeTab
```
Reglas: el puente solo expone lectura de las variables y acciones, no funciones `render*`; una pestaña migrada no tiene ya `render*` ni `id` propios en `app.js`.

**Isla:** cada pestaña es `TabComponent(): JSX` sin props; obtiene todo por hooks. Registro: `{ 'gaps': GapsTab, … }`. Contrato de activación: `useActiveTab()`; las pestañas con carga propia piden sus datos la primera vez que son la activa (igual que `activateNavTab`) y reintentan por acción del usuario.

**Cliente de API:** una función por endpoint con retorno tipado, `Result<T> = { ok: true, data: T } | { ok: false, mensaje: string }`; el mensaje es siempre genérico (`'Error de conexión'` o el `error` público que ya devuelve el servidor para `/api/actualizar`). Nunca muestra trazas ni `str(e)`.

**Contrato de tipos con la API (cadena backend → fixture → tipo):**
1. `frontend/fixtures/<endpoint>.json`: respuesta real de cada endpoint, generada con un script Python que usa el cliente de pruebas de Flask sobre la base sembrada (`tests/seed_db.py`).
2. Un test `pytest` compara la **estructura** (claves y tipos de valor, recursivamente) de la respuesta actual con la del fixture; si el backend cambia, falla.
3. El código TypeScript declara los fixtures con `satisfies` contra los tipos; si un tipo cambia sin su fixture, `tsc` falla.
4. Campos que pueden ser `null` o ausentes según los datos (`backtest` con menos de 230 sorteos, categoría sin premios de 4 cifras, `extraordinario`) tienen un fixture variante por cada caso.

**Servidor:** `index()` pasa a la plantilla `react_built` (existe `static/dist/app.js`). La plantilla incluye `<script type="module" src="…/dist/app.js">` si existe, y si no un bloque con rol `alert` que dice «La interfaz React no está construida. Ejecuta `npm --prefix frontend ci && npm --prefix frontend run build`.». `/api/*` no cambia.

## 4. Data model & flow
- **No hay modelo de datos nuevo.** El estado compartido es el `Snapshot` de arriba; las respuestas de la API se tipan en `frontend/src/api/types.ts` (`Sorteo`, `Stats` con sus subobjetos, `Gaps`, `Comparacion`, `Simulacion`, `Seguimiento`, `Backtesting`).
- **Flujo de carga (sin cambios hasta la etapa final):** `loadData()` legacy pide sorteos y luego estadísticas → actualiza variables → emite `lp:change` → las islas se re-renderizan desde el `Snapshot`. Una isla no hace `fetch` de esos dos endpoints.
- **Flujo por pestaña con carga propia:** al activarse la pestaña, la isla pide su endpoint, muestra esqueleto, luego datos o mensaje de error con botón de reintento; una isla que falla no afecta a las demás.
- **Tema:** el puente emite `theme`; el componente `Chart` destruye y recrea el gráfico con las opciones del tema nuevo (reproduce hoy `toggleTheme` que re-renderiza gráficos y mapas).
- **Favoritos y token:** los lee y escribe la isla que los usa (`Mis Números`, botón de actualizar) con las mismas claves de §0, así que ambas versiones los comparten sin puente.
- **Etapa final:** `ReactStore` replica `loadData()` (misma lógica de dos fases, tiempo límite y reintentos), el tema y la pestaña activa, y `app.js` desaparece.

## 5. Testing strategy
Herramientas: Vitest + Testing Library con jsdom (componente y unidad), `tsc --noEmit` (tipos), `pytest` (contrato y servidor), capturas con Playwright en local (visual). Chart.js no pinta en jsdom: el componente `Chart` se sustituye por un doble que registra la configuración recibida (datos, colores, opciones de tema), y eso es lo que se afirma.

| Criterio de la spec | Nivel | Qué afirma | Qué simula |
| --- | --- | --- | --- |
| Cada pestaña igual que la referencia, en ambos temas | Visual, manual con ayuda | 28 capturas (14 × 2) del «después» frente al «antes»; el dueño las ve; diferencia por píxeles solo como aviso, con animaciones desactivadas | Base sembrada igual en ambas capturas |
| Etapa a medias: todo funciona y comparte ML, premio y tema | Integración (componente + puente real de `app.js` en jsdom) | Cambiar `useML`/premio/tema desde legacy re-renderiza la isla y al revés; la isla no llama a `/api/sorteos` ni `/api/stats` | `fetch` |
| Teclado en pestañas y subpestañas | Componente | Flechas, Inicio, Fin, foco y `aria-selected` en `PrizeTabs`/`CategoryTabs` y, en la etapa final, en la barra principal | — |
| Premios 2/4/5 cifras/vacíos idénticos | Unidad + componente | `Balls` y las tablas muestran el texto recibido; ningún `padStart`/`zfill` en `frontend/src` (prueba que busca el patrón en el código fuente) | Fixtures con los cuatro formatos |
| Token de actualización | Componente | Se guarda al responder distinto de 401, se borra con 401; mensajes opacos para 401/503/502/500 | `fetch`, `window.prompt` |
| Un tipo roto falla la compilación | Tipos + contrato | `tsc` falla si un fixture no encaja en su tipo; `pytest` falla si la API cambia respecto al fixture | Base sembrada |
| Suite Python y front en verde en CI | CI | Los dos jobs en verde; ningún archivo viejo sin uso (prueba que busca referencias a ids borrados) | — |
| Clon sin build muestra el aviso y la API sigue | Integración (pytest) | Sin `static/dist/app.js` la página contiene el aviso y no el `<script>`; `/api/*` responde igual | Ruta del build (monkeypatch) |
| CI construye y comprueba tipos | CI | El job ejecuta `npm ci`, `typecheck`, `test`, `build` | — |
| Sustituir pruebas por texto sin perder cobertura | Trazabilidad | Tabla en la verificación de cada etapa: aserción vieja → prueba de componente; `test_js_labels_have_no_variants` pasa a probar `catLabel` y `CAT_LABELS` en TS | — |
| Constitución a v2.0.0 | Revisión | La entrada del registro de cambios y los principios enmendados existen (comprobación en la etapa 0) | — |

**Pruebas por texto del código antiguo:** `tests/test_ui_assets.py` se mantiene mientras `app.js` y `style.css` contengan lo que verifican. Al migrar la pestaña, sus aserciones sobre `app.js` pasan a pruebas de componente en el mismo PR; las de `style.css` se quedan. Una prueba nueva garantiza que `app.js` ya no contiene ningún `getElementById` de los `id` retirados en esa etapa.

## 6. Sequencing & dependencies
Cada etapa = una rama `feat/react-etapa-N-<tema>` desde `main` y un PR, con la app entera usable al terminar. Orden pensado para que lo simple demuestre el puente antes de las pestañas con gráficos.

| Etapa | Contenido | Depende de | Riesgo esperado |
| --- | --- | --- | --- |
| 0 | Enmienda de la constitución v2.0.0; andamiaje del front (Vite, TS, Vitest, `package-lock`, `.gitignore`, versión de Node); aviso y script en `index()`; job de CI; capturas de referencia (28) en `02-DOCS/attachments/` | spec | 2: toca el workflow de CI |
| 1 | Puente `window.LP`, interfaz `Store`, `LegacyStore`, hooks, cliente de API con tipos y fixtures, test de contrato; isla **Gaps** como primera pestaña | 0 | 1 |
| 2 | **Seguimiento** (tabla, endpoint propio) | 1 | 1 |
| 3 | **Mis Números** (localStorage, sin API) y **Comparador** | 1 | 1 |
| 4 | **Simulador** y **Mensual** (con gráfico: componente `Chart` y doble de pruebas) | 1 | 1 |
| 5 | **Precisión** (gráfico, endpoint propio) | 4 | 1 |
| 6 | **Resultados** (filtros, paginación, exportar CSV) | 1 | 1 |
| 7 | **Decenas** y **Terminaciones** (selector de categoría, mapa de calor, gráfico) | 4 | 1 |
| 8 | **Predicciones** (dashboard, esferas, recomendaciones, interruptor ML, selector de premio) | 7 | 1 |
| 9 | **Estadísticas**, **Tendencias** y **Análisis** (gráficos de radar y dispersión, formatos) | 8 | 1 |
| 10 | Armazón en React: tema, barra de pestañas con teclado, loader, carga en dos fases, botón y token de actualizar; `ReactStore`; se elimina `app.js`, la CDN de Chart.js y la plantilla legacy; servidor de desarrollo con recarga | 1–9 | 1 |

Las etapas 2 a 9 son independientes entre sí a nivel de lógica, pero **todas editan `app.js` y `index.html`**, así que se hacen en serie para evitar conflictos de fusión (no se usa `parallel`). Mientras no haya una etapa fusionada, la siguiente no arranca.

## 7. Risks & open decisions
Ordenados por probabilidad × impacto.

1. **Dos mundos escribiendo en el mismo DOM.** Si `app.js` conserva un `render*` que escribe en un `id` que ahora pertenece a React, lo pisa o lo duplica. *Disparador:* se migra una pestaña y queda una llamada en `renderFull()`. *Impacto:* pantalla corrupta sin error. *Mitigación:* en cada etapa se borran en el mismo PR las funciones, las llamadas y los `id`; la prueba «`app.js` no referencia `id` retirados» lo vigila.
2. **Deriva visual por marcado distinto.** El CSS depende de clases y estructura. *Mitigación:* portar el marcado literal de `index.html` y de las plantillas de cadena de cada `render*`; capturas por pestaña y tema; el dueño las aprueba (criterio de la spec).
3. **Ciclo de vida de Chart.js** (reutilizar canvas, destruir al cambiar de tema o de pestaña) y gráficos que no se pueden probar en jsdom. *Mitigación:* un único componente `Chart` con pruebas propias y doble de pruebas en las pestañas; spike en la etapa 4 (primer gráfico) antes de seguir.
4. **Contrato por estructura con valores nulos.** Una comparación de claves y tipos puede dar falsos verdes si el fixture no cubre el caso nulo. *Mitigación:* fixtures variantes explícitos (§3, punto 4) y un test que falla si un campo de la API no aparece en ningún fixture.
5. **Cambio de CI (tier 2 en `rsc risk`).** La etapa 0 toca `.github/workflows`: exige panel de tres revisores y aprobación humana, y la spec vinculada a la rama (ya lo está). *Mitigación:* esa etapa es pequeña y se mergea sola.
6. **Cansancio de PRs (11 etapas).** *Mitigación:* orden de valor creciente; el dueño puede parar tras cualquier etapa sin dejar la app rota. Se puede agrupar 2 etapas pequeñas en un PR si el dueño lo pide.
7. **Primera carga lenta (50-100 s si el modelo no está entrenado).** Las islas deben mostrar esqueleto mientras `stats === null`, sin tiempo límite propio; se prueba con `stats` nulo. 
8. **Capturas inestables** (animaciones, fechas relativas, datos distintos). *Mitigación:* animaciones de Chart.js desactivadas en la captura, base sembrada fija, y la comparación por píxeles solo como ayuda.
9. **Playwright aumenta las dependencias de desarrollo** (descarga de navegadores). *Mitigación:* solo en local y fuera del CI; versión exacta en el bloqueo.

Decisiones abiertas: ninguna que bloquee. Quedan diferidas, por decisión de la spec: enrutado por URL.

## Aislamiento
Esta rama (`feat/react-frontend`, worktree `.worktrees/feat-react-frontend`) lleva la spec y el plan. Cada etapa de código arranca en su propia rama y worktree desde `main`, nunca desde esta rama ni sobre `main`.
