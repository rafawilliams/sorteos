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

- **Premios:** se muestran tal como llegan de `/api/sorteos` y `/api/stats` (`"98"`, `"0074"`, `"05309"`, `""`). Prohibido `padStart`, `zfill` o cualquier relleno **sobre un premio**. Única excepción: el número de 4 cifras que teclea el usuario en el Simulador se rellena con ceros a la izquierda, como hoy, en `frontend/src/lib/numeroSimulador.ts` (`normalizarNumero`); ningún otro archivo de `frontend/src` puede contener `padStart` ni `zfill`. Prohibido `dangerouslySetInnerHTML` (React ya escapa; sustituye a `esc()`).
- **Almacenamiento del navegador:** `localStorage['theme']` = `'light'` | `'dark'`; el tema se aplica como atributo `data-theme` en `<html>`. `localStorage['lp_favorites']` = JSON con un array de números (lectura tolerante: si falla el JSON, `[]`). `sessionStorage['updateToken']` = token de actualización; se borra con 401 y se guarda con cualquier otra respuesta; cabecera `X-Update-Token`. Se pide con `window.prompt('Token de actualización (ACTUALIZAR_TOKEN):')`.
- **Datos:** carga de sorteos `GET /api/sorteos?all=true` (acepta `data.data || data`); estadísticas `GET /api/stats` con límite de 180 000 ms y hasta 3 intentos. Otras rutas: `/api/gaps`; `/api/comparar?numeros=a,b,c` (números separados por comas); `/api/simulador?numero=NNNN` más `&cat=<encodeURIComponent>`, `&from=YYYY-MM-DD` y `&to=YYYY-MM-DD` solo cuando no están vacíos; `/api/seguimiento`; `/api/backtesting?last_n=500`; `POST /api/actualizar`. Ninguna pestaña migrada vuelve a pedir `/api/sorteos` ni `/api/stats` mientras convivan las dos versiones.
- **Etiquetas de categoría:** exactamente `dominical: 'Dominical'`, `miercolito: 'Miercolito'`, `gordito: 'Gordito del Zodiaco'`, `extraordinario: 'Extraordinario'`; categoría desconocida = primera letra en mayúscula. Clase CSS de categoría: minúsculas y solo `[a-z0-9_-]`.
- **Formatos:** fecha `new Date(d+'T00:00:00').toLocaleDateString('es-PA',{year:'numeric',month:'short',day:'numeric'})`, y `'—'` si falta. Confianza `×N.NN azar` (`fmtLift`, `'—'` si es nulo). Barra de lift = `min(x/2*100, 100)`.
- **Colores de gráficos:** se portan literales de `chartOpts()` (claro: texto `#5c554a`, tenue `#9a9189`, rejilla `rgba(139,105,20,0.1)`, tooltip `#ffffff`; oscuro: `#8a8693`, `#4a4656`, `rgba(212,175,55,0.06)`, `#111118`) y de `DIGIT_COLORS`/`ENDING_COLORS` (10 colores). Tipografías `DM Sans` y `JetBrains Mono`.
- **Marcado:** se conservan las clases CSS y los `id` que usa `static/style.css` (esferas `lotto-ball ball-*`, `dashboard-hero-grid`, `heatmap-table`, `cell-peak`, `prize-chip`, etc.). Las hojas de estilo no se editan salvo para quitar reglas de código eliminado.
- **ARIA:** `tablist`/`tab`/`tabpanel`, `aria-selected`, `aria-controls`, `aria-labelledby`, `aria-live` y `role="status"` como en `templates/index.html`; subpestañas de premio y de categoría con flechas, Inicio y Fin.
- **Proceso:** una rama y un PR por etapa; commits con gitmoji y descripción en español; sin `Co-Authored-By`. Dependencias del front con versión exacta y `package-lock.json`.

## 1. Context & constraints
- La constitución fija hoy «JS vanilla, sin bundlers ni frameworks» (principio 1) y exige versiones exactas (3), `pytest -q -W error::SyntaxWarning` (4) y validar la sintaxis de `static/app.js` (6). La spec ordena enmendarla (spec §What it must respect). Se enmiendan 1, 2, 5 (auditoría también de las dependencias de Node), 6, 14 (referencia a `isLight()`) y la definición de hecho.
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

**Isla:** cada pestaña es `TabComponent(): JSX` sin props; obtiene todo por hooks. Descubrimiento: cada archivo de `frontend/src/tabs/` exporta `nombre` (el `data-tab` de la pestaña) y `Componente`; `main.tsx` los encuentra con `import.meta.glob`, así que añadir una isla no edita ningún registro central. Cada isla añade su `<div data-react-root="<nombre>">` dentro de su `<section>` de `index.html`, y el PR de la etapa retira el marcado legacy de ese mismo `section`. Contrato de activación: `useActiveTab()`; las pestañas con carga propia piden sus datos la primera vez que son la activa (igual que `activateNavTab`) y reintentan por acción del usuario.

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
| Cada pestaña igual que la referencia, en ambos temas | Visual, manual con ayuda | 28 capturas (14 × 2) del «después» frente al «antes»; el dueño las ve, con animaciones desactivadas; la comparación la hace el dueño a ojo, sin diferencia automática por píxeles | Base de datos sembrada aparte (`sorteos_capturas`), la misma en la referencia y en todas las etapas |
| Etapa a medias: todo funciona y comparte ML, premio y tema | Integración (componente + puente real de `app.js` en jsdom; el HTML es `templates/index.html` leído del disco con sus dos `url_for` sustituidos por `/static/<archivo>`, y el script se evalúa dentro del documento de jsdom) | Cambiar `useML`/premio/tema desde legacy re-renderiza la isla y al revés; la isla no llama a `/api/sorteos` ni `/api/stats` | `fetch` |
| Teclado en pestañas y subpestañas | Componente | Flechas, Inicio, Fin, foco y `aria-selected` en `PrizeTabs`/`CategoryTabs` y, en la etapa final, en la barra principal | — |
| Premios 2/4/5 cifras/vacíos idénticos | Unidad + componente | `Balls` y las tablas muestran el texto recibido; ningún `padStart`/`zfill` en `frontend/src` fuera de `lib/numeroSimulador.ts` (prueba que busca el patrón en el código fuente) | Fixtures con los cuatro formatos |
| Token de actualización | Componente | Se guarda al responder distinto de 401, se borra con 401; mensajes opacos para 401/503/502/500 | `fetch`, `window.prompt` |
| Un tipo roto falla la compilación | Tipos + contrato | `tsc` falla si un fixture no encaja en su tipo; `pytest` falla si la API cambia respecto al fixture | Base sembrada |
| Suite Python y front en verde en CI | CI | Los dos jobs en verde; ningún archivo viejo sin uso (prueba que busca referencias a ids borrados) | — |
| Clon sin build muestra el aviso y la API sigue | Integración (pytest) | Sin `static/dist/app.js` la página contiene el aviso y no el `<script>`; `/api/*` responde igual | Ruta del build (monkeypatch) |
| CI construye y comprueba tipos | CI | El job ejecuta `npm ci`, `typecheck`, `test`, `build` | — |
| Sustituir pruebas por texto sin perder cobertura | Trazabilidad | Tabla en la verificación de cada etapa: aserción vieja → prueba de componente; `test_js_labels_have_no_variants` pasa a probar `catLabel` y `CAT_LABELS` en TS | — |
| Constitución a v2.0.0 | Revisión | La entrada del registro de cambios y los principios enmendados existen (comprobación en la etapa 0) | — |

**Pruebas por texto del código antiguo:** `tests/test_ui_assets.py` se mantiene mientras `app.js` y `style.css` contengan lo que verifican. Al migrar la pestaña, sus aserciones sobre `app.js` pasan a pruebas de componente en el mismo PR; las de `style.css` se quedan. Una prueba nueva garantiza que `app.js` ya no contiene ningún `getElementById` de los `id` retirados en esa etapa.

**Estados obligatorios de toda isla (se afirman en su prueba de componente):** carga (esqueleto mientras `stats` es nulo o el endpoint propio no respondió, sin tiempo límite propio), vacío (el mismo mensaje que muestra hoy `app.js`), error (mensaje genérico y, si la pestaña tiene carga propia, botón de reintento) y aislamiento (un error en una isla no cambia a las demás).

**Auditoría de dependencias:** el job de front ejecuta `npm audit --audit-level=high` (principio 5 ampliado en la v2.0.0).

## 6. Sequencing & dependencies
Cada etapa = una rama `feat/react-etapa-N-<tema>` desde `main` y un PR (la etapa 0 es la excepción: usa `feat/react-frontend`), con la app entera usable al terminar. Orden pensado para que lo simple demuestre el puente antes de las pestañas con gráficos.

| Etapa | Contenido | Depende de | Riesgo esperado |
| --- | --- | --- | --- |
| 0 | Enmienda de la constitución v2.0.0; andamiaje del front (Vite, TS, Vitest, `package-lock`, `.gitignore`, versión de Node); aviso y script en `index()`; job de CI; capturas de referencia (28, contra una base sembrada aparte) en `02-DOCS/attachments/` | spec | 2: toca el workflow de CI; sale de esta misma rama `feat/react-frontend`, a la que está vinculada la spec, y su PR incluye spec, plan y análisis |
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
4. **Contrato por estructura con valores nulos.** Una comparación de claves y tipos puede dar falsos verdes si el fixture no cubre el caso nulo. *Mitigación:* fixtures variantes explícitos (§3, punto 4) y T009 compara las claves en los dos sentidos (campo de la API sin fixture y campo del fixture sin API).
5. **Cambio de CI (tier 2 en `rsc risk`).** La etapa 0 toca `.github/workflows`: exige panel de tres revisores (`rsc review ledger panel`), aprobación humana y una spec vinculada **a esa rama** (`branch:` en su frontmatter). *Mitigación:* la etapa 0 se hace en `feat/react-frontend`, que es la rama enlazada en la spec; las etapas siguientes (tier 1) no necesitan ese enlace.
6. **Cansancio de PRs (11 etapas).** *Mitigación:* orden de valor creciente; el dueño puede parar tras cualquier etapa sin dejar la app rota. Se puede agrupar 2 etapas pequeñas en un PR si el dueño lo pide.
7. **Primera carga lenta (50-100 s si el modelo no está entrenado).** Las islas deben mostrar esqueleto mientras `stats === null`, sin tiempo límite propio; se prueba con `stats` nulo. 
8. **Capturas inestables** (animaciones, fechas relativas, datos distintos). *Mitigación:* animaciones de Chart.js desactivadas y una base de datos sembrada aparte (`sorteos_capturas`, vacía y rellenada con `tests/seed_db.py`, que se niega a tocar datos reales) que no cambia entre etapas. Así el servidor de capturas no escribe en tu base real: `/api/stats` guarda recomendaciones en `predicciones`. El ML usa semillas fijas, así que con los mismos datos da las mismas recomendaciones. La comparación la hace el dueño a ojo.
9. **Playwright aumenta las dependencias de desarrollo** (descarga de navegadores). *Mitigación:* solo en local y fuera del CI; versión exacta en el bloqueo.

10. **Dependencias de Node sin auditar.** *Mitigación:* `npm audit` en el job de front (T005) y principio 5 ampliado (T001).

Decisiones abiertas: ninguna que bloquee. Quedan diferidas, por decisión de la spec: enrutado por URL.

## Aislamiento
Esta rama (`feat/react-frontend`, worktree `.worktrees/feat-react-frontend`) lleva la spec y el plan. Cada etapa de código arranca en su propia rama y worktree desde `main`, nunca desde esta rama ni sobre `main`.

## Tasks
<!-- generated by tasks on 2026-11-11; IDs are stable, do not renumber -->

**Numeración de criterios de la spec (orden en que aparecen en «Acceptance criteria»):** AC1 capturas iguales a la referencia · AC2 etapa a medias comparte ML/premio/tema · AC3 teclado y ARIA · AC4 premios idénticos a lo recibido · AC5 token de actualización · AC6 tipo roto falla la compilación · AC7 migración completa en verde y sin archivos viejos · AC8 clon sin build muestra aviso · AC9 CI construye y comprueba tipos · AC10 pruebas por texto sustituidas sin perder cobertura · AC11 constitución v2.0.0.

**Atajos en los done-checks:** `FE test <filtro>` = `npm --prefix frontend test -- --run <filtro>`; `FE tipos` = `npm --prefix frontend run typecheck`; `FE build` = `npm --prefix frontend run build`; `PY` = `pytest -q -W error::SyntaxWarning`. Toda tarea de código con prueba se hace primero en rojo (la prueba existe y falla por la razón correcta) y luego en verde. «Capturas» = `node frontend/scripts/capturas.mjs --salida <dir>` frente a `02-DOCS/attachments/react-baseline/`. Cada etapa es una rama `feat/react-etapa-N-<tema>` y un PR; el «Risk» es el pronóstico de `rsc risk` sobre las rutas previstas y `implement` lo recalcula sobre el diff real.

| ID | [P] | Task | Done-check | Depends-on | Trace | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| **Etapa 0 — Constitución, andamiaje, aviso, CI y referencia** |  |  |  |  |  |  |
| T001 |  | Enmendar la constitución a v2.0.0 (principios 1, 2, 5, 6, 14 y definición de hecho; fila en el registro de cambios) con la skill `constitution` | `grep -c "v2.0.0" 02-DOCS/wiki/sdd/constitution.md` ≥ 2; el principio 1 ya no contiene «sin bundlers ni frameworks»; la tabla de enmiendas tiene la fila con fecha 2026-11-11; el principio 5 menciona la auditoría de dependencias de Node | — | AC11 | 0 |
| T002 |  | Crear el andamiaje `frontend/` (TypeScript estricto, Vite con salida fija `static/dist/app.js`, Vitest, versiones exactas, `package-lock.json`, versión de Node fijada) y las entradas de `.gitignore` | `npm --prefix frontend ci` y `FE tipos`, `FE test`, `FE build` salen con 0; existe `static/dist/app.js`; `git check-ignore static/dist/app.js frontend/node_modules` imprime ambas rutas (Vitest configurado con `passWithNoTests`) | T001 | AC9 | 1 |
| T003 |  | Escribir la prueba en rojo del aviso de «interfaz sin construir» y del script cuando sí existe | `pytest tests/test_frontend_build.py -q` falla (la página no trae aviso ni script) | T002 | AC8 | 1 |
| T004 |  | Servir en `index()` el script del build o el aviso con rol `alert` (con el comando para construir), sin tocar `/api/*` | `pytest tests/test_frontend_build.py -q` en verde; con la ruta del build inexistente `/api/stats` sigue respondiendo 200 | T003 | AC8 | 1 |
| T005 | [P] | Añadir al workflow el job de front (Node de la versión fijada, `npm ci`, tipos, pruebas, build) y `npm audit --audit-level=high` | `python -c "import yaml;yaml.safe_load(open('.github/workflows/tests.yml'))"` sin error; en el PR el job de front aparece en verde y el de Python sigue verde; el job ejecuta `npm audit --audit-level=high` | T002 | AC9 | 2 |
| T006 | [P] | Escribir el script de capturas (14 pestañas × tema oscuro y claro, animaciones desactivadas, nombre `<pestaña>-<tema>.png`) con Playwright como dependencia de desarrollo local; la URL base es un parámetro (`--url`) y el script documenta cómo arrancar el servidor contra una base sembrada aparte | con el servidor arrancado, `node frontend/scripts/capturas.mjs --salida <dir>` deja 28 PNG con los nombres esperados; su README explica crear la base `sorteos_capturas` y sembrarla con `python tests/seed_db.py` | T002 | AC1 | 1 |
| T007 |  | Capturar la referencia desde `main` contra una base sembrada aparte (`sorteos_capturas`, vacía y rellenada con `tests/seed_db.py`, con `DATABASE_URL` solo en el proceso del servidor de capturas) y guardarla en `02-DOCS/attachments/react-baseline/` | existen los 28 PNG; el dueño las revisa y lo confirma por escrito (puerta humana); la tabla `sorteos` real no se tocó (el servidor de capturas usó otra base) | T006 | AC1 | 1 |
| T059 |  | Abrir el PR de la etapa 0 desde `feat/react-frontend` con spec, plan, análisis y el código de la etapa, el panel de tres revisores registrado y la aprobación humana del merge | `gh pr view` muestra el PR; `npx @ericrisco/rsc review ledger panel frontend-react/T005 --lenses correctness,security,tests` registrado; el workflow `Tests` en verde; el dueño aprueba el merge (puerta humana) | T001–T007 | AC9, AC11 | 2 |
| **Etapa 1 — Contrato, puente, cimientos y primera isla (Gaps)** |  |  |  |  |  |  |
| T008 |  | Escribir `tests/gen_fixtures_front.py`, que guarda en `frontend/fixtures/` la respuesta real de cada endpoint más variantes con nulos (sin backtest, categoría sin premios de 4 cifras, extraordinario) | `python tests/gen_fixtures_front.py` crea los JSON; `python -c "import json,glob;[json.load(open(f)) for f in glob.glob('frontend/fixtures/*.json')]"` sin error | — | AC6 | 1 |
| T009 |  | Prueba de contrato `pytest` que compara la estructura (claves y tipos) de cada endpoint con su fixture | `pytest tests/test_contrato_front.py -q` en verde; al renombrar una clave de un fixture falla (mutación anotada en el progreso); compara las claves en los dos sentidos (API sin fixture y fixture sin API) y las variantes con nulos solo difieren en valores `null` | T008 | AC6 | 1 |
| T010 |  | Escribir los tipos TypeScript de las respuestas y declarar cada fixture con `satisfies` | `FE tipos` en verde; al renombrar un campo del tipo `Stats` falla (mutación anotada) | T002, T008 | AC6 | 1 |
| T011 |  | Implementar el cliente de API tipado con `Result<T>` y errores opacos, incluida `actualizar(token)` | `FE test api/client` en verde: red caída → `Error de conexión`, 500 → mensaje genérico sin traza | T010 | AC5 | 1 |
| T012 | [P] | Portar las utilidades de formato (`formatDate`, `catLabel`, `catClase`, `CAT_LABELS`, `fmtLift`, `liftBar`) | `FE test lib` en verde con las 4 categorías exactas, una desconocida y los formatos de §0 | T002 | AC4, AC10 | 1 |
| T013 |  | Implementar el componente `Balls` (esferas, aria, sin relleno) | `FE test components/Balls` en verde con premios `"98"`, `"0074"`, `"05309"` y `""`; una prueba falla si `padStart` o `zfill` aparece en cualquier archivo de `frontend/src` salvo `lib/numeroSimulador.ts` | T012 | AC4 | 1 |
| T014 |  | Definir la interfaz `Store`, el `StoreProvider` y los hooks con un `Store` falso | `FE test store` en verde | T010 | AC2 | 1 |
| T015 |  | Añadir el puente `window.LP` a `app.js` e implementar `LegacyStore`, con prueba de integración que carga el `app.js` real en jsdom | `FE test puente` en verde, con `templates/index.html` leído del disco (sus dos `url_for` sustituidos por `/static/<archivo>`) y `app.js` evaluado en jsdom con `fetch` simulado: cambios de `useML`, premio, tema y pestaña activa pasan de legacy a React y al revés; no hay `fetch` a `/api/sorteos` ni `/api/stats` desde React | T014 | AC2 | 1 |
| T016 |  | Implementar `main.tsx` (descubrimiento con `import.meta.glob` y montaje de islas por `data-react-root`) y `Skeleton` | `FE test main` en verde; `FE build` y la página cargan sin errores de consola (comprobado con el servidor) | T015, T004 | AC2 | 1 |
| T017 |  | Implementar la isla **Gaps** con su fixture (esqueleto, datos, error con reintento) (añade su `<div data-react-root>` a `index.html`) | `FE test tabs/Gaps` en verde; con estados de carga (`stats` nulo → esqueleto), vacío y error (genérico, con reintento si la pestaña tiene carga propia) | T011, T013, T016 | AC2 | 1 |
| T018 |  | Retirar de `app.js` e `index.html` el código y los `id` de Gaps; crear `tests/test_ids_retirados.py` (la guardia de ids retirados) | `PY` y `FE test` en verde; `node -e "new Function(require('fs').readFileSync('static/app.js','utf8'))"` sin error; la guardia falla si se reintroduce un `id` retirado | T017 | AC10 | 1 |
| T019 |  | Capturas de Gaps frente a la referencia y aprobación del dueño | capturas `gaps-oscuro` y `gaps-claro` generadas; el dueño confirma que coinciden; revisión manual del teclado (flechas, Inicio y Fin en la barra y en las subpestañas) y del cambio de tema, anotada en la verificación | T018, T007 | AC1, AC3 | 1 |
| **Etapa 2 — Seguimiento** |  |  |  |  |  |  |
| T020 |  | Implementar la isla **Seguimiento** (tabla y marcador, valores nulos como en legacy) (añade su `<div data-react-root>` a `index.html`) | `FE test tabs/Seguimiento` en verde con fixtures completo y con métricas `null`; con estados de carga (`stats` nulo → esqueleto), vacío y error (genérico, con reintento si la pestaña tiene carga propia) | T019 | AC2 | 1 |
| T021 |  | Retirar el código y los `id` de Seguimiento y ampliar la guardia | `PY`, `FE test` y la validación de sintaxis de `app.js` en verde | T020 | AC10 | 1 |
| T022 |  | Capturas de Seguimiento y aprobación del dueño | `seguimiento-oscuro` y `seguimiento-claro` generadas; el dueño confirma; revisión manual del teclado (flechas, Inicio y Fin en la barra y en las subpestañas) y del cambio de tema, anotada en la verificación | T021 | AC1, AC3 | 1 |
| **Etapa 3 — Mis Números y Comparador** |  |  |  |  |  |  |
| T023 |  | Implementar la isla **Mis Números** (`lp_favorites`, lectura tolerante a JSON roto, insignia del número de favoritos) (añade su `<div data-react-root>` a `index.html`) | `FE test tabs/Favoritos` en verde, incluido el JSON inválido → lista vacía; con estados de carga (`stats` nulo → esqueleto), vacío y error (genérico, con reintento si la pestaña tiene carga propia) | T022 | AC2 | 1 |
| T024 |  | Implementar la isla **Comparador** (etiquetas de números, `/api/comparar`, resultados) (añade su `<div data-react-root>` a `index.html`) | `FE test tabs/Comparador` en verde; con estados de carga (`stats` nulo → esqueleto), vacío y error (genérico, con reintento si la pestaña tiene carga propia) | T022 | AC2 | 1 |
| T025 |  | Retirar el código y los `id` de ambas pestañas y ampliar la guardia | `PY`, `FE test` y la validación de sintaxis en verde | T023, T024 | AC10 | 1 |
| T026 |  | Capturas de Mis Números y Comparador y aprobación del dueño | 4 capturas generadas; el dueño confirma; revisión manual del teclado (flechas, Inicio y Fin en la barra y en las subpestañas) y del cambio de tema, anotada en la verificación | T025 | AC1, AC3 | 1 |
| **Etapa 4 — Gráfico base, Simulador y Mensual** |  |  |  |  |  |  |
| T027 |  | Implementar el componente `Chart` (Chart.js empaquetado, colores de §0 por tema, destruir y recrear al cambiar de tema) con doble de pruebas y comprobación real en el navegador | `FE test components/Chart` en verde: cambiar el tema recrea el gráfico con los colores literales de §0; captura manual de un gráfico real en ambos temas | T014 | AC2 | 1 |
| T028 |  | Implementar la isla **Simulador** (categorías, `/api/simulador`, gráfico) (añade su `<div data-react-root>` a `index.html`), con `normalizarNumero` en `lib/numeroSimulador.ts` (el único relleno permitido: lo que teclea el usuario) | `FE test tabs/Simulador` en verde; con estados de carga (`stats` nulo → esqueleto), vacío y error (genérico, con reintento si la pestaña tiene carga propia); `normalizarNumero('74')` devuelve `'0074'` | T027, T011 | AC2 | 1 |
| T029 |  | Implementar la isla **Mensual** (perfil mensual con gráfico) (añade su `<div data-react-root>` a `index.html`) | `FE test tabs/Mensual` en verde; con estados de carga (`stats` nulo → esqueleto), vacío y error (genérico, con reintento si la pestaña tiene carga propia) | T027 | AC2 | 1 |
| T030 |  | Retirar el código y los `id` de ambas pestañas y ampliar la guardia | `PY`, `FE test` y la validación de sintaxis en verde | T028, T029 | AC10 | 1 |
| T031 |  | Capturas de Simulador y Mensual y aprobación del dueño | 4 capturas generadas; el dueño confirma; revisión manual del teclado (flechas, Inicio y Fin en la barra y en las subpestañas) y del cambio de tema, anotada en la verificación | T030 | AC1, AC3 | 1 |
| **Etapa 5 — Precisión** |  |  |  |  |  |  |
| T032 |  | Implementar la isla **Precisión** (`/api/backtesting`, tendencia móvil con gráfico) (añade su `<div data-react-root>` a `index.html`) | `FE test tabs/Precision` en verde; con estados de carga (`stats` nulo → esqueleto), vacío y error (genérico, con reintento si la pestaña tiene carga propia) | T031 | AC2 | 1 |
| T033 |  | Retirar el código y los `id` de Precisión y ampliar la guardia | `PY`, `FE test` y la validación de sintaxis en verde | T032 | AC10 | 1 |
| T034 |  | Capturas de Precisión y aprobación del dueño | 2 capturas generadas; el dueño confirma; revisión manual del teclado (flechas, Inicio y Fin en la barra y en las subpestañas) y del cambio de tema, anotada en la verificación | T033 | AC1, AC3 | 1 |
| **Etapa 6 — Resultados** |  |  |  |  |  |  |
| T035 |  | Implementar la isla **Resultados** (filtros, paginación de 50, exportar CSV, premios tal como llegan) (añade su `<div data-react-root>` a `index.html`) | `FE test tabs/Resultados` en verde con premios de 2, 4, 5 cifras y vacíos; con estados de carga (`stats` nulo → esqueleto), vacío y error (genérico, con reintento si la pestaña tiene carga propia) | T034, T013 | AC4, AC2 | 1 |
| T036 |  | Retirar el código y los `id` de Resultados y sustituir las pruebas por texto que lo cubrían | `PY`, `FE test` en verde; la tabla de trazabilidad (aserción vieja → prueba nueva) está en el archivo de verificación | T035 | AC10 | 1 |
| T037 |  | Capturas de Resultados y aprobación del dueño | 2 capturas generadas; el dueño confirma; revisión manual del teclado (flechas, Inicio y Fin en la barra y en las subpestañas) y del cambio de tema, anotada en la verificación | T036 | AC1, AC3 | 1 |
| **Etapa 7 — Subpestañas accesibles, Decenas y Terminaciones** |  |  |  |  |  |  |
| T038 |  | Implementar el componente `Tablist` accesible (flechas, Inicio, Fin, foco, `aria-selected`, `aria-controls`) | `FE test components/Tablist` en verde con userEvent para cada tecla | T037 | AC3 | 1 |
| T039 |  | Implementar la isla **Decenas** (recomendación, método, backtest nulo) (añade su `<div data-react-root>` a `index.html`) | `FE test tabs/Decenas` en verde con y sin backtest; con estados de carga (`stats` nulo → esqueleto), vacío y error (genérico, con reintento si la pestaña tiene carga propia) | T037 | AC2 | 1 |
| T040 |  | Implementar la isla **Terminaciones** (selector de categoría con `Tablist`, mapa de calor, gráfico de tendencia, backtest nulo) (añade su `<div data-react-root>` a `index.html`) | `FE test tabs/Terminaciones` en verde; con estados de carga (`stats` nulo → esqueleto), vacío y error (genérico, con reintento si la pestaña tiene carga propia) | T038, T027 | AC2, AC3 | 1 |
| T041 |  | Retirar el código y los `id` de ambas pestañas y ampliar la guardia | `PY`, `FE test` y la validación de sintaxis en verde | T039, T040 | AC10 | 1 |
| T042 |  | Capturas de Decenas y Terminaciones y aprobación del dueño | 4 capturas generadas; el dueño confirma; revisión manual del teclado (flechas, Inicio y Fin en la barra y en las subpestañas) y del cambio de tema, anotada en la verificación | T041 | AC1, AC3 | 1 |
| **Etapa 8 — Predicciones** |  |  |  |  |  |  |
| T043 |  | Implementar el panel de resumen de Predicciones (último sorteo con esferas, KPIs) (añade su `<div data-react-root>` a `index.html`) | `FE test tabs/Predicciones/Dashboard` en verde con los tres premios y el formato `""`; con estados de carga (`stats` nulo → esqueleto), vacío y error (genérico, con reintento si la pestaña tiene carga propia) | T042, T013 | AC2, AC4 | 1 |
| T044 |  | Implementar las recomendaciones de Predicciones (selector de premio y de categoría con `Tablist`, interruptor ML, `×N azar`, copiar número) | `FE test tabs/Predicciones/Recomendaciones` en verde; alternar ML y premio se refleja en las pestañas legacy restantes; con estados de carga (`stats` nulo → esqueleto), vacío y error (genérico, con reintento si la pestaña tiene carga propia) | T043, T038 | AC2, AC3 | 1 |
| T045 |  | Retirar el código y los `id` de Predicciones y migrar a pruebas de componente las aserciones de `test_ui_assets.py` sobre `app.js` (`renderBalls`, `dashboard-hero-grid`, etc.) | `PY` y `FE test` en verde; trazabilidad de aserciones en el archivo de verificación | T044 | AC10, AC4 | 1 |
| T046 |  | Capturas de Predicciones y aprobación del dueño | 2 capturas generadas; el dueño confirma; revisión manual del teclado (flechas, Inicio y Fin en la barra y en las subpestañas) y del cambio de tema, anotada en la verificación | T045 | AC1, AC3 | 1 |
| **Etapa 9 — Estadísticas, Tendencias y Análisis** |  |  |  |  |  |  |
| T047 |  | Implementar la isla **Estadísticas** (posiciones, calientes y fríos, series y letras, panel de otros formatos, selector de premio) (añade su `<div data-react-root>` a `index.html`) | `FE test tabs/Estadisticas` en verde con premios de 2 y 5 cifras; con estados de carga (`stats` nulo → esqueleto), vacío y error (genérico, con reintento si la pestaña tiene carga propia) | T046 | AC4, AC2 | 1 |
| T048 |  | Implementar la isla **Tendencias** (gráficos de tendencia y volumen) (añade su `<div data-react-root>` a `index.html`) | `FE test tabs/Tendencias` en verde; con estados de carga (`stats` nulo → esqueleto), vacío y error (genérico, con reintento si la pestaña tiene carga propia) | T046, T027 | AC2 | 1 |
| T049 |  | Implementar la isla **Análisis** (radar y dispersión) (añade su `<div data-react-root>` a `index.html`) | `FE test tabs/Analisis` en verde; con estados de carga (`stats` nulo → esqueleto), vacío y error (genérico, con reintento si la pestaña tiene carga propia) | T046, T027 | AC2 | 1 |
| T050 |  | Retirar el código y los `id` de las tres pestañas, vaciar `renderFull` y ampliar la guardia | `PY`, `FE test` y la validación de sintaxis en verde; `app.js` ya no contiene ninguna función `render*` de pestaña | T047, T048, T049 | AC10 | 1 |
| T051 |  | Capturas de las tres pestañas y aprobación del dueño | 6 capturas generadas; el dueño confirma; revisión manual del teclado (flechas, Inicio y Fin en la barra y en las subpestañas) y del cambio de tema, anotada en la verificación | T050 | AC1, AC3 | 1 |
| **Etapa 10 — Armazón en React y retirada del legacy** |  |  |  |  |  |  |
| T052 |  | Implementar `ReactStore` (carga en dos fases, límite 180 000 ms, 3 reintentos, tema, pestaña activa) | `FE test store/reactStore` en verde: reintenta y no muestra datos a medias | T051 | AC2, AC7 | 1 |
| T053 |  | Implementar la barra de pestañas, el cambio de tema y el enlace de salto con teclado y roles ARIA | `FE test shell/Tabs` en verde (flechas, Inicio, Fin, foco, `aria-selected`, persistencia del tema) | T052, T038 | AC3 | 1 |
| T054 |  | Implementar el botón de actualizar y el token (`prompt`, `sessionStorage`, 401, 503, 502, 500 opacos) | `FE test shell/Actualizar` en verde con los cinco códigos | T052, T011 | AC5 | 1 |
| T055 |  | Dejar una plantilla mínima (raíz, fuentes, `style.css`), borrar `static/app.js` y la CDN de Chart.js | `test -e static/app.js` falla (no existe); `grep -c "cdn.jsdelivr" templates/index.html` imprime 0; `PY`, `FE tipos`, `FE test`, `FE build` en verde | T053, T054 | AC7 | 1 |
| T056 |  | Podar pruebas y archivos sin uso y añadir el servidor de desarrollo con recarga y reenvío de `/api` (el servidor con recarga es la suposición opcional de la spec, no un criterio) | `grep -rn "static/app.js" tests` vacío; `npm --prefix frontend run dev` sirve la app contra Flask (comprobado) | T055 | AC7, AC10 | 1 |
| T057 |  | Capturas finales de las 14 pestañas en ambos temas y aprobación del dueño | 28 capturas generadas; el dueño confirma contra la referencia; revisión manual del teclado (flechas, Inicio y Fin en la barra y en las subpestañas) y del cambio de tema, anotada en la verificación | T055 | AC1, AC3 | 1 |
| T058 |  | Cierre: todos los done-checks y la verificación de cierre pasan | cada fila anterior marcada; `PY`, `FE tipos`, `FE test`, `FE build` y `pip-audit` en verde; PR de cierre con CI en verde; `npm audit --audit-level=high` en verde | todas | AC1–AC11 | — |

### Interfaces (tareas con contrato entre ellas)

**T011 — Interfaces**
- Consumes: formato de consulta de §0 (`numeros=a,b,c`; `numero`, `cat`, `from`, `to`; `last_n`).
- Produces: `type SimParams = { numero: string; cat?: string; from?: string; to?: string }` (`numero` ya normalizado a 4 cifras por `normalizarNumero`); `type Result<T> = { ok: true; data: T } | { ok: false; mensaje: string }`; `getGaps(): Promise<Result<Gaps>>`, `getSeguimiento(): Promise<Result<Seguimiento>>`, `getBacktesting(lastN: number): Promise<Result<Backtesting>>`, `comparar(numeros: string[]): Promise<Result<Comparacion>>`, `simular(params: SimParams): Promise<Result<Simulacion>>`, `actualizar(token: string): Promise<{ status: number; ok: boolean; mensaje?: string; ml_retrained?: boolean }>`. El `mensaje` es siempre genérico (`'Error de conexión'` o el `error` público del servidor).

**T012 — Interfaces**
- Produces: `formatDate(d: string | null | undefined): string` (`'—'` si falta); `catLabel(k: string): string`; `catClase(k: unknown): string`; `CAT_LABELS: Record<'dominical' | 'miercolito' | 'gordito' | 'extraordinario', string>`; `fmtLift(x: number | null | undefined): string`; `liftBar(x: number | null | undefined): number`.

**T013 — Interfaces**
- Produces: `<Balls valor: string | null | undefined; variante?: 'gold' | 'green' | 'purple'; tamano?: 'sm' | 'md' | 'lg' />` con los valores por defecto de `renderBalls` (`'gold'`, `'lg'`). Valor vacío → `<span class="num-empty">—</span>`; si no, `<span class="lotto-balls lotto-balls-{tamano}" aria-label="{valor}">` con un `<span class="lotto-ball ball-{variante}" aria-hidden="true">` por carácter, sin transformar el texto.

**T014 — Interfaces**
- Produces: `interface Store { getSnapshot(): Snapshot; subscribe(l: () => void): () => void; actions: { setUseML(v: boolean): void; setPrize(p: Prize): void; setStatsPrize(p: Prize): void; toast(msg: string, ms?: number): void; reload(): Promise<void> } }`; `type Snapshot = { sorteos: Sorteo[]; stats: Stats | null; useML: boolean; prize: Prize; statsPrize: Prize; theme: 'light' | 'dark'; activeTab: TabId; ready: boolean }`; `type Prize = 'primero' | 'segundo' | 'tercero'`. Hooks: `useSorteos()`, `useStats()` (nulo mientras carga), `useML()`, `usePrize()`, `useStatsPrize()`, `useTheme()`, `useActiveTab()`.

**T015 — Interfaces**
- Consumes: variables de `app.js` `allSorteos`, `stats`, `useML`, `currentPrize`, `currentStatsPrize`; funciones `showToast`, `loadData`.
- Produces: `window.LP = { getSnapshot(): Snapshot; subscribe(fn): () => void; setUseML(v); setPrize(p); setStatsPrize(p); toast(msg, ms); reload() }` y el evento `CustomEvent('lp:change', { detail: 'sorteos' | 'stats' | 'useML' | 'prize' | 'statsPrize' | 'theme' | 'activeTab' })` en `document`. No expone funciones `render*`.

**T016 — Interfaces**
- Produces: cada módulo de `frontend/src/tabs/` exporta `nombre: string` (igual al `data-tab` de la barra) y `Componente: () => JSX.Element`; `main.tsx` los descubre con `import.meta.glob('./tabs/*.tsx', { eager: true })` y monta cada uno en `[data-react-root="<nombre>"]` si existe. Marcado en la plantilla: `<div data-react-root="gaps"></div>` dentro de `<section id="sec-gaps">`. `<Skeleton lineas?: number />` (por defecto 3) renderiza `<div class="skeleton">` con una línea `skel-line thick w60` y las siguientes alternando `w80` y `w40`, como `skelCard`.

**T027 — Interfaces**
- Produces: `<Chart type={ChartType} datos={(tema: 'light' | 'dark') => ChartData} opciones={(tema) => ChartOptions} altura?: number />`; `chartOptions(tema: 'light' | 'dark', leyenda?: boolean): ChartOptions` con los colores literales de §0. Destruye el gráfico al desmontar y lo recrea al cambiar `tema` o los datos.

**T038 — Interfaces**
- Produces: `<Tablist etiqueta: string pestañas: { id: string; texto: string }[] valor: string onCambio(id: string): void idPrefijo: string />` con `role="tablist"`/`tab`, `aria-selected`, `aria-controls`, `tabindex` móvil; teclas: Flecha izquierda/derecha (circular), Inicio, Fin.

## Review Workload Forecast

| Dimension | Forecast | Why |
| --- | --- | --- |
| Estimated changed lines | 7 000 – 9 000 añadidas y ~1 500 retiradas en total; 300 – 900 por PR de etapa (la etapa 1 y la 10 son las mayores) | 14 pestañas portadas con su prueba y su fixture, más cimientos y armazón; el legacy se va retirando por etapa |
| Files / areas | `frontend/` (código, pruebas, fixtures, scripts), `static/app.js`, `templates/index.html`, `app.py`, `tests/`, `.github/workflows/tests.yml`, `.gitignore`, `02-DOCS/` (constitución, capturas, verificaciones) | front nuevo, servidor mínimo, CI y documentación |
| Risk | máximo tier 2 (T005, el workflow de CI, y T059, el PR que lo contiene); 2 tareas tier 2, 55 tier 1, 1 tier 0 y el cierre sin pronóstico | T005 exige panel de tres revisores y aprobación humana del merge, que se gestiona en T059 |
| Suggested delivery | `autochain`: 11 PRs encadenados, uno por etapa, cada uno por debajo del presupuesto de revisión | muchas áreas y un contrato entre etapas (puente y almacén); `02-DOCS/wiki/sdd/config.yaml` no existe, así que el presupuesto de 400 líneas es el valor por defecto y conviene fijarlo con `sdd-init` |

## Revisiones
- 2026-11-11 — Tras el primer `analyze` (3 HIGH, 9 MEDIUM, 4 LOW): §0 limita la prohibición de relleno a los premios y fija el formato de las consultas; la etapa 0 se hace en `feat/react-frontend` (rama enlazada en la spec, con spec, plan y análisis en su PR, T059); las capturas usan una base sembrada aparte; T002 depende de T001; el principio 5 se amplía a Node (T001, T005); toda isla afirma estados de carga, vacío y error; se añaden interfaces de T012, T013 y `Skeleton`; el descubrimiento de islas es automático y se quitan los `[P]` que compartían archivos; el diseño de la prueba del puente (T015) queda fijado; se retira la comparación automática por píxeles. Informe: [análisis](../analysis/frontend-react.md).
