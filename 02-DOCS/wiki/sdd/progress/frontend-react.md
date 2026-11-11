---
type: progress
title: Progreso — Migrar el front-end a React
description: Registro append-only de la implementación de frontend-react, tarea a tarea, con evidencia, riesgo y cola de decisiones.
tags: [sdd, progress]
timestamp: 2026-11-11T16:10:00Z
topic: sdd
slug: frontend-react
---

# Progreso — Migrar el front-end a React

Spec: [frontend-react](../specs/frontend-react.md) · Plan y tareas: [plan](../plans/frontend-react.md) · Rama de la etapa 0: `feat/react-frontend`.

## Preparación (gate de implement) — 2026-11-11
- spec, plan, tareas y análisis (PASS, 2 LOW) existen y están aprobados; rama aislada en `.worktrees/feat-react-frontend`.
- Faltaba `02-DOCS/wiki/sdd/config.yaml`: creado con `sdd-init` (strict TDD, pytest, presupuesto 900 líneas / 25 archivos). Registro de skills refrescado (273 skills).
- Selected skills: `implement`, `constitution`; `python`/`testing` según la tarea.

## T001 — 2026-11-11
- status: complete
- qué: constitución enmendada a v2.0.0 (MAJOR): principios 1, 2, 3, 5, 6 y 14 y definición de hecho; las versiones anteriores quedan tachadas en «Principios reemplazados»; fila en el registro de enmiendas; índice del wiki actualizado.
- ratificación: el dueño ratificó el texto mostrado (opción «Ratifico v2.0.0») el 2026-11-11.
- done-check: `grep -c "v2.0.0"` = 10 (≥ 2); la frase «sin bundlers ni frameworks» ya no está en el principio 1 (solo en el bloque tachado); fila `2026-11-11 | v2.0.0` presente; el principio 5 menciona `npm audit`.
- risk: tier 0 (docs) — sin revisor.
- controls: tests n/a (solo documentación, sin código tocado) · build n/a · security n/a · traceability ✅ (AC11).
- nota: la v2.0.0 nombra `.nvmrc` para la versión de Node; T002 debe crearlo.
- nota: no existe `REVIEW.md` en la raíz (tampoco existía en la v1.0.0). Queda fuera de T001; ver cola de decisiones.

## Decision queue
- [review-after] Q1 — No existe `REVIEW.md` en la raíz del repo (lo lee el revisor de `implement` y `review`); sin él los revisores usan solo la constitución, evidencia: `ls REVIEW.md` no existe, T001 (se propone crearlo con la skill `constitution` antes de la primera revisión de tier 1, T002)

## T002 — 2026-11-11
- status: complete (commit 362d164)
- qué: `frontend/` con TypeScript estricto, Vite (salida fija `static/dist/app.js`), Vitest con jsdom y `passWithNoTests`, React 19.3.1, Chart.js 4.6.1 y librerías de prueba, todo con versión exacta y `package-lock.json`; `.nvmrc` = 22.23.4; entradas de `.gitignore`; comandos de front añadidos a `config.yaml`.
- done-check (códigos de salida reales): `npm ci` 0 · `typecheck` 0 · `test -- --run` 0 (sin archivos de prueba, `passWithNoTests`) · `build` 0 con `static/dist/app.js` presente · `git check-ignore` imprime `static/dist/app.js` y `frontend/node_modules` · `npm audit --audit-level=high`: 0 vulnerabilidades.
- risk: tier 1 (`rsc risk`) — un revisor.
- review: ronda 1 → 0 hallazgos, `VERDICT: pass`.
- controls: tests ✅ build ✅ security ✅ (npm audit) traceability ✅ (AC9).
- nota del revisor (sin acción): `tsconfig.json` ya incluye `fixtures/`, que llega con T008/T010.

## T003 + T004 — 2026-11-11
- status: complete
- red (T003): `pytest tests/test_frontend_build.py` con `FRONTEND_BUILD` solo como stub: 2 failed (`test_muestra_el_aviso_con_el_comando_para_construir`, `test_incluye_el_script_como_modulo`), 3 passed. Un primer intento sin el stub fallaba con `AttributeError` en el fixture (rojo por la razón equivocada) y se corrigió.
- green (T004): `index()` pasa `react_built=os.path.isfile(FRONTEND_BUILD)`; la plantilla muestra el aviso con `role="alert"` y el comando para construir si falta, o carga `dist/app.js` como `type="module"` si existe; estilo `.build-notice` con variables del tema. `pytest tests/test_frontend_build.py tests/test_ui_assets.py tests/test_api.py`: 23 passed.
- files: app.py, templates/index.html, static/style.css, tests/test_frontend_build.py
- desviación del done-check de T004: la comprobación «la API sigue respondiendo» usa `/api/sorteos` y no `/api/stats`, porque `/api/stats` tarda en entrenar el modelo y escribe recomendaciones en la tabla `predicciones` de la base real al ejecutarse en local. Ver decisions.md.

## T005 — 2026-11-11
- status: complete (commit 365f9a2; panel de tres lentes en `pass`)
- qué: job `frontend` en `.github/workflows/tests.yml` (Node de `.nvmrc`, caché de npm sobre `frontend/package-lock.json`, `npm ci`, typecheck, tests, build y `npm audit --audit-level=high`), sin servicio de MariaDB; el job de Python no cambia.
- done-check: el YAML se carga con PyYAML y declara los jobs `test` y `frontend`; el verde del job en el PR se comprueba en T059.
- risk: tier 2 (`rsc risk`: clase `ci`, 3 revisores, aprobación humana) — panel de refutadores.

### Revisión de T003 + T004 — 2026-11-11
- ronda 1 → 0 hallazgos, `VERDICT: pass`.

### Revisión de T005 — panel de tres refutadores
- seguridad: `VERDICT: pass`, 1 nit (acciones fijadas por etiqueta mayor, no por SHA) → cerrado `intentional`: es la convención del job de Python y son acciones de primera parte.
- pruebas: `VERDICT: pass`, 1 question (`passWithNoTests` deja el job verde sin ninguna prueba) → cerrado `intentional` para T002, con seguimiento: ver cola de decisiones (Q2).
- corrección: `VERDICT: pass`, 0 hallazgos (ejecutó `npm ci`, typecheck, test, build y audit en `frontend/`, todo en verde).
- panel registrado con `rsc review ledger panel frontend-react/T005 --lenses correctness,security,tests`.

## Decision queue (adiciones)
- [resuelto en T006] Q2 — Quitar `passWithNoTests` de `frontend/vite.config.ts` cuando exista la primera prueba de componente (T010–T012), para que el job de front no pueda dar verde sin ejecutar pruebas, evidencia: hallazgo L2 del panel de T005, T005
- controls T005: tests ✅ (los comandos del job corren en local) · build ✅ · security ✅ (panel + `npm audit` 0) · traceability ✅ (AC9). El verde del job en el PR queda para T059.

## T006 — 2026-11-11
- status: parcial (código y pruebas listos; el done-check completo espera la base sembrada)
- qué: `frontend/scripts/capturas.mjs` (14 pestañas × tema oscuro y claro, ventana 1280×800, animaciones CSS y de Chart.js desactivadas, espera a que desaparezcan esqueletos y cargadores, captura solo la sección activa), `frontend/scripts/README.md` (cómo crear y sembrar `sorteos_capturas`, y por qué nunca contra la base real) y Playwright 1.65.0 como dependencia de desarrollo con versión exacta.
- red/green: `frontend/scripts/capturas.test.mjs` (8 pruebas del análisis de argumentos y de las listas de pestañas y temas) en verde; al quitar `seguimiento` de la lista fallan 3 (mutación comprobada y revertida). Nota honesta: el script se escribió antes que su prueba; la prueba se escribió después y se validó con la mutación.
- `passWithNoTests` retirado de `frontend/vite.config.ts` ahora que existe una prueba: cierra la Q2 de la cola (el job de front ya no puede dar verde sin ejecutar pruebas).
- comprobado: typecheck 0 · test 0 (8 passed) · build 0 · `npm audit` 0 · el script sale con código 1 y mensaje claro sin `--salida` o con una pestaña desconocida.
- pendiente: «con el servidor arrancado, el script deja 28 PNG». Necesita la base `sorteos_capturas` sembrada y el navegador de Playwright (`npx playwright install chromium`).
- risk: tier 1 — la revisión de un revisor se hace al completar el done-check, para no gastar rondas sobre código aún sin ejecutar de punta a punta.

## T006 / T007 — incidente y estado — 2026-11-11
- hecho: base `sorteos_capturas` creada en el MariaDB local con las credenciales del `.env` (solo `CREATE DATABASE` y siembra de 600 sorteos sintéticos con `tests/seed_db.py`; la base real no se tocó). Chromium de Playwright instalado.
- incidente: el servidor de capturas arrancó en el puerto 5000, donde ya corría el servidor de desarrollo del dueño (PID 24532, desde el 6 de noviembre, contra la base real). Windows permitió el segundo enlace y las peticiones iban al primero: `/api/sorteos` devolvió 9296 sorteos en vez de 600. Se detectó **antes de lanzar ninguna captura**, así que `/api/stats` no se ejecutó contra la base real y no se escribió nada en `predicciones`. Solo se hicieron 3 lecturas (`GET /` y dos `GET /api/sorteos`).
- lección: README de capturas actualizado: servidor de capturas siempre en el puerto 5001 y comprobar que `total` es 600 antes de capturar.
- bloqueo: el servidor de capturas propio (árbol de procesos 52204, arrancado a las 09:47) sigue vivo y orphan; detenerlo por PID fue rechazado por el sistema de permisos y no se intentó otra vía. Lo debe cerrar el dueño o autorizar el cierre.
- pendiente: capturas de T006 y T007 (28 PNG de referencia) y su aprobación, más la revisión de T006 y T059.

## T006 — cierre — 2026-11-11
- status: complete (revisada en 3 rondas, ver abajo)
- done-check cumplido: con el servidor de capturas en el puerto 5001 (comprobado antes: `total` = 600, mientras el servidor del dueño en el 5000 servía 9296), `node frontend/scripts/capturas.mjs --salida 02-DOCS/attachments/react-baseline --url http://127.0.0.1:5001` deja 28 PNG (14 pestañas × oscuro y claro), exit 0, 4,9 MB en total, sin archivos vacíos.
- fallo encontrado y corregido: la primera ejecución se quedó 300 s en `precision` porque su cargador (`#precisionLoader`) se queda en el DOM con `display:none`; ahora la espera solo cuenta elementos visibles (`offsetParent !== null`). `/api/backtesting` respondía en 1,4 s.
- reproducibilidad: una segunda captura de Gaps, Seguimiento y Mensual no coincide byte a byte con la primera, pero Gaps es visualmente idéntica (comprobada con las dos imágenes). La diferencia viene del fondo difuminado de la página. La comparación sigue siendo a ojo, como decide el plan.
- observación: una pastilla vacía abajo al centro aparece en todas las capturas (el `#toast` de la interfaz actual, sin texto). Saldrá igual en las de «después» mientras ese elemento siga igual.
- servidor de capturas: ahora `servidor_capturas.py` (en el scratchpad, fuera del repo) con apagado por archivo centinela y tope de 30 min; se apagó solo y no dejó procesos.

## T007 — 2026-11-11
- status: capturas hechas; **a la espera de la aprobación del dueño** (puerta humana)
- 28 PNG en `02-DOCS/attachments/react-baseline/`, sacadas con la interfaz actual (sin cambios todavía) sobre la base sembrada `sorteos_capturas`.
- la tabla `sorteos` real no se tocó (el servidor de capturas usó otra base).
- verificadas a ojo por el agente: `gaps-oscuro`, `predicciones-oscuro` y `precision-claro` muestran datos reales, no esqueletos.

### Revisión de T006 — ronda 1 (1 blocker, 1 should-fix, 1 nit) — 2026-11-11
- blocker (verificado en `estadisticas-oscuro.png`): las tarjetas `.reveal` nacen con `opacity:0` y solo se ven cuando un IntersectionObserver las ve entrar en pantalla; el script no hace scroll, así que la mitad inferior de las capturas largas salía en blanco (en Estadísticas faltaban Series, Letras, radar, dispersión y «Otros formatos»). **Error del agente:** se dio T006 por bueno tras mirar solo 3 de las 28 capturas, sin mirar las pestañas largas.
- should-fix: la URL por defecto era el puerto 5000, donde puede estar la base real, y no había guarda.
- nit: `nombre in opciones` aceptaba claves del prototipo (`--toString`).
- corrección (ronda de arreglos 1): `CSS_CAPTURA` fuerza `.reveal` visible; el script espera y falla si queda alguna tarjeta transparente; URL por defecto 5001; nueva guarda `comprobarBase` / `--sorteos` (por defecto 600) que se niega a capturar si el servidor no sirve exactamente esos sorteos; `Object.hasOwn`.
- red: con stubs de `CSS_CAPTURA` y `comprobarBase`, 12 pruebas nuevas fallaron en aserciones. green: 19 pruebas en verde; typecheck 0; build 0.
- comprobado contra el caso real del incidente: `capturas.mjs --url http://127.0.0.1:5000` termina con exit 1 y `sirve 9296 sorteos y se esperaban 600`, sin crear la carpeta de salida.
- las 28 capturas se rehicieron. Revisadas a ojo, completas: `estadisticas-oscuro`, `terminaciones-oscuro` y `tendencias-claro` (las pestañas largas que antes salían con huecos).

### Revisión de T006 — ronda 2 (1 should-fix, 3 nits, 1 question) — 2026-11-11
- should-fix (L6, arreglado): el cableado `capturar` → `comprobarBase` no tenía prueba; borrar la guarda dejaba las pruebas en verde. Ahora `capturar` acepta `{ fetchFn, motor }` inyectables y dos pruebas comprueban que con una base distinta de la sembrada no se crea la carpeta ni se lanza el navegador, y que con la sembrada sí se lanza. Mutación comprobada: al borrar la llamada falla exactamente esa prueba.
- nit L7 (cerrado `intentional`): la comprobación de opacidad no demuestra que la pestaña tenga contenido. Se corrigió la promesa del README para decir lo que de verdad comprueba y recordar que hay que mirar las capturas nuevas.
- nit L8 (arreglado): `--sorteos` solo acepta enteros positivos (`0` y vacío se rechazan), con pruebas.
- nit L9 (arreglado): la guarda usa un tiempo límite de 10 s.
- question L10 (arreglado): una respuesta sin `total` da «respuesta inesperada» en vez de «sirve undefined sorteos».
- red: 5 pruebas fallaron antes (con URL a la que nadie escucha, sin tocar el servidor real); green: 22 pruebas; typecheck 0; build 0.

### Revisión de T006 — ronda 3 (0 blockers, 2 nits) — 2026-11-11
- `VERDICT: pass`. Dos nits de pruebas débiles (L11 duración del tiempo límite, L12 totales no enteros), cerrados `fixed` sin abrir otra ronda (el ledger permite 3): `TIEMPO_GUARDA_MS` exportado y comprobado entre 1 y 30 s, y 5 casos de total no entero (`null`, `'600'`, `600.5`, `NaN`, ausente) con «respuesta inesperada».
- evidencia final de T006: 28 pruebas en verde, typecheck 0, build 0, `npm audit` 0; la guarda contra el puerto 5000 sigue rechazando con `sirve 9296 sorteos` y exit 1.
- controls T006: tests ✅ build ✅ security ✅ (la guarda y `npm audit`) traceability ✅ (AC1) — 3 rondas de revisión, 9 hallazgos cerrados (7 fixed, 2 intentional).
- status T006: **complete**.

## T007 — cierre — 2026-11-11
- status: complete
- puerta humana: el dueño aprobó las 28 capturas de `02-DOCS/attachments/react-baseline/` como referencia de AC1 («Aprobadas»), con la salvedad de que usan datos sintéticos (600 sorteos) y de la pastilla vacía del `#toast`.

## Verificación previa al PR de la etapa 0 — 2026-11-11
- `pytest -q -W error::SyntaxWarning` completo: **268 passed**, contra la base sembrada `sorteos_capturas` (como el CI), nunca contra la real.
- `pip-audit -r requirements.txt --ignore-vuln PYSEC-2026-217`: sin vulnerabilidades (1 ignorada, la ya conocida).
- `npm audit --audit-level=high`: 0 vulnerabilidades. `typecheck` 0 · `test -- --run` 28 passed · `build` 0.
- sintaxis de `static/app.js` válida.
- limpieza del análisis: LOW 17 (T007 «desde main») superado: las capturas se hicieron con la interfaz sin cambios en esta rama; LOW 18 (plan §2 decía «isla registrada») corregido.
- estado: T001–T007 completas; falta T059 (PR de la etapa 0).

## T059 — 2026-11-11
- status: en curso. PR de la etapa 0 abierto: https://github.com/rafawilliams/sorteos/pull/37 (rama `feat/react-frontend`, 19 commits). Panel de tres lentes registrado para T005; spec vinculada a la rama; tier 2 → el merge lo aprueba el dueño.
- CI: el job nuevo **`frontend` pasa** (12 s: ci, typecheck, test, build, audit). El job `test` (Python) **falló dos veces** en el paso ya existente «Install MariaDB Connector/C»: `apt-get` no resuelve `azure.archive.ubuntu.com` (`Temporary failure resolving`, salida 100) antes de ejecutar ninguna prueba; tarda 6 min 30 s en agotar reintentos. No es del cambio (el paso no se tocó; las ejecuciones de `main` de los últimos días pasaron). Se relanzó una vez con `gh run rerun --failed` y falló igual. Se vuelve a lanzar con un commit nuevo.
- mergeable: `MERGEABLE` sin conflictos (main avanzó 3 commits que solo tocan `.rsc.json` y `02-DOCS/wiki/ftd/pool-conexiones.md`).
- no se modifica el workflow para sortear el fallo de `apt`: sería otro cambio de tier 2 fuera de alcance; si persiste, decisión del dueño.

# Etapa 1 — contrato, puente, cimientos y primera isla (Gaps)
Rama `feat/react-etapa-1-contrato`, apilada sobre `feat/react-frontend` (PR #37 aún sin fusionar; cuando se fusione se redirige a `main`). Worktree `.worktrees/react-etapa-1`.

## T008 — 2026-11-11
- status: complete (en revisión)
- qué: `tests/gen_fixtures_front.py` guarda en `frontend/fixtures/` la respuesta real de cada endpoint GET (recortada a 25 elementos por lista) y variantes con nulos obtenidas llamando al mismo código con otros datos: `stats_pocos_sorteos` (150 sorteos → sin backtests), `stats_con_backtests` (sorteos duplicados 7 años atrás, 1200 → backtests con valores), `stats_formatos_reales` (extraordinario de 5 cifras y gordito de 2), `seguimiento_vacio` (base en memoria sin registros), `comparar_sin_apariciones` y `simulador_sin_aciertos` (un número que nunca salió). Se niega a correr si la base no tiene exactamente 600 sorteos.
- red: 8 de 14 pruebas fallaron contra el esqueleto; después, 7 pruebas nuevas de `duplicar_hacia_atras` (3 fallaron antes de implementarla). green: 21 pruebas. Mutación comprobada: recortar sin recortar hace fallar 3.
- hallazgo propio durante la tarea: con 600 sorteos sembrados los tres fixtures de estadísticas salían con **todos** los backtests en `null` (cada categoría tiene ~150 sorteos y el backtest necesita 230), lo que habría dado un falso verde al contrato. Se añadió la variante `stats_con_backtests`.
- done-check: `gen_fixtures_front.py` crea 13 JSON válidos (271 KB). Se ejecutó contra la base sembrada `sorteos_capturas` mediante un envoltorio que comprueba los 600 sorteos antes de lanzar.
- no cubierto por fixtures (se tipa leyendo el código): `POST /api/actualizar` (401, 502, 503, 504 y éxito), porque generarlo ejecutaría la sincronización externa.

### Revisión de T008 — ronda 1 (2 should-fix, 2 nits) — 2026-11-11
- should-fix L1 (arreglado): `seguimiento.json` salía idéntico al vacío porque la base sembrada llega a 2019 y Seguimiento solo congela categorías con un sorteo en el último año. Ahora `_seguimiento_con_datos` lleva las fechas al presente (`desplazar_fechas`), calcula una vez sin los 12 sorteos más nuevos (se congelan las recomendaciones) y otra con todos; en una base en memoria. Resultado: 4 comparados, 4 pendientes y 8 sin registro.
- should-fix L2 (arreglado): `generar(destino, contar)` acepta un `contar` inyectable, aborta antes de importar la aplicación o escribir, y dos pruebas exigen que se llame a ese `contar` y que no quede nada escrito con 9296 o 0 sorteos.
- nit L3 (arreglado): prueba de ids únicos con los 600 ids reales de la base sembrada.
- nit L4 (arreglado): nueva variante `backtesting_sin_modelo.json` (`ml: {}`, con el modelo sustituido por uno sin entrenar).
- red: 4 pruebas fallaron por aserciones antes de implementar; green: 28 pruebas. 14 fixtures regenerados.

### Revisión de T008 — ronda 2 (1 should-fix, 2 nits, 1 question) — 2026-11-11
- should-fix L5 (arreglado): los fixtures de Seguimiento dependían del reloj (`date.today()` y `datetime.now()`). Ahora hay un reloj fijo (`HOY_FIJO` = 2026-01-15, `AHORA_FIJO`): `llevar_al_presente` mueve las fechas a ese «hoy» y `_reloj_fijo` hace que `seguimiento.registrar` lo use. Además `fijar_valores_volatiles` fija `ml_info.train_date` (hora de entrenamiento del modelo, que cambia con cada worktree). Comprobado: dos generaciones seguidas dan el mismo hash en los 14 fixtures y ninguno contiene la fecha de hoy.
- nit L6 (arreglado): dos pruebas nuevas (con `sys.modules["app"] = None`) fijan que la guarda va antes de importar la aplicación y que con 600 sorteos deja pasar. Mutación comprobada: mover la guarda tras el import hace fallar una.
- nit L7 (arreglado a nivel de fixture): `test_el_fixture_de_seguimiento_trae_comparados_y_pendientes_con_datos` (en T009). Mutante comprobado: con `ULTIMOS_SIN_COMPARAR = 0` el generador deja `comparados: 0`, y esa prueba lo detectaría.
- nit L8 (arreglado): `llevar_al_presente` usa el sorteo más nuevo con `max`, no `sorteos[0]`.
- question (sin acción): `SimpleNamespace(trained=False)` sustituye a `predictor` solo mientras se pide `/api/backtesting`, que hoy solo lee `.trained`; si esa ruta usara otro atributo daría un 500 que `_pedir` convierte en un error claro.
- red: 3 de 8 pruebas nuevas fallaron antes de implementar; green: 35 pruebas del generador.
- nota del revisor: `comparison.best_method` sale «ML» con `ml: {}` (comportamiento real de la API con el modelo sin entrenar); el front no debe tomarlo como verdad semántica.

## T009 — 2026-11-11
- status: complete (en revisión)
- qué: `tests/contrato_front.py` (`aplanar` y `diferencias`: reduce un JSON a «ruta → tipos» y compara claves en los dos sentidos y tipos; con `tolerar_vacios` un nulo, una lista vacía o un diccionario vacío valen por cualquier cosa), `tests/test_contrato_front.py` (la forma de cada endpoint en vivo frente a su fixture; se salta si la base no es la sembrada de 600 sorteos), `tests/test_contrato_front_estructura.py` (28 pruebas de las funciones de comparación) y `tests/test_contrato_front_variantes.py` (cada variante solo difiere del principal en nulos o vacíos; todos los backtests cubiertos con y sin valor; Seguimiento con datos).
- decisión: los diccionarios cuyas claves son datos (dígitos, terminaciones, fechas, meses, categorías, premios) se tratan como mapas: la clave pasa a `*` y se comparan las formas de sus valores. Sin eso, variantes legítimas (una categoría ausente, otras terminaciones) daban falsos fallos. En TypeScript serán `Record<string, …>`.
- red: 12 de 17 pruebas de estructura fallaron contra el esqueleto; después, 7 de 11 nuevas (mapas y diccionarios vacíos). Mutaciones comprobadas: quitar la tolerancia a ocultos, desactivar la comparación de tipos y confundir booleano con número hacen fallar 2 pruebas cada una.
- done-check: `pytest tests/test_contrato_front.py -q` en verde contra la base sembrada (9 passed; 87 con las demás de contrato); contra la base real se salta sin escribir (9 skipped). **Pendiente** la mutación «renombrar una clave de un fixture» del done-check: se anota abajo al hacerla.
- mutación del done-check de T009 (hecha): renombrar `ontime_endings` en `frontend/fixtures/gaps.json` hace fallar `test_gaps` con «campo nuevo sin fixture: ontime_endings»; revertida con `git checkout`, vuelven los 9 en verde.

### Revisión de T008 — ronda 3 (1 should-fix, 3 nits, 1 question) — 2026-11-11
- should-fix L9 (arreglado): `monthly_recommendation` usaba `date.today()` (el mes objetivo salió «Diciembre 2026» por generar el 11 de noviembre). `_reloj_fijo` ahora fija también `estadisticas._dt.date.today()` (con una subclase de `date`) además de `seguimiento.registrar`, y toda la generación va dentro del reloj fijo: `target_month` = 2 (Febrero) y `target_year` = 2026 siempre. Dos generaciones seguidas: mismo hash en los 14 fixtures.
- nit L10 (arreglado): `fijar_valores_volatiles` solo sustituye `train_date` si es un texto; si cambiara de tipo, el fixture lo deja a la vista (4 pruebas).
- nit L11/L12 (arreglados): prueba de que `_guardar` aplica la normalización; sustituida la prueba que no podía fallar por tres que sí (hoy de `estadisticas` fijado, restauración tras excepción, la fecha falsa sigue comportándose como `date`); y una prueba sobre los fixtures (`test_los_fixtures_no_dependen_del_dia_en_que_se_generaron`) que cubre el cableado de punta a punta.
- question L13 (arreglado): toda la generación va sobre una base de Seguimiento en memoria; ya no se crea ni se toca la tabla `predicciones` de la base sembrada.
- **Límite de rondas:** esta era la 3.ª y última ronda de T008; el ledger no permite una cuarta. Los arreglos de esta ronda no se han vuelto a revisar. Se anota en la cola de decisiones.
- controls T008: tests ✅ (45 del generador, 95 con todo el contrato) build n/a security ✅ (la guarda y el aborto antes de escribir) traceability ✅ (AC6) — status T008: complete.

## Decision queue (adiciones — etapa 1)
- [review-after] Q3 — Los arreglos de la ronda 3 de T008 (reloj fijo completo, normalización de `train_date`, generación sobre Seguimiento en memoria) no tuvieron una cuarta revisión porque el ledger limita a 3 rondas; revisarlos en la revisión de cierre de la rama, evidencia: 45 pruebas del generador, mutaciones comprobadas y hashes idénticos entre generaciones, T008

### Revisión de T009 — ronda 1 (3 should-fix, 1 question, 3 nits) — 2026-11-11
- should-fix L14 (arreglado): en CI `/api/seguimiento` leído de la base sale vacío y `tolerar_vacios` ocultaba todo lo de `comparados[]`/`pendientes[]`. Ahora `test_seguimiento_con_registros_en_estricto` calcula Seguimiento con datos como el generador (en memoria, reloj fijo) y lo compara **sin tolerar nada**; la lectura de la base se queda como prueba de cableado.
- should-fix L15 (arreglado, el de más fondo): la regla de «mapas» agrupaba también `primero/segundo/tercero` y las categorías, que son campos fijos que el front lee por nombre; si el backend dejara de enviar `tercero`, el contrato pasaba en verde. Ahora solo son mapas las claves que son datos (dígitos, terminaciones, fechas, meses). La ausencia de una categoría entera se tolera únicamente al comparar variantes (`_categoria_ausente`); un campo que falta dentro de una categoría presente, o un premio que falta, se ve siempre.
- should-fix L16 (arreglado): `estado_base()` no lanza nunca (devuelve `sembrada`, `otra` o `no disponible` con solo el nombre de la excepción, sin el mensaje, que puede llevar la contraseña); con la base caída las pruebas se saltan en vez de abortar la recolección. Comprobado con un `DATABASE_URL` a un puerto sin servidor.
- question L17 (arreglado): `tests/test_contrato_front_ci.py` hace que, con `CI` definido, no ser la base sembrada sea un fallo y no un salto. Comprobado: `CI=true` contra la base real falla con un mensaje claro.
- nits L18/L19 (arreglados): pruebas de claves que solo empiezan o terminan como un dato, de los 12 meses, de ancestros falsos por prefijo y de nulo mezclado con objeto; código muerto `ancestro == ruta` eliminado. Seis mutantes comprobados (regex sin `$`, sin un mes, sin el guardia de prefijo, `"null" in tipos`, categoría ausente desactivada y siempre activa): todos los detectan las pruebas.
- nit L20 (arreglado): el cliente de las pruebas en vivo corre dentro de `_reloj_fijo` (mismo reloj que el generador).
- documentado el límite del modo tolerante (un campo puede pasar de objeto a `null` o de lista con elementos a vacía sin que se note).
- red: 4 pruebas de estructura fallaron antes (más 3 de `estado_base`); green: 56 + resto. Contra la base sembrada: 10 passed + 1 skipped (la de CI).

### Revisión de T009 — ronda 2 (0 blockers, 0 should-fix, 1 nit) — 2026-11-11
- `VERDICT: pass`. Nit L21 (arreglado): la prueba de CI leía un estado recalculado, que podía discrepar del usado por el `skipif`, y `CI=false` contaba como activo. Ahora lee `test_contrato_front._ESTADO` (el mismo valor) y solo acepta `1`, `true` o `yes`. Comprobado: con `CI=true` y la base sembrada pasan 11; con `CI=true` contra la base real **falla** con un mensaje claro; con `CI=false` se salta.
- controls T009: tests ✅ (contra la sembrada 11 passed con CI=true) build n/a security ✅ (no escribe en bases reales: solo corre con 600 sorteos, Seguimiento en memoria) traceability ✅ (AC6) — 2 rondas, 8 hallazgos cerrados.
- status T009: **complete**.

## T010 — 2026-11-11
- status: complete (en revisión)
- qué: `frontend/src/api/types.ts` (tipos de `/api/sorteos`, `/api/stats`, `/api/seguimiento`, `/api/gaps`, `/api/backtesting`, `/api/comparar`, `/api/simulador` y, leyendo `app.py`, de `POST /api/actualizar` y los errores) y `frontend/src/api/fixtures.check.ts`, que comprueba en `tsc` dos cosas por cada uno de los 15 fixtures: `satisfies Ensanchar<Tipo>` (el fixture cumple el tipo) y `Cubre<Tipo, typeof fixture>` (el tipo declara todos los campos del fixture, algo que `satisfies` no ve).
- escritos a mano a partir de un borrador desechable (un script que fusionaba todas las variantes y repartía formas repetidas; no se commitea: un generador permanente haría que la comprobación pasara siempre). Donde los fixtures no llegan se siguió el código: `metodos` de Seguimiento sin `ml`, métricas de números `null` sin premios de 4 cifras, `ml_info` sin modelo, `ml: {}` en backtesting.
- hallazgo durante la tarea: `ontime_numbers` y `overdue_numbers` de Gaps estaban vacíos en todos los fixtures (la base sembrada casi no repite números). Se añadió la variante `gaps_con_numeros` (números repetidos construidos a propósito) con `con_numeros_repetidos` y su prueba; ahora la forma de esos elementos entra en el contrato.
- red/green: el typecheck falló dos veces al principio (un artefacto de TypeScript al inferir listas de objetos con claves distintas, que se resolvió permitiendo `undefined` en los valores de diccionarios dentro de la comprobación) y quedó en 0.
- done-check: `npm --prefix frontend run typecheck` sale con 0. **Mutaciones comprobadas (7 de 7 detectadas)**: renombrar un campo de `Stats` (8 errores), quitar `lift` de `RecomendacionNumero`, renombrar `numeros_aplican`, quitar `ratio` de `GapNumero` (solo lo ve la variante nueva), cambiar `total` de number a string, y añadir un campo nuevo al fixture de stats o a un registro anidado de Seguimiento (lo detecta `Cubre`). Todo restaurado.
- no cubierto por fixtures, tipado leyendo el código: `POST /api/actualizar`, `numeros_acertados` con elementos (en los fixtures siempre vacío), `peso_ml: null`.

## T012 — 2026-11-11
- status: complete (en revisión)
- qué: `frontend/src/lib/formato.ts` con `CAT_LABELS`, `catLabel`, `catClase`, `formatDate`, `fmtLift` y `liftBar`, con las reglas exactas de `static/app.js` (plan §0). Diferencia deliberada: `catLabel` usa `Object.hasOwn`, así que «toString» o «constructor» ya no devuelven una función como en el código viejo.
- red: con un esqueleto vacío fallaron 14 de 15 pruebas; green: 15. Mutaciones comprobadas (7 de 7): cambiar la etiqueta del gordito, `k in CAT_LABELS`, quitar el tope del 100 %, un decimal en vez de dos, quitar el guion de `catClase`, `formatDate` que solo comprueba `undefined` y sin la hora local (cambiaría de día según la zona horaria).
- done-check: `FE test lib` en verde con las 4 categorías exactas, una desconocida y los formatos de §0.

## T013 — 2026-11-11
- status: complete (en revisión)
- qué: `frontend/src/components/Balls.tsx` (equivale a `renderBalls`: una esfera por carácter, el premio tal como llega, `aria-label` con el premio completo, esferas `aria-hidden`, valor vacío como guion largo `num-empty`) y `frontend/src/sin-relleno.test.ts`, que vigila con `import.meta.glob` que ningún fuente de `frontend/src` use relleno de ceros salvo `lib/numeroSimulador.ts`.
- decisión: la variante `hot` se añade a `VarianteBola` (`gold`, `green`, `purple`, `hot`): el código viejo la usa para la decena caliente y mi bloque de interfaces de T013 no la listaba.
- red: 17 de 17 pruebas fallaron con el esqueleto; green: 17 + 3 de la guardia. Mutaciones comprobadas (6 de 7; la séptima, `texto === ''` en vez de `!texto`, es un mutante equivalente porque el texto ya está sin espacios): rellenar a 4 cifras (9 fallos), cortar a 4 caracteres, esferas visibles a lectores, etiqueta accesible, variante y tamaño por defecto. La guardia se comprobó con un archivo que rellena (falla) y con el permitido (pasa).
- done-check: `FE test components/Balls` en verde con premios `"98"`, `"0074"`, `"05309"` y `""`; una prueba falla si el relleno aparece fuera de `lib/numeroSimulador.ts`.

### Revisión de T010 — ronda 1 (4 should-fix, 4 nits, 1 question) — 2026-11-11
Verificadas una a una en el backend antes de aceptarlas: todas ciertas.
- should-fix L22/L23 (arreglados, misma clase): `decena_recomendada` y `endings_by_category` pasan a `Partial<Record<Categoria, …>>` (el backend solo las rellena «si hay»).
- should-fix L24 (arreglado): `ml_prizes` pasa a `Partial<Record<Premio, …>>` (`{}` sin modelo entrenado). Nuevo fixture `stats_sin_modelo` (con un predictor sin entrenar creado con `__new__`, porque `__init__` carga el modelo guardado): `ml_prizes` `{}`, `ml_recommendations` y `ml_endings` `[]`, `ml_info.train_date` `null` y `train_samples` 0.
- should-fix L25 (arreglado): `Backtesting.statistical` admite `ObjetoVacio`. Nuevo fixture `backtesting_pocos_sorteos` (60 sorteos): `statistical` y `ml` salen `{}`.
- nit L26 (arreglado): `prizes[premio]` admite `ObjetoVacio`. Nuevo fixture `stats_solo_primeros` (segundo y tercero de 2 cifras en todas las categorías): `prizes.segundo` y `prizes.tercero` son `{}`.
- nit L27 (arreglado): `Ensanchar` borraba las uniones literales. Nuevas constantes en tiempo de ejecución (`api/constantes.ts`, de donde salen los tipos) y `literales.test.ts`, que comprueba en los 18 fixtures categorías, premios, métodos de Seguimiento, método de la decena y formatos. Mutaciones: una categoría inventada, un premio «cuarto», un método de decena «nuevo» y un método «magia» las detecta; quitar `extraordinario` de las constantes hace fallar 8 pruebas. Límite declarado: en los fixtures solo aparece el método de decena `frecuencia`; `triple` y `pair` se tipan por el código.
- nit L28 (arreglado): la cabecera de `types.ts` y de `fixtures.check.ts` declara lo que la comprobación NO ve (campo obligatorio que pasa a opcional, `number` que pasa a `number | null`, listas vacías, valores).
- question L29 (arreglado): `ml_info.feature_importances?` opcional, leído de `get_info`.
- nit L30 (arreglado): `ErrorApi` documenta que solo `/api/comparar`, `/api/simulador` (400) y `/api/seguimiento` (500) devuelven JSON de error; un 500 de `/api/stats`, `/api/gaps` o `/api/backtesting` y un 429 son HTML, y hay que comprobar `respuesta.ok` antes de `.json()`. Además `seguimiento_registrado: Categoria[]` y `formatos: Partial<Record<Formato, …>>`.
- mutaciones nuevas (4 de 4 detectadas): `prizes` sin `| ObjetoVacio`, `ml_prizes` como `Record`, `train_date` sin `| null`, `train_samples` con otro tipo. Con las anteriores, 11 de 11.
- límite que queda: que `decena_recomendada` o `endings_by_category` pasen de `Partial` a `Record` ningún fixture lo detecta (todos tienen las 4 categorías); se tipan por el código y está dicho en la cabecera.
- red/green: 6 pruebas fallaron antes de añadir los dos fixtures; 129 pruebas de Python y 174 del front en verde; 18 fixtures deterministas.

### Revisión de T012 — ronda 1 (1 should-fix) — 2026-11-11
- should-fix L31 (arreglado): la prueba «no cambia de día según la zona horaria» no fijaba la zona y con el CI en UTC no podía fallar. Ahora `vite.config.ts` fija `test.env.TZ = 'America/Panama'` (la lotería es de Panamá, UTC-5), comprobado con el proceso en UTC y en Asia/Tokyo, y una prueba documenta la dependencia. Mutante comprobado: leer la fecha en UTC (`new Date(d)` sin `T00:00:00`) falla 2 pruebas con el proceso en UTC y en Tokio.
- el revisor comparó cada función con su original de `static/app.js` y no halló diferencias de comportamiento (salvo `Object.hasOwn`, decidido).

### Revisión de T013 — ronda 1 (`pass`; 3 nits, 2 questions) — 2026-11-11
- nits L32/L33/L34 (arreglados): la etiqueta accesible también se comprueba recortada; un emoji es una sola esfera (mutantes `aria-label={String(valor)}` y `split('')` ahora detectados); la guardia de relleno ya vigila también `.js`, `.jsx` y `.mjs`.
- question L35 (cerrada `intentional`): la guardia es más estricta que el principio (vigila todo `src`, no solo premios) a propósito y está dicho en su cabecera: un relleno legítimo futuro se añade a `PERMITIDO` con su motivo. Es una red contra el descuido, no contra quien la quiera esquivar.
- question L36 (aparcada): `aria-label` sobre un `span` sin rol, con las esferas `aria-hidden`, es idéntico al original, pero un lector de pantalla puede no anunciar el premio. Mejorar con `role="img"` cambiaría el marcado; se anota en la cola de decisiones.

### Revisión de T010 — ronda 2 (`pass`; 2 nits) — 2026-11-11
- nits L37/L38 (arreglados): la prueba ya no exige que `frecuencia` sea el único método de decena (una regeneración con más datos puede traer `pair` o `triple`); y el control de no-vacío exige claves bajo `by_category`, `endings_by_category`, `decena_recomendada`, `by_prize`, `ml_prizes` y `formatos`.
- el revisor confirmó que ningún campo queda tipado como siempre presente cuando el backend puede omitirlo o vaciarlo.

## Decision queue (adiciones — etapa 1)
- [review-after] Q4 — Las esferas (`Balls`) llevan `aria-label` en un `span` sin rol, igual que el código viejo; con `role="img"` los lectores de pantalla anunciarían el premio, pero cambia el marcado que la spec manda conservar. Decidir si se mejora la accesibilidad en una etapa posterior, evidencia: pregunta L36 de la revisión de T013, T013

### Revisión de T012 — ronda 2 (`pass`; 1 nit) — 2026-11-11
- nit L39 (arreglado): con la zona fija en Panamá solo se probaba un offset negativo. Nueva prueba parametrizada con `vi.stubEnv('TZ', …)` en Tokio (+9), Honolulu (−10), Panamá (−5), UTC y Kiritimati (+14), que comprueba antes el offset real para no probar en vacío, y que el 31 de diciembre sigue siendo 31 y el 1 de enero, 1. Mutantes comprobados: `-05:00` escrito a mano, lectura en UTC y mediodía UTC, los tres detectados.
- controls T012: tests ✅ (21) build n/a security ✅ traceability ✅ (AC4, AC10) — 2 rondas, 2 hallazgos cerrados. status T012: **complete**.
- controls T013: tests ✅ (20 más 3 de la guardia) security ✅ (sin `dangerouslySetInnerHTML`; el texto se escapa) traceability ✅ (AC4) — 1 ronda `pass`, 5 hallazgos cerrados (3 fixed, 1 intentional, 1 parked). status T013: **complete**.
- controls T010: tests ✅ (pytest 129 y front 111 de `api`) build ✅ (`tsc` 0) security n/a traceability ✅ (AC6) — 2 rondas, 20 hallazgos cerrados. status T010: **complete**.

## T014 — 2026-11-11
- status: complete (en revisión)
- qué: `frontend/src/store/` con el contrato (`tipos.ts`: `Store`, `Snapshot`, las 14 pestañas `TABS`), `StoreProvider` + `useStore` (contexto con error claro fuera del proveedor), los hooks `useSorteos`, `useStats` (`null` mientras carga), `useReady`, `useML`, `usePrize`, `useStatsPrize` (devuelven `[valor, cambiar]`), `useTheme`, `useActiveTab`, `useToast` y `useReload`, y `storeFalso.ts`, el doble de pruebas para todas las islas. Cada hook se suscribe a su campo con `useSyncExternalStore`: un componente no se repinta porque cambie otro.
- red/green: 22 pruebas fallaron con el esqueleto; green: 22. Mutaciones comprobadas (7 de 7): sin suscripción, `useML` con la acción equivocada, `useStatsPrize` leyendo el premio de Predicciones, suscribirse a todo el estado (6 fallos), `useStore` sin comprobar el proveedor, el doble sin referencia nueva y sin cancelar suscripción.
- done-check: `FE test store` en verde.

### Revisión de T014 — ronda 1 (1 should-fix, 2 questions, 2 nits) — 2026-11-11
- should-fix L40 (arreglado): los hooks pasan `subscribe` y las acciones sueltas; un `LegacyStore` escrito como clase con `this` habría fallado en T015 sin que el doble lo notara. En lugar de parchear solo el doble: **suite de contrato reutilizable** (`contratoStore.ts`) que toda implementación de `Store` debe pasar (el doble, `LegacyStore` en T015, `ReactStore` en T052): referencia estable de la instantánea y de cada campo, un campo cambia sin tocar los demás, `subscribe` avisa y cancela, `subscribe` y las acciones funcionan sueltas sin `this`, y conservan su identidad. Cada comprobación es una función que lanza, y `contratoStore.test.ts` las prueba contra 8 almacenes defectuosos (método con `this` perdido, instantánea nueva en cada lectura, campo inestable con la instantánea estable, cambia otros campos, suscripción que no cancela, que no avisa, acciones que cambian de identidad); acepta una clase correcta con flechas.
- questions L41/L42 (arregladas, por escrito en `tipos.ts`): semántica de `reload` (conserva los datos viejos mientras dura, resuelve al terminar con o sin éxito y nunca rechaza, como `static/app.js`), de `stats` (sigue `null` si la carga falla, como hoy; un estado de error explícito lo decide T052 sin romper la interfaz), de `ready` (solo la fase de sorteos) y estabilidad por campo como invariante del contrato.
- nits L43/L44 (arreglados): el doble crea un array de sorteos nuevo por instancia (prueba, mutación comprobada) y documenta que `cambiar` avisa siempre, más permisivo que un almacén real.
- red/green: 7 pruebas de la suite fallaron con un esqueleto vacío y 1 del array compartido antes de arreglarlo; green: 36 en `store`, 217 en todo el front. `typecheck` 0.

### Revisión de T014 — ronda 2 (4 should-fix, 1 question) — 2026-11-11
Todos sobre la suite de contrato, es decir, sobre lo que T015 y T052 tendrán que cumplir.
- should-fix L45 (arreglado): las pruebas negativas no aislaban su causa (una clase defectuosa fallaba por otro motivo y el mutante «llamar a `subscribe` como método» sobrevivía). Cada almacén defectuoso tiene ahora UN solo defecto y el mensaje de error nombra la pieza que falló suelta (`«subscribe» falla al usarse suelto…`); las pruebas comprueban ese mensaje.
- should-fix L46 (arreglado): la suite solo ejercitaba un almacén recién creado; un `LegacyStore` que devolviera `{ ...stats }` tras cargar habría pasado y entrado en bucle de repintados. Ahora cada implementación aporta un `ControlDeCarga` (`cargar` y `fallarSiguienteRecarga`) y la estabilidad de referencias y la independencia de campos se comprueban vacío y cargado. Almacén defectuoso nuevo: `stats` estable al principio e inestable solo tras cargar.
- should-fix L47 (arreglado): la semántica de `reload` se comprueba: conserva `stats`, `ready` y `sorteos` mientras dura, se resuelve, nunca rechaza (ni aunque la carga falle) y los datos siguen ahí; con 3 almacenes defectuosos (rechaza, vacía los datos durante la recarga, los pierde solo tras un fallo).
- should-fix L48 (arreglado): la identidad de `subscribe` y de cada acción, y la estabilidad de `getSnapshot`, se comprueban también tras cambiar el estado, cargar y recargar; con almacenes defectuosos que renuevan las acciones tras un cambio, tras una recarga o `subscribe` tras un cambio.
- question L49 (arreglada): `tipos.ts` documenta que `app.js` inicializa `stats` como `{}` y no comprueba la respuesta HTTP (`LegacyStore` debe traducir `{}` y cualquier cuerpo sin `total_sorteos` a `null`), y que `app.js` repinta esqueletos propios mientras recarga (diferencia aceptada).
- mutantes de la suite (6 de 6 que sobrevivían, ahora detectados): `subscribe` como método, acción como método, sin identidad de `subscribe` tras cambios, sin `reload` en la identidad, sin comprobar `stats` durante la recarga, nada tras un fallo, y solo el almacén vacío.
- red/green: 12 pruebas negativas fallaron contra el esqueleto; 51 pruebas en `store`, 232 en todo el front. `typecheck` 0.
- esta era la ronda 2 de 3.

### Revisión de T014 — ronda 3 (la última; 2 should-fix, 2 nits, 1 question) — 2026-11-11
- should-fix L50 (arreglado): `suscripcion` solo probaba `setUseML`. Ahora comprueba cada setter (`setUseML`, `setPrize`, `setStatsPrize`), que avise tras el cambio y que la escucha ya lea el valor NUEVO (si avisara antes de actualizar, `useSyncExternalStore` leería el viejo). Defectos nuevos: un setter que no avisa (nombrado en el mensaje) y uno que avisa antes de actualizar.
- should-fix L51 (arreglado): la conservación de datos durante `reload` se medía en un instante. Ahora se observa en cada aviso y en 10 turnos de microtareas; defectos nuevos: `stats` vacío tras un `await`, tras un `setTimeout` (solo lo ve la escucha) y sin avisar (solo lo ven las lecturas a intervalos). Comprobado: quitar cualquiera de los dos mecanismos hace caer una prueba.
- nit L52 (arreglado): tras una recarga fallida se comprueban TODOS los campos por referencia, no solo `stats` y `ready`; defectos nuevos: vacía los sorteos, cambia un campo ajeno y sustituye `stats` por una copia igual.
- question L53 (arreglada): la documentación de `reload` reconoce que es MÁS estricta que `app.js` ante un fallo HTTP con cuerpo JSON (un 500 no puede ocupar el lugar de `stats`) y el `ControlDeCarga` dice que `fallarSiguienteRecarga` debe simular también una respuesta de error.
- nit L54 (arreglado): el fallo de recarga del doble ya no es estado muerto: se registra (`reload:fallo-tragado`) y tiene prueba; el almacén manual cuenta los fallos tragados.
- nit L55 (arreglado): el rechazo de `reload` se recoge al instante (`.then(() => null, e => e)`) para que no quede una promesa rechazada sin manejar si antes fallan las aserciones.
- red/green: 7 pruebas fallaron antes de implementar; 67 en `store`, 248 en todo el front, `typecheck` 0.
- controls T014: tests ✅ build n/a security n/a traceability ✅ (AC2) — 3 rondas (el límite del ledger), 17 hallazgos cerrados. status T014: **complete**.
- **Límite de rondas:** esta era la 3.ª y última; los arreglos de esta ronda no se han vuelto a revisar. Se anota en la cola de decisiones.

## Decision queue (adiciones — etapa 1)
- [review-after] Q5 — Los arreglos de la ronda 3 de T014 (la suite de contrato del Store: setters, observación continua de `reload`, campos tras un fallo) no tuvieron una cuarta revisión porque el ledger limita a 3 rondas; revisarlos en la revisión de cierre de la rama o al ejercitar la suite con `LegacyStore` (T015), evidencia: 67 pruebas en `store`, 20 almacenes defectuosos y mutantes comprobados, T014

## T015 — 2026-11-11
- status: complete (commits c2f17ba + d77b954)
- red/green: la suite de contrato y `puente.test.ts` (24 pruebas nuevas) contra `static/app.js` real en jsdom (`legacyHarness.ts`, plantilla real, fetch → fixtures). 8 mutantes del puente, todos detectados (dos sobrevivieron al principio y se añadieron pruebas: `ready` recalculado y cuerpo de error en `/api/sorteos`).
- files: static/app.js (puente `window.LP` al inicio, `selectPrize`/`selectStatsPrize`/`setUseMLLP`, guardas de respuesta en `loadData`, `currentStatsPrize` ahora se guarda), frontend/src/store/{legacyStore,legacyHarness}.ts, tests, `@types/node` 22.20.5 (arnés).
- cambios de comportamiento de app.js (declarados): `loadData` trata como fallo un `!ok` o un cuerpo inválido (reintenta `/api/stats` hasta 3 veces); `toggleML` no repinta si aún no hay stats; `renderFull` conserva el premio de estadísticas elegido.
- risk: tier 1 — 1 revisor
- review: ronda 1 → 6 hallazgos (3 should-fix, 2 nits, 1 question). L56–L59 arreglados (detail del evento = cadena, un evento por campo; pruebas que ahora pueden fallar, mutación de la guarda comprobada; selector sin interpolar); L61 intencional (reintento inmediato ya existía ante errores de red); L60 aparcado.
- controls: tests ✅ (272 front, 397 py con base sembrada) build ✅ typecheck 0 security ✅ npm audit 0 traceability ✅
- decision: Q6 review-after (abajo). Ronda 2 de 3; los arreglos de la ronda 2 no se han vuelto a revisar con un revisor aparte (cambios acotados, con mutación comprobada).

## Decision queue (adiciones — etapa 1)
- [review-after] Q6 — T015/L60: `renderFull` vuelve a llamar a `init*Tabs`, así que cada `reload()` desde React duplica listeners de las pestañas de premio/categoría (inocuo para el estado, cuesta repintados). Recomendación: guardar con una marca en el nodo al migrar esas pestañas (T046/T052) o antes si molesta. Evidencia: ledger L60.

## T016 — 2026-11-11
- status: complete (commits 75c2748 + 8f5287f)
- red/green: 13 pruebas fallaron contra los esqueletos vacíos (por aserción) antes de implementar; ahora `montaje.test.tsx`, `Skeleton.test.tsx`, `main.test.ts`: 291 pruebas en todo el front, `typecheck` 0, `npm audit` 0. 9 mutantes de `montaje`/`Skeleton` detectados (uno equivalente —`Math.max` redundante— se quitó; uno se mató con una prueba nueva).
- files: frontend/src/{main.tsx,montaje.tsx,main.test.ts,montaje.test.tsx}, frontend/src/components/{Skeleton.tsx,Skeleton.test.tsx}
- desviación declarada: la lógica de montaje vive en `montaje.tsx` (no en `main.tsx`) para probarla sin efectos secundarios; `main.tsx` solo hace glob + `montarIslas`. «FE test main» lo cubren `main.test.ts` y `montaje.test.tsx`.
- comprobado con el servidor (puerto 5001, base sembrada) y Playwright: `window.LP` presente, `dist/app.js` 200, sin aviso de «interfaz no construida», 0 errores de consola, 0 peticiones fallidas. Una isla temporal con su `.test.tsx` en `tabs/`: el bundle incluye la isla y no la prueba.
- risk: tier 1 — 1 revisor
- review: ronda 1 → 4 hallazgos (1 should-fix, 2 nits, 1 question). L62–L64 arreglados (glob con exclusión `!./tabs/*.test.tsx`; marca de montado deshecha si `createRoot` lanza; `main.test.ts`); L65 aparcado (Q7).
- controls: tests ✅ build ✅ security ✅ (audit 0) traceability ✅ (AC2). Ronda 2 de 3; los arreglos no se han vuelto a revisar con un revisor aparte.

## Decision queue (adiciones — etapa 1)
- [review-after] Q7 — T016/L65: `Skeleton` replica `skelCard` sin `aria-busy` ni texto para lectores de pantalla (una isla puede estar en carga 50–100 s). Recomendación: que cada isla ponga `aria-busy="true"` en su contenedor mientras `stats` es nulo (se decide al migrar la primera isla con datos, T017, y se aplica igual a todas), sin cambiar el marcado de `Skeleton`. Evidencia: ledger L65.

## T011 — 2026-11-11
- status: complete (commits 44ee853 + 5cb871e). Se hizo después de T016 porque se había saltado al pasar de T010 a T012; T017 depende de ella.
- red/green: 40 pruebas fallaron contra el esqueleto (por aserción) antes de implementar; `client.test.ts` 46 pruebas; 337 en todo el front, `typecheck` 0, `npm audit` 0. 13 mutantes del cliente, todos detectados.
- files: frontend/src/api/{client.ts,client.test.ts}
- desviación declarada: mensaje genérico nuevo `'Error del servidor'` (el plan solo nombra `'Error de conexión'`) para respuestas de error sin `error` público (500/429 en HTML); decisión registrada en decisions.md.
- risk: tier 1 — 1 revisor
- review: ronda 1 → VERDICT pass, 4 nits. L67 (cuerpo array) y L68 (`last_n` no finito) arreglados; L66 intencional (el 503 de `/api/actualizar` nombra `ACTUALIZAR_TOKEN`; ya se mostraba igual en `app.js`, app de uso personal); L69 intencional (el plan pide mensajes genéricos: se pierde «No se pudo cargar el seguimiento»; T020 debe mostrar el texto del cliente).
- contrato para T054: con `status === 401` hay que borrar el token de `sessionStorage` (como hace `app.js`); `auth_required` no se propaga.
- controls: tests ✅ build n/a security ✅ (audit 0; ningún dato interno llega al usuario) traceability ✅ (AC5). Ronda 2 de 3; los dos arreglos son acotados y con prueba.

## T017 — 2026-11-11
- status: complete (commits d42ac7b + 1c7b34c)
- red/green: 21 pruebas fallaron contra el esqueleto (por aserción) antes de implementar; `Gaps.test.tsx` 25 pruebas + `useReveal.test.tsx` 2; 364 en todo el front, `typecheck` 0, `npm audit` 0, 397 Python (base sembrada). 20 mutantes de la isla y del hook detectados (los huecos que salieron —contador vencidos/recientes, insignias, guarda `vivo` que era código muerto— se cerraron); sobrevive uno cosmético (la segunda tarjeta del esqueleto).
- files: frontend/src/tabs/{Gaps.tsx,Gaps.test.tsx}, frontend/src/components/{useReveal.ts,useReveal.test.tsx}, templates/index.html (`<div data-react-root="gaps">` sustituye a `#gapsContent`)
- comprobado en la página real (puerto 5001, base sembrada, Playwright): isla montada, 1 sola petición a `/api/gaps` aunque se cambie de pestaña, 0 errores de consola, tarjetas `visible` al desplazarse.
- risk: tier 1 — 1 revisor
- review: ronda 1 → 8 hallazgos (1 should-fix, 2 questions, 5 nits). L70–L75 arreglados: prueba vacía eliminada; carga con `Skeleton` y vacío sin mensajes nuevos, como pide el plan §5 (mis decisiones iniciales (b) y (c) lo contradecían y se revirtieron); foco a la región al reintentar; `aria-busy` retirado (el `role="status"` con nombre ya anuncia la carga); `?.` sobrante fuera. L76 y L77 intencionales (todas las pruebas del front usan `fixtures/` relativo a `frontend/`; la rama con observer real la cubre `useReveal.test`).
- desviación declarada: T017 sustituye `#gapsContent` en la plantilla (el plan lo dejaba para T018) para no duplicar contenido; el JS antiguo (`loadGaps`, `renderGaps`, llamada en `activateNavTab`) queda muerto hasta T018.
- controls: tests ✅ build ✅ security ✅ traceability ✅ (AC2). Ronda 2 de 3; los arreglos no se han vuelto a revisar con un revisor aparte (acotados, con mutación comprobada).

## Decision queue (adiciones — etapa 1)
- [review-after] Q7 actualizada: en Gaps no se usa `aria-busy` (con `role="status"` y `aria-label` la carga se anuncia y `aria-busy` en el padre puede silenciarlo). Recomendación para las demás islas: mismo patrón (`role="status"` con nombre alrededor de los esqueletos), sin `aria-busy`.

## T018 — 2026-11-11
- status: complete (commit fe5d9a0)
- red/green: la guardia falló en 3 aserciones sobre los archivos reales (`gapsContent` en app.js, `loadGaps`, `renderGaps`) antes de retirar el código; después 25 pruebas Python en verde (`test_ids_retirados` + `test_ui_assets`), 417 en toda la suite con base sembrada; 364 en el front; `typecheck` 0.
- mutantes: reintroducir el id o la función en app.js, el id en style.css o en index.html, y quitar el marcador `data-react-root="gaps"`: los 5 hacen fallar la guardia.
- files: static/app.js (−75 líneas: `loadGaps`, `renderGaps`, llamada en `activateNavTab`), tests/test_ids_retirados.py (detector probado con texto sintético: getElementById con ambas comillas, querySelector, plantilla, atributo, selector CSS; nombres parecidos no saltan)
- `node new Function(app.js)` sin error; página real (5001, base sembrada): isla Gaps con 1 petición y 0 errores de consola.
- risk: tier 1 — 1 revisor
- review: ronda 1 → VERDICT pass, 3 hallazgos (2 nits, 1 question), todos intencionales: la guardia es por texto (un comentario con el nombre retirado bloquea; una concatenación `'gaps'+'Content'` no se ve; no vigila un `cargarGaps` con otro nombre). El plan §5 pide solo vigilar ids retirados.
- controls: tests ✅ build ✅ security n/a traceability ✅ (AC10).
