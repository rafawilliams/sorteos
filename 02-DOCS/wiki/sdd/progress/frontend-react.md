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

## T019 — 2026-11-11
- status: complete (aprobada por el dueño: «Aprobadas»)
- capturas `gaps-oscuro` y `gaps-claro` generadas con `frontend/scripts/capturas.mjs --solo gaps` contra el servidor 5001 y la base sembrada (600 sorteos); deterministas (dos ejecuciones, 0 píxeles de diferencia).
- frente a la referencia (`02-DOCS/attachments/react-baseline/`): difieren el 0,27 % (oscuro) y el 0,58 % (claro) de los píxeles. Causa: el borde de la primera tarjeta, resaltado en la referencia por `.card:hover` (el puntero estaba encima al capturar), y 5–40 px de antialiasing en esquinas de fichas. Ninguna procede de la isla.
- verificación con navegador real (Playwright): flechas, Inicio y Fin de la barra (gaps → simulador → gaps → predicciones → seguimiento), el contenido de Gaps persiste al volver sin nueva petición, el tema alterna (`window.LP` y `data-theme` coinciden, tarjeta blanca en claro), región con `aria-label` «Análisis de gaps», 0 errores de consola. Gaps no tiene subpestañas.
- risk: tier 1, sin código nuevo.

## Etapa 1 (T008–T019) completa
Puente `window.LP`, `LegacyStore`, hooks, cliente de API, fixtures y contrato, montaje de islas y primera pestaña migrada (Gaps). Pendiente de la etapa: abrir su PR (apilado sobre #37, que aún espera el merge del dueño).

## T020 — 2026-11-11
- status: complete (commits 1dcd577 + 2a1b43b), rama `feat/react-etapa-2-seguimiento` desde main (tras fusionar #38)
- red/green: 29 pruebas fallaron contra el esqueleto (por aserción); `Seguimiento.test.tsx` 34 pruebas; 398 en todo el front, `typecheck` 0, `npm audit` 0, 417 Python (base sembrada). 23 mutantes de la isla: 3 que sobrevivían se cerraron con pruebas (umbral exacto del 50/50, nota de peso ML, nota «sin ML»); sobrevive uno visual (segunda tarjeta del esqueleto).
- files: frontend/src/tabs/{Seguimiento.tsx,Seguimiento.test.tsx}, templates/index.html (`<div data-react-root="seguimiento">` sustituye a segLoader/segContent y su contenido), static/app.js (solo se quita la llamada `loadSeguimiento()` de `activateNavTab`; sin los elementos lanzaría).
- página real (5001, base sembrada): 1 petición por activación, 0 errores de consola, ningún id antiguo; esa base no tiene recomendaciones, ahí se ve el estado vacío.
- risk: tier 1 — 1 revisor
- review: ronda 1 → VERDICT pass, 5 nits. L2 (campo `clave` muerto), L3 (listas ausentes como vacías, igual que `app.js`) y L5 (prueba de marcado escapado sustituida por la de listas ausentes) arreglados; L1 (claves por categoría/id: un pendiente por categoría por diseño) y L4 (un frame con datos viejos antes del esqueleto) intencionales.
- controls: tests ✅ build ✅ security ✅ traceability ✅ (AC2). Ronda 2 de 3.
- desviación declarada: la ledger de `rsc` es local por worktree: aquí empieza en L1.

## T021 — 2026-11-11
- status: complete (commit 16886fb)
- red/green: la guardia ampliada falló en 11 aserciones sobre el `app.js` real antes de retirar el código; después 49 pruebas Python en verde (`test_ids_retirados` + `test_ui_assets`), 441 en la suite completa con base sembrada, 398 en el front. `node new Function(app.js)` sin error.
- mutantes: reintroducir cada uno de los 6 ids `seg*` y las 5 funciones en app.js, un id en style.css y otro en index.html, y quitar el marcador de la isla: los 14 casos hacen fallar la guardia.
- files: static/app.js (−61 líneas: `loadSeguimiento`, `renderSeguimiento`, `segPct`, `segNum`, `SEG_METODOS`), tests/test_ids_retirados.py
- risk: tier 1 — 1 revisor. review ronda 1 → VERDICT pass, 0 hallazgos (helpers compartidos `esc`, `formatDate`, `catLabel`, `triggerReveals` y las clases CSS siguen en uso; sin referencias colgantes ni estilos huérfanos).
- controls: tests ✅ build ✅ security n/a traceability ✅ (AC10).

## Menú lateral — 2026-11-11 (rama `feat/react-menu-navegacion`, enmienda pedida por el dueño)
- status: complete (commits cf4bad8 + c175128)
- pedido: «pasa las tabs a menú» y «usa icono en el menú cuando se esconda la barra lateral». Decididos con el dueño: barra lateral, rama nueva desde `main` ahora. Spec enmendada (AC1 y criterio nuevo) y decisión en `decisions.md`.
- hecho: `<nav role="tablist" aria-orientation="vertical">` fijo a la izquierda en 4 grupos (3 marcas `nav-tab-group`); con ≤900 px se esconde y lo abre un botón con icono ☰ (✕ al abrir) que cierra con Escape, fondo o elegir sección; con el menú abierto el resto de la página es `inert`; las flechas recorren las secciones sin cerrarlo; las rejillas colapsan a 1148 px (900 + 248). ~25 líneas de `app.js`, el resto CSS y marcado; el puente, el teclado y las islas no cambian.
- pruebas: `frontend/src/store/menu.test.ts` (16, contra el `app.js` y la plantilla reales en jsdom) y `tests/test_menu_lateral.py` (17: marcado y reglas CSS que jsdom no ve). 28 mutantes (CSS, plantilla, JS): todos detectados. 380 en el front, 434 Python (base sembrada), `typecheck` 0, `npm audit` 0.
- navegador real (Playwright, base sembrada, 0 errores de consola): cortes 900/901, foco al abrir, flechas, Escape, elegir sección, ensanchar con el menú abierto, rejillas a 1000/1200 px, sin solape del botón a 320 px, sin desbordamiento horizontal, ambos temas.
- fallos que solo salieron en navegador real (corregidos y con prueba): el fondo tapaba la barra (`.app` crea su propio contexto de apilamiento) y `transition: all` en las pestañas incluía `visibility` (el foco fallaba justo al abrir).
- risk: tier 1 — 1 revisor. review ronda 1 → 9 hallazgos (4 should-fix, 4 nits, 1 pregunta): los 9 arreglados (el de la pregunta: las flechas no cierran el menú, Enter y clic sí). Ronda 2 de 3, sin segunda revisión aparte.
- pendiente tras fusionar: renovar las 28 capturas de referencia (el ancho útil baja 248 px) y que el dueño las apruebe. Las ramas de etapa en curso (`feat/react-etapa-2-seguimiento`) tendrán que fusionar `main` y sacar sus capturas con el menú.

## T022 — 2026-11-11
- status: complete (aprobada por el dueño: «Aprobadas»)
- referencia renovada: las 28 capturas de `02-DOCS/attachments/react-baseline/` se sustituyen por las sacadas de `main` con el menú lateral (el ancho útil bajó 248 px); aprobado por el dueño («Sí, sustitúyelas»). Gaps ya es isla (aprobada idéntica en T019); el resto es el código antiguo sin tocar. Las etapas siguientes comparan contra esta referencia.
- capturas `seguimiento-oscuro` y `seguimiento-claro` con la isla frente a esa referencia: 0 píxeles de diferencia (>8/255) en los dos temas. Limitación: la base sembrada no tiene recomendaciones ni sorteos comparados, así que se compara el estado vacío; los estados con datos (aciertos marcados, método sin ML, `numeros_aplican` falso, listas ausentes) los cubren las 34 pruebas de la isla.
- verificación con navegador real (Playwright, base sembrada, 0 errores de consola): flechas arriba/abajo, Inicio y Fin de la barra lateral desde Seguimiento, el contenido se recarga en cada activación (3 peticiones en 3 activaciones), el tema alterna (`window.LP` y `data-theme`; tarjeta blanca en claro), las regiones «Marcador por método» e «Historial del seguimiento» son enfocables. Seguimiento no tiene subpestañas.
- risk: tier 1, sin código nuevo.

## Etapa 2 (T020–T022) completa
Isla Seguimiento, retirada del código antiguo con la guardia ampliada y referencia de capturas renovada con el menú. Pendiente de la etapa: abrir su PR contra `main`.

## T023 — 2026-11-11 (rama `feat/react-etapa-3-favoritos-comparador`, apilada sobre la etapa 2)
- status: complete (commits 6139d82, 449f8a2, ee8f3b3 + arreglos de la ronda 2)
- hecho: isla `tabs/Favoritos.tsx` (lista en `lp_favorites`, cruce con los 20 sorteos recientes y las recomendaciones, etiquetas y bordes como antes, insignia de la pestaña con `useInsignia`); `lib/favoritos.ts` (lógica pura y tolerante); `lib/numeroSimulador.ts` (`normalizarNumero` y `validarNumero`, antes de T028: lo necesita Mis Números); acción de Store `simularNumero` (puente `LP.simular`) para el botón «Simular».
- pruebas: 517 en el front (37+ de la isla, lógica pura, contrato del Store con la acción nueva, puente), `typecheck` 0, `npm audit` 0, 458 Python. 38 mutantes (26 + 12 de la ronda 2): todos detectados tras cerrar dos huecos (límite exacto de 20 sorteos; borde dorado solo con ML).
- página real (5001, base sembrada): alta, avisos de repetido y vacío, persistencia al recargar, insignia, «Simular» abre el Simulador con `0042` y lanza `/api/simulador?numero=0042`, 0 errores de consola.
- risk: tier 1 — 1 revisor. review ronda 1 → 10 hallazgos (4 should-fix, 1 pregunta de proceso, 3 nits, 2 más): L1–L9 arreglados (almacén resuelto dentro del `try`; solo el aviso de fallo al guardar, sin tapar; evento `storage` para sincronizar pestañas; `key` por id de sorteo; decisión registrada en decisions.md; un solo nombre accesible en el campo; foco a la lista al quitar y «Simular {n}»; pruebas reforzadas; `simular` no actúa si falta la pestaña). L10 aparcado (Q8).
- desviaciones declaradas: la plantilla ya sustituye la tarjeta «Agregar Número» y `#favContainer` por `<div data-react-root="favoritos">` (el JS antiguo queda muerto hasta T025).
- controls: tests ✅ build ✅ security ✅ traceability ✅ (AC2). Ronda 2 de 3.

## Decision queue (adiciones — etapa 3)
- [review-after] Q8 — T023/L10: `simularNumero`/`LP.simular` es una acción puente temporal; T028 (isla Simulador) debe reimplementarla sobre la isla (o retirar el puente) y usar `validarNumero` para que el campo vacío no se rellene hasta «0000» (hoy `runSimulation` aún lo hace).

## T027 — 2026-11-11 (adelantada a la etapa 3, ver decisions.md)
- status: complete (commits 2ee774b + arreglos de la ronda 2)
- hecho: `components/Chart.tsx` (Chart.js empaquetado, registra bar/line/radar/scatter y sus escalas, elementos y complementos; se destruye al desmontar y se recrea al cambiar tema, tipo, `datos`/`opciones` o la preferencia de movimiento) y `lib/chartOptions.ts` (los colores literales de `chartOpts()` por tema).
- pruebas: `Chart.test.tsx` (con un doble de chart.js que registra qué se registra y qué se destruye), `Chart.registro.test.ts` (el chart.js REAL: si falta un registro, falla) y `chartOptions.test.ts` (cada color y fuente). Mutantes: 21 de la 1.ª ronda + 5 de la 2.ª, todos detectados salvo un registro duplicado (equivalente).
- comprobación real en el navegador (Playwright, base sembrada): el gráfico del Comparador se pinta con Chart.js de verdad en oscuro y claro, con los colores y la leyenda esperados; el cambio de tema lo recrea. Capturas manuales revisadas (no se guardan en el repositorio).
- risk: tier 1 — 1 revisor (junto con T024). review ronda 1: 2 should-fix (el doble ocultaba registros que faltan; el cambio en vivo de «movimiento reducido»), ambos arreglados; L13 (nada obliga a memorizar `datos`/`opciones`) aparcado como Q9.

## T024 — 2026-11-11
- status: complete (commit 473ef18 + arreglos de la ronda 2)
- hecho: isla `tabs/Comparador.tsx` (hasta 5 números, etiquetas de color, `/api/comparar`, tabla de 9 métricas, gráfico mensual; esqueleto «Comparando...», error con «Reintentar», respuestas viejas descartadas). La plantilla sustituye la tarjeta del formulario, las etiquetas y `#compResults` por `<div data-react-root="comparador">`; el JS antiguo queda muerto hasta T025.
- cambios de comportamiento declarados: un campo vacío se rechaza (antes se añadía «0000»), y un error ya no deja el spinner para siempre. La plantilla del plan se corrigió: la fila de T024 depende ahora de `T022, T027`.
- pruebas: 35 de la isla (incluida «la lista se conserva al cambiar de pestaña»); 38 mutantes de la isla, todos detectados (uno equivalente: dependencias de `useCallback`). 
- risk: tier 1. review ronda 1: 2 should-fix de T027 (arriba) + 4 nits + 1 pregunta; L14, L16, L17 arreglados, L15 intencional (mismo patrón de accesibilidad que Gaps y Seguimiento).
- controls: tests ✅ build ✅ security ✅ traceability ✅ (AC2). Ronda 2 de 3.

## Decision queue (adiciones — etapa 3)
- [review-after] Q9 — T027/L13: nada obliga a quien use `Chart` a memorizar `datos` y `opciones`. Los próximos consumidores (T028, T029, T040, T048, T049) deben pasar `useCallback` o constantes de módulo; vale la pena que su revisión lo compruebe.

## T025 — 2026-11-11
- status: complete (commit 47dfc76)
- red/green: la guardia ampliada falló en 20 aserciones sobre el `app.js` real antes de retirar el código; después 83 pruebas Python en verde (`test_ids_retirados` + `test_ui_assets`), 492 en la suite completa con base sembrada, 591 en el front. `node new Function(app.js)` sin error.
- mutantes: reintroducir cada uno de los 6 ids nuevos y las 14 funciones/variables en app.js, un id en style.css y otro en index.html, y quitar el marcador de la isla: todos hacen fallar la guardia.
- files: static/app.js (−224 líneas: bloques de Comparador y Favoritos y la llamada `renderFavorites()` de `renderFull`), tests/test_ids_retirados.py
- risk: tier 1 — 1 revisor. review ronda 1 → VERDICT pass, 0 hallazgos (`chartOpts`, `esc`, `showToast`, `triggerReveals` y las clases compartidas siguen en uso; nadie más llamaba a `updateFavBadge`; la insignia la pone la isla).
- controls: tests ✅ build ✅ security n/a traceability ✅ (AC10).

## T026 — 2026-11-11 (aprobada por el dueño el 2026-11-12)
- capturas con DATOS (la base sembrada no tiene favoritos ni comparaciones): Mis Números con tres favoritos en `lp_favorites` y Comparador con tres números, en oscuro y claro, sacadas con el código antiguo (rama de la etapa 2) y con las islas (etapa 3) con las mismas acciones, y comparadas píxel a píxel. Mis Números: 0 píxeles de diferencia en los dos temas. Comparador: la primera pasada difería en 6.465 píxeles por un defecto del código antiguo (comillas dobles dentro del `style` de las celdas, que lo cortaban); se reproduce lo que se ve (decisión en decisions.md) y la segunda pasada da 0 en los dos temas.
- verificación solo con teclado en la página real (0 errores de consola): en Mis Números, escribir, Tab, Enter añade; Tab llega a «Simular 0042» y «Eliminar 0042»; Enter elimina y el foco pasa a la lista. En el Comparador, escribir y Enter añaden con etiquetas; «Quitar 9614» con Enter quita y recompara. El tema recrea el gráfico. Las flechas de la barra lateral desde Comparador llevan a Gaps. Ninguna de las dos pestañas tiene subpestañas.
- aprobación (2026-11-12): el dueño aprueba las 4 capturas de las islas («las apruebo así») sin repetir la comparación lado a lado con el código antiguo; vale la de arriba (0 píxeles en los dos temas). Capturas nuevas sacadas el 2026-11-12 en el 5001 con la base sembrada (600 sorteos), 0 errores de consola en oscuro y claro: `favoritos-{oscuro,claro}.png` (0042, 9614, 1234) y `comparador-{oscuro,claro}.png` (los mismos tres números, tabla de 9 métricas y gráfico mensual). No se guardan en el repositorio.
- corrección a la verificación de teclado: en el campo del Comparador **Enter no añade** (solo el botón «+ Agregar»); el código antiguo tampoco lo hacía, así que hay paridad y no es una regresión. Si se quiere Enter, es una mejora aparte.
- nota para las próximas capturas: el toast oculto (`.toast`, `translateY(80px)` fuera de la ventana) aparece en los recortes más altos que el viewport (1280×800). Ocultarlo con CSS en las capturas antiguas y nuevas por igual; `frontend/scripts/capturas.mjs` aún no lo hace.
- risk: tier 1, sin código nuevo.

## Etapa 3 (T023–T027) completa
Islas Mis Números y Comparador, componente `Chart`, retirada del código antiguo con la guardia ampliada y capturas aprobadas. Pendiente de la etapa: abrir su PR contra `main` (apilada sobre la etapa 2, ya fusionada).

## T028 — 2026-11-12 (rama `feat/react-etapa-4-simulador-mensual`; implementada, pendiente de riesgo y revisión)
- status: in-review (todavía sin commit)
- red/green: contrato `simulacion` — 6 fallos en rojo (`simulacion` llegaba `undefined` en el doble, `StoreManual`, la clase con flechas y `LegacyStore`), luego 115 en verde; isla — 38 fallos en rojo («Unable to find…») y 39 en verde; guardia — 16 fallos en rojo y 123 en verde al retirar el código; puente — 1 rojo (app.js aún simulaba por su cuenta) y verde.
- hecho: campo `simulacion` en el Store (`tipos.ts`, `storeFalso.ts`, `hooks.ts` → `useSimulacion`, `contratoStore.ts`, `app.js`: `LP.simular` ya no toca `#simNumero` ni llama a `runSimulation`); isla `tabs/Simulador.tsx` (formulario, categorías desde `stats.by_category`, esqueleto con `stats` nulo y mientras busca, error con «Reintentar», respuestas viejas descartadas, petición desde Mis Números); plantilla con `<div data-react-root="simulador">`; retirados `initSimCats`, `runSimulation`, `renderSimResults`, `simChartInstance` y los ids `simNumero`, `simCat`, `simFrom`, `simTo`, `simBtn`, `simResults`; guardia ampliada.
- pruebas: 40 de la isla; 643 en el front; 515 Python (1 omitida; base sembrada `sorteos_capturas`, nunca la real); `typecheck` 0; build correcto; `npm audit` 0; `pip-audit` sin vulnerabilidades.
- mutantes: isla 24/24 detectados (uno sobrevivió y se cerró: el separador de miles de «Sorteos analizados», con una prueba de 9.296); contrato 5 almacenes rotos, todos rechazados por su defecto; puente en `app.js` 5/6 (el que sobrevive, `String(n)` frente a `n`, es equivalente: el contrato ya exige texto).
- navegador real (Playwright, base sembrada en el 5002 desde este worktree, 600 sorteos): 10/10 comprobaciones y 0 errores de consola: formulario con «Todas» y las 4 categorías; «74» pide `numero=0074`; filtros en la URL; campo vacío avisa y no pide; Enter en el botón simula; «Simular 0042» desde Mis Números abre la pestaña, rellena el campo y simula; repetir el número simula otra vez; tema claro. Las tarjetas `.reveal` quedan en opacidad 1 al bajar (como en el resto de la app).
- decisiones: «Simular» llega por `simulacion` y tres cambios de comportamiento (ver decisions.md, 2026-11-12). Q8 queda resuelta: `simularNumero` ya no es un puente temporal.
- risk: **pendiente**: `rsc risk` no se ha podido ejecutar (el clasificador de permisos bloquea `npx`); el tier lo calcula la herramienta, no el agente. review: **pendiente** (un revisor de contexto fresco si el tier es 1).
- controls: tests ✅ build ✅ security ✅ traceability ✅ (AC2 isla; AC10 retirada del código antiguo).

## Decision queue (adiciones — etapa 4)
- [review-after] Q10 — T028: `Snapshot.simulacion` es contrato nuevo del Store; `ReactStore` (T052) debe implementarlo y pasar la suite de contrato (`describirContratoDeStore`, comprobación `simulacion`).

## T028 — revisión, ronda 1 (2026-11-12)
- review: un revisor de contexto fresco (informe en `.scratch/review-T028-r1.md`, no se versiona) → 0 bloqueantes, 0 should-fix, 1 nit, 1 pregunta; sin hallazgos que verificar (`finding-verifier` solo aplica a bloqueantes y should-fix). Como `npx` está bloqueado, `review consolidate` y `review ledger` no se han podido ejecutar: el recuento y los cierres se anotan aquí a mano.
- L1 (nit, `Simulador.tsx`): con todas las categorías a 0 el ancho de barra daba `NaN%` → **arreglado** (`|| 1`), con prueba que fallaba antes (41 en la isla). El servidor no devuelve categorías con 0 y el código antiguo hacía lo mismo: arreglo de clase «división por cero sin guardia».
- L2 (pregunta, `Simulador.tsx`): si `/api/stats` falla o tarda minutos (primera carga sin modelo: 50-100 s) el formulario entero queda en esqueleto aunque `/api/simulador` no depende de `stats`; el código antiguo lo dejaba usable. El done-check del plan dice «`stats` nulo → esqueleto», así que **no se cambia por cuenta del agente**: aparcada (Q11).
- «Extra» señalado por el revisor: el campo vacío se rechaza en vez de rellenarse hasta «0000». Es la corrección pedida en Q8 y está en `decisions.md`: **intencional**.
- nit sin ficha: los `<label>` no llevan `htmlFor` y no hay `<form>`, de modo que Enter no lanza la búsqueda; el código antiguo era igual (paridad).
- risk: sigue **pendiente** (`rsc risk` sin ejecutar); el revisor se lanzó por indicación de la persona, no por un tier calculado.

## Decision queue (adiciones — etapa 4)
- [review-after] Q11 — T028/L2: con `stats` nulo, el Simulador entero es un esqueleto. Recomendación: mostrar el formulario siempre (con «Todas» como única categoría hasta que lleguen las categorías) y dejar el esqueleto solo para el selector; exigiría matizar el done-check «`stats` nulo → esqueleto» de T028.

## T029 — 2026-11-12 (implementada, pendiente de riesgo y revisión)
- status: in-review (todavía sin commit)
- red/green: `DIGIT_COLORS`, `BotonCopiar` e isla Mensual escritos tras sus pruebas en rojo (39 fallos de «Unable to find…», `datos` indefinido, `DIGIT_COLORS` vacío); la guardia de ids retirados falló en 11 pruebas antes de retirar el código y pasa después.
- hecho: `lib/chartOptions.ts` → `DIGIT_COLORS`; `components/BotonCopiar.tsx`; `tabs/Mensual.tsx` (recomendación del mes objetivo con esferas y «×N azar», tabla de ventaja de dígitos con su color, gráfico apilado de los 12 meses con `Chart`, tarjeta por mes con top de números y terminaciones); plantilla con `<div data-react-root="mensual">`; retirados de `app.js` el bloque `renderMonthlySection`, `monthlyProfileChartInstance` y su llamada, y de la plantilla los ids `monthlyTarget`, `monthlyAdvantage`, `monthlyProfileChart` y `monthlyCards`; guardia ampliada. Con esto T030 queda absorbida (ver decisions.md).
- pruebas: 36 de la isla, 8 de `BotonCopiar`, 1 de `DIGIT_COLORS`; 689 en el front; 530 Python (1 omitida; base sembrada `sorteos_capturas`); `typecheck` 0; build correcto (448 kB); `npm audit` 0; `pip-audit` sin vulnerabilidades.
- mutantes: 37 (27 de la isla y 10 de `BotonCopiar`): 34 detectados a la primera y los 3 supervivientes eran huecos de mis pruebas, ya cerrados y detectados (repintado con elemento nuevo para la identidad de `datos`, variante de las esferas, botón desmontado con la copia en vuelo). Dos pruebas se reescribieron por cómo mide jsdom (no resuelve `var()` en estilos calculados y convierte `rem` a px): se lee el estilo en línea.
- navegador real (Playwright, base sembrada, 5003): 11/11 y 0 errores de consola: título del mes («Diciembre 2026»), 5 recomendaciones con esferas y «×N azar», tabla 4×11 con celdas verdes y rojas, gráfico de Chart.js realmente pintado (147 colores), 12 tarjetas con una sola «Próximo», «Copiar» con ratón y con Enter (copia, avisa, «OK» y vuelve a «Copiar» a los 1,5 s), tema claro con el gráfico recreado.
- decisiones: `BotonCopiar` compartido y T030 absorbida (decisions.md).
- risk: **pendiente** (`rsc risk` sin ejecutar); review: **pendiente**.
- controls: tests ✅ build ✅ security ✅ traceability ✅ (AC2 isla; AC10 retirada del código antiguo).

## T028 — revisión, cierre de Q11 (2026-11-12)
- L2/Q11 **resuelta** por decisión del dueño (opción B): con `stats` nulo el Simulador muestra el formulario con «Todas» como única categoría y se puede simular; el esqueleto de toda la pestaña desaparece. Done-check de T028 enmendado en el plan; decisión en decisions.md.
- red/green: 4 fallos en rojo («Unable to find» el campo de texto) y 44 en verde en la isla. Mutantes del cambio: 3/3 detectados (vuelve el esqueleto, el selector no ofrece categorías, el selector ignora categorías).
- navegador real (Playwright, 5003, `/api/stats` retenida con `page.route`): 5/5 y 0 errores de consola: formulario visible y solo «Todas»; se simula; al soltar `/api/stats` el selector gana las 4 categorías y se conserva lo tecleado y el resultado.
- risk: sigue **pendiente** (`rsc risk` sin ejecutar).

## T029 — revisión, ronda 1 (2026-11-12)
- review: un revisor de contexto fresco (informe en `.scratch/review-T029-r1.md`, no se versiona) → 0 bloqueantes, 1 should-fix, 3 nits, 1 pregunta. Sin `npx` no se pudo ejecutar `review consolidate` ni el libro de revisiones: el recuento y los cierres van aquí a mano. El should-fix no pasó por un `finding-verifier` (la autorización cubría solo al revisor): lo verifiqué yo (ver decisions.md).
- L1 (should-fix, `Mensual.tsx`): `role="img"` sobre el contenedor de la tabla de ventaja → **arreglado**: se quita el contenedor, la tabla lleva su `aria-label` y sin 4 filas no se pinta nada. Verificación: la regla ARIA es de la especificación; en el árbol real de Chromium (CDP) las filas seguían expuestas, así que el efecto en un lector depende de la plataforma y no se pudo medir; el caso sin tabla (imagen vacía) sí era seguro. Clase: «rol ARIA que vuelve presentacional contenido estructural».
- L2 (nit, `Mensual.test.tsx`): la prueba «cambiar de pestaña y volver» no podía fallar (la isla no lee `activeTab`) → **borrada**; la identidad de `datos` y `opciones` la cubre otra prueba.
- L3 (nit, `BotonCopiar.tsx`): tras desmontar, el fallo avisaba y el éxito no → **arreglado**: se avisa siempre (la copia se hizo) y solo se omiten el estado y el temporizador; dos pruebas.
- L4 (nit, `BotonCopiar.tsx`): el nombre accesible fijo ocultaba el cambio a «OK» → **arreglado**: «Copiar 9541» → «Copiado 9541».
- L5 (pregunta, `BotonCopiar.tsx`): `copyNumber` de `app.js` reescribe el texto de todo `.copy-btn[data-num]`, también el de los botones de React → **resuelta** en vez de aceptarla: el botón lleva `data-numero` y no `data-num`.
- pruebas: 46 entre isla y botón; mutantes 42/42 detectados (8 nuevos de esta ronda: el contenedor `role="img"` de vuelta, la tabla sin nombre, el nombre sin «Copiado», `data-num`, aviso tras desmontar…).
- navegador real (Chromium, árbol de accesibilidad por CDP, 5003): 8/8 y 0 errores de consola: tabla con nombre y sin «imagen»; `data-numero`; nombre «Copiar N» → «Copiado N» → «Copiar N»; el portapapeles recibe el número.
- no se ha lanzado una segunda ronda de revisión sobre estos arreglos; el riesgo calculado (`rsc risk`) sigue **pendiente**.

## Etapa 4 — riesgo calculado (2026-11-12)
- risk: **tier 1** (calculado con `npx @ericrisco/rsc risk --base fff6728 --json` sobre todo el diff de la etapa): `reviewers: 1`, `humanApproval: false`, `escalate: null`; clases `default` y `docs`; no toca auth, facturación, CI, migraciones ni secretos. Sustituye al «pendiente» de las entradas de T028 y T029, y coincide con lo que se hizo: un revisor de contexto fresco por tarea (T028 y T029).
- corrección: las entradas anteriores decían que `rsc risk` «no se ha podido ejecutar porque `npx` está bloqueado». Era una suposición: solo se había intentado `rsc doctor` una vez y se extrapoló a toda la familia de comandos. Al intentar `rsc risk` por primera vez (a petición de la persona) se ejecutó sin problema. `review consolidate` y `review ledger` siguen sin haberse ejecutado; no se han probado.

## T031 — 2026-11-12 (capturas preparadas, pendiente de la aprobación del dueño)
- capturas con DATOS del código antiguo (`main`, `fff6728`, servidor propio en el 5004) y de las islas (esta rama, 5003), misma base sembrada (600 sorteos), 1280×800, es-PA, movimiento reducido, en oscuro y claro: Simulador con `9749` (3 aciertos en 3 categorías: barras e historial), Simulador con `0000` (sin aciertos) y Mensual; 6 pares. 0 errores de consola en las 12 páginas.
- comparación píxel a píxel (umbral 8/255): tamaños idénticos en los 6 pares; **no son idénticas byte a byte**: Simulador 2-7 píxeles distintos por captura (esquinas redondeadas del `select` nativo, variación máxima 20/255) y Mensual 37 (claro) y 54 (oscuro) (contorno de las esferas doradas, máxima 26/255 y 40/255), de 0,9 a 2,7 millones de píxeles. Las cajas medidas (posición y tamaño de ~430 elementos) son idénticas.
- hallazgo real (arreglado, con prueba): React partía el texto de las fichas de Mensual en varios nodos y Chromium daba anchos distintos en centésimas de píxel (de 3.581/4.511 píxeles distintos a 54/37). Y dos artefactos de la captura, ya neutralizados (ver decisions.md).
- no se guardan en el repositorio. Pendiente: que el dueño las vea y las apruebe; revisión manual de teclado y tema de las dos pestañas.

## T031 — revisión manual de teclado y tema (2026-11-12)
- hecha con Chromium real (Playwright), el mismo guion contra el código antiguo (`main`, 5004) y contra las islas (5003), base sembrada. **Islas: 31/31, 0 errores de consola.** Código antiguo: 28/30 (las dos diferencias se explican abajo).
- barra lateral (las dos pestañas no tienen subpestañas): flechas arriba/abajo/izquierda/derecha, Inicio y Fin cambian de pestaña, mueven el foco, ponen `aria-selected` y `tabindex="0"` solo en la activa y activan su panel; con vuelta cíclica (Fin → Inicio con flecha abajo). Idéntico al antiguo.
- Simulador: Tab recorre número → categoría → desde → hasta → botón; el botón enfocado con Tab tiene un contorno dorado de 3 px; Enter y Espacio en el botón simulan y el foco se queda en él; el selector responde a las flechas. Idéntico al antiguo.
- Mensual: Tab llega a los 5 botones «Copiar» en orden, con contorno visible de 3 px; Enter y Espacio copian, avisan «Copiado: …» y el foco no se mueve; el nombre accesible pasa a «Copiado N» (mejora respecto al antiguo, que no lo tenía).
- tema: Enter y Espacio en el interruptor alternan el tema, lo guardan en `localStorage` y sobrevive a recargar; el foco se queda en el interruptor.
- diferencias con el código antiguo (las dos a favor de las islas, ya decididas o nuevas): (1) campo vacío — el antiguo simulaba «0000» (Q8), la isla avisa «Ingresa un número de 4 dígitos» y no pide nada; (2) **al cambiar el tema en vivo, el gráfico de Mensual antiguo no se redibuja** (misma huella de píxeles antes y después: conserva los colores del tema anterior), y el de la isla sí se recrea con los colores del tema nuevo (T027).
- paridad que NO se cambia: Enter dentro del campo de número no lanza la simulación (no hay `<form>`; igual que el antiguo).
- observación fuera de la migración: contraste de `--text-muted` por debajo de AA (4,5): 2,63 en oscuro y 4,1 en claro en la etiqueta de las cifras del Simulador y en «Top números:»/«Top terminaciones:» de Mensual; el resto del texto medido pasa (5,6 a 18). Es el mismo valor en el antiguo; arreglarlo es una decisión de diseño aparte.

## T031 — 2026-11-12 (aprobada por el dueño)
- status: complete («sí, apruebo las capturas»). Las 6 capturas con datos (Simulador con `9749`, Simulador con `0000` y Mensual, en oscuro y claro) comparadas con el código antiguo, la revisión de teclado y tema (31/31) y la corrección de las fichas de Mensual quedan como evidencia de la etapa 4. No se guardan en el repositorio.
- etapa 4 (T028–T031): isla Simulador, campo `simulacion` del Store, isla Mensual, `BotonCopiar`, `DIGIT_COLORS`, retirada del código antiguo de las dos pestañas (T030 absorbida), guardia de ids ampliada. Riesgo calculado: tier 1. Pendiente de la etapa: abrir su PR contra `main`.

## T032 + T033 — 2026-11-12 (rama `feat/react-etapa-5-precision`; implementadas, pendientes de revisión)
- status: in-review. risk: tier 1 (calculado para la etapa 4 con `rsc risk`; el de esta rama se calcula al final con su base `53c127d`).
- red/green: la isla se escribió tras 44 pruebas en rojo («Unable to find…»); la guardia de ids retirados pasó de 18 fallos a verde al retirar el código.
- hecho: `tabs/Precision.tsx` (carga al activarse y sin repetir si ya hay datos, esqueleto «Calculando backtesting», error con «Reintentar», resumen, 4 tarjetas de posición con barras y marcas del azar, tarjetas ML y Estadístico, gráfico de tendencia mensual con `Chart`, nota de interpretación); plantilla con `<div data-react-root="precision">`; retirados de `app.js` `loadBacktesting`, `renderBacktesting`, `renderPrecisionTrend`, `backtestData`, `precisionChartInstance` y su llamada al cambiar de pestaña, y de la plantilla los ids `precisionLoader`, `precisionContent`, `precisionSummary`, `precisionPositions`, `precisionComparison` y `precisionTrendChart`; guardia ampliada. T033 queda absorbida (decisions.md).
- pruebas: 47 de la isla; 742 en el front; 554 Python (1 omitida; base sembrada `sorteos_capturas`); `typecheck` 0; build correcto (458 kB); `npm audit` 0; `pip-audit` sin vulnerabilidades.
- mutantes: 42 (42 detectados; 1 sobrevivió a la primera —el ancho de las barras del Estadístico no se comprobaba— y se cerró con una aserción).
- navegador real (Chromium, base sembrada, 5005): 13/13 y 0 errores de consola (salvo el 500 provocado para probar el error): no pide nada hasta abrir la pestaña; una petición con `last_n=500`; el resumen coincide con la API (9 %, 30.2 %, 0.9x, 500); 4 tarjetas, 8 marcas del azar, tarjetas ML y Estadístico, «Mejor» solo con datos de los dos; el gráfico se pinta (3.146 muestras) y se recrea al cambiar el tema; volver a la pestaña no repite la petición; un 500 se ve con «Reintentar» y al reintentar carga con el foco en la región.
- review: pendiente. T034 (capturas y aprobación del dueño): pendiente.

## T032 — revisión, ronda 1 (2026-11-12)
- review: un revisor de contexto fresco (informe en `.scratch/review-T032-r1.md`, no se versiona) → `VERDICT: pass`: 0 bloqueantes, 0 should-fix, 3 nits; sin hallazgos que pasar por `finding-verifier`. Cierres a mano (el libro de revisiones de rsc no se ha ejecutado).
- L1 (nit, `Precision.tsx`): región exterior anidada con el nombre del panel → **arreglado** (sin `role`, con `tabindex="-1"`).
- L2 (nit, `Precision.tsx`): el esqueleto sin texto visible → **arreglado** («Calculando backtesting…» vuelve).
- L3 (nit, `Precision.test.tsx`): ninguna prueba distinguía `ambos` de `hayMl` ni cubría `comparison` ausente → **arreglado, y destapó un fallo real**: sin `comparison` se coronaba al Estadístico; ahora solo se corona con datos de los dos y un `ml_better` booleano. 4 pruebas nuevas (50 en la isla).
- mutantes: 49 en total (42 de la ronda 1 y 7 de esta), todos detectados.
- pruebas: 50 de la isla; ver el recuento del front en la entrada de cierre de T034.

## T034 — 2026-11-12 (capturas y revisión preparadas, pendiente de la aprobación del dueño)
- capturas con datos del código antiguo (`main`, `53c127d`, 5006) y de la isla (esta rama, 5005), misma base sembrada y **el mismo modelo** (se copió `models/predictor.joblib`; `/api/backtesting` devuelve la misma huella en los dos), 1280×800, oscuro y claro. Alineadas a píxel entero y con el puntero fuera (T031). 0 errores de consola.
- comparación píxel a píxel (umbral 8/255): **0 píxeles distintos en los dos temas** (984×1520), antes y después de los arreglos de la revisión. Es la primera pestaña idéntica byte a byte de la migración.
- revisión manual de teclado y tema en Chromium real, el mismo guion contra el antiguo y la isla: **isla 17/17; antiguo 12/13**. Barra lateral desde Precisión (flechas, Inicio, Fin, vuelta cíclica, `aria-selected`, `tabindex`); Tab no se detiene en el contenido (no tiene controles) y el contenedor solo recibe el foco por programa; con un 500 provocado, Tab llega a «Reintentar» con contorno visible, Enter recarga y el foco queda en el contenedor; Enter y Espacio en el interruptor alternan el tema y lo guardan.
- diferencia con el antiguo (a favor de la isla): al cambiar el tema en vivo el gráfico de tendencia antiguo no se redibuja (misma huella antes y después) y el de la isla sí se recrea.
- contraste (mínimo AA 4,5), idéntico en las dos versiones: la etiqueta de las cifras y la nota «Prob. prom.» usan `--text-muted` y quedan en 2,63 (oscuro) y 4,1 (claro), por debajo de AA; el resto pasa (4,8 a 17,99). Es el mismo valor que en Simulador y Mensual: una decisión de diseño aparte.
- `/api/backtesting` está limitado a 5 peticiones por minuto (decisions.md).
- controles tras la revisión (una sola pasada fresca): `typecheck` 0; 745 pruebas en el front (50 de la isla); 554 Python (1 omitida; base sembrada `sorteos_capturas`); build correcto; `npm audit` 0.

## T034 — 2026-11-12 (aprobada por el dueño)
- status: complete («apruebo todo»). Las 2 capturas de Precisión (0 píxeles de diferencia frente al código antiguo), la revisión de teclado y tema (17/17) y los arreglos de la revisión de T032 quedan como evidencia de la etapa 5. No se guardan en el repositorio.
- etapa 5 (T032–T034): isla Precisión, retirada del código antiguo y de los ids `precision*` (T033 absorbida), guardia ampliada. Pendiente de la etapa: abrir su PR contra `main`.

## T035 + T036 — 2026-11-12 (rama `feat/react-etapa-6-resultados`; implementadas, pendientes de revisión)
- status: in-review. risk: tier 1 esperado (código y documentación; se calcula al final con `rsc risk` contra la base de la rama, `e80a157`).
- red/green: la lógica pura se escribió tras 38 pruebas en rojo y la isla tras 51; la guardia de ids retirados pasó de 23 fallos a verde al retirar el código y la aserción vieja de `test_ui_assets.py` falló y se sustituyó.
- hecho: `lib/resultados.ts` (filtrar, paginar, contar por categoría, CSV y nombre del archivo); `tabs/Resultados.tsx` (contadores por categoría, filtros de texto, categoría y fechas, tabla de 8 columnas, paginación de 50 con ventana de ±3 y «…», exportar CSV, esqueleto, mensaje de «sin resultados»); plantilla con `<div data-react-root="resultados">` y la ranura `#resultadosCsv` en la cabecera; retirados de `app.js` `renderStatCounters`, `getFilteredSorteos`, `renderSorteos`, `renderPagination`, `goPage`, `initFilters`, `exportCSV`, `currentPage` y `PER_PAGE` (−62 líneas) y retocados `renderQuick`, `renderFull`, `buildCategoryUI` y `showSkeletons`; guardia ampliada (9 ids y 9 nombres; `pagination` y `updateBtn` se excluyen a propósito, ver el comentario en el propio archivo). T036 queda absorbida.
- pruebas: 45 de `lib/resultados` y 56 de la isla; 846 en el front; 585 Python (1 omitida; base sembrada `sorteos_capturas`); `typecheck` 0; build correcto (465 kB); `npm audit` 0; `pip-audit` sin vulnerabilidades.
- mutantes: 63 (30 de la lógica y 33 de la isla): todos detectados; 1 sobrevivió a la primera (ninguna categoría era subcadena de otra, así que «igual» y «contiene» no se distinguían) y se cerró con un caso.
- navegador real (Chromium, base sembrada, 5007): 22/22 y 0 errores de consola: contadores y 50 filas con los premios exactos de la API; paginación (8 botones, ventana de la página 4, última página); filtros de texto, categoría y fechas combinados contra lo calculado sobre la API; **descarga real** `sorteos_panama_2026-11-12.csv` con la cabecera y los 150 dominicales (no solo los 50 de la página), línea a línea igual que la API; aviso «CSV exportado: 150 registros»; «↻ Actualizar datos» (JS antiguo) sigue funcionando junto a la isla —con el `POST /api/actualizar` interceptado: no se sincronizó nada— y la isla conserva sus filtros tras recargar; tema claro.
- trampa evitada: el script de retirada terminó «ok» con la comprobación de restos rota (un `sed` se comió la barra de `\b`), y `dateTo` casaba dentro de `updateToken`; se verificó aparte con `grep -w` (vacío) y con la guardia real de Python (171 en verde) y `updateToken` quedó intacto.
- review: pendiente. T037 (capturas y aprobación del dueño): pendiente.

## T037 — 2026-11-12 (capturas y revisión preparadas, pendiente de la aprobación del dueño)
- capturas con datos del código antiguo (`main`, `e80a157`, 5008) y de la isla (esta rama, 5007), misma base sembrada (600 sorteos), 1280×800, oscuro y claro, en dos estados: primera página y página 4 (con la ventana de paginación y «…»). Alineadas a píxel entero y con el puntero fuera (T031). 0 errores de consola.
- comparación píxel a píxel (umbral 8/255), 984×992: **3 de 4 idénticas (0 píxeles)** y la cuarta (`pagina4-oscuro`) difiere en **1 píxel** (variación 10/255). Es la comparación más limpia de la migración junto con Precisión.
- revisión manual de teclado y tema en Chromium real, el mismo guion contra el antiguo y la isla: **23/23 en las dos**. Barra lateral desde Resultados (flechas, Inicio, Fin, vuelta cíclica, `aria-selected`, `tabindex`); orden de Tab idéntico (acciones de la cabecera, búsqueda, categoría, fechas, la tabla desplazable con foco de teclado y la paginación); filtros con teclado; Enter y Espacio en «Exportar CSV» descargan el archivo (con `POST /api/actualizar` abortado por si acaso); la tabla se desplaza con flechas y AvPág; Enter y Espacio en el interruptor de tema alternan el tema y el color de las fichas.
- diferencia con el antiguo (a favor de la isla): al cambiar de página con Enter, en el código antiguo el foco se pierde (la paginación se repinta entera y el foco cae en `<body>`); en la isla el botón es el mismo elemento y el foco se queda en él. Además los botones de paginación tienen nombre accesible («Página 2») y `aria-current`.
- contraste (mínimo AA 4,5), **idéntico en las dos versiones**: por debajo de AA la etiqueta de los contadores (2,63 oscuro / 4,1 claro), la cabecera de la tabla (2,51 / 3,38), el total de resultados (2,76 / 3,67) y la ficha de 2.º premio en claro (3,77); el resto pasa (4,8 a 17,99). Mismo valor `--text-muted` que en Simulador, Mensual y Precisión: una decisión de diseño aparte.
- no se guardan en el repositorio. Pendiente: que el dueño las apruebe; revisor de T035; `rsc risk` de la rama; PR.

## Decision queue (adiciones — seguimiento de la etapa 6)
- [review-after] Q12 — T035/L1: `Snapshot.errorSorteos` es contrato nuevo del Store; `ReactStore` (T052) debe implementarlo (`true` si la carga de sorteos falla sin datos, `false` al reintentar, sin tocarlo si falla una recarga con datos) y pasar la comprobación `errorDeCargaDeSorteos` de `describirContratoDeStore`. Las islas que lean `sorteos` (Mis Números, Comparador, Gaps, Seguimiento…) pueden adoptarlo cuando lo necesiten; hoy solo lo usa Resultados.

## T035 — seguimiento de la revisión (rama fix/resultados-revision) — 2026-11-12
- status: complete
- origen: el revisor de T035 (pass con cambios) halló 1 should-fix: si `/api/sorteos` falla, Resultados se quedaba en el esqueleto para siempre (verificado en navegador real); el código antiguo enseñaba una página vacía. Más 3 nits.
- arreglo: `Snapshot.errorSorteos` (contrato nuevo del Store, ver Q12) en `tipos.ts`, `app.js` (puente), `storeFalso`, `hooks`, `contratoStore`; la isla enseña «No se pudieron cargar los sorteos.» con «Reintentar» (recarga, el foco pasa al contenedor), y lo ignora si ya hay datos. Nits: liberar la URL del CSV a los 40 s, categoría elegida que desaparece vuelve a «Todas», prueba vacua de cambio de pestaña retirada y `.replace` de BOM muerto.
- pruebas: nuevo `puente-error-sorteos.test.ts` (8, contra el `app.js` real) y casos nuevos en contratoStore, storeFalso, hooks y Resultados.
- mutación: 19/20 detectados; el superviviente (`value={filtros.cat}` en el selector) es equivalente porque React elige la primera opción cuando ninguna coincide.
- controles (una sola pasada tras la última edición): typecheck ✅ · pruebas del front 870/870 ✅ · build ✅ · npm audit 0 vulnerabilidades ✅ · pytest 585 passed, 1 skipped ✅ · pip-audit sin vulnerabilidades (1 ignorada: PYSEC-2026-217, la de siempre) ✅.
- navegador real (puerto 5009, base sembrada de 600): 8/8 — con `/api/sorteos` fallando sale el aviso y el botón de exportar queda desactivado; un reintento que falla vuelve al aviso; uno que funciona pasa por el esqueleto con el foco en el contenedor y llega a 50 filas y 600 en total; un fallo al recargar con datos conserva la tabla; 0 errores de consola.
- no ejecutado: capturas píxel a píxel (el estado normal no cambia; solo se añade el estado de error).

## T038 a T041 — 2026-11-12 (etapa 7: Tablist, Decenas y Terminaciones)
- status: complete (T042, la aprobación del dueño de las capturas, queda pendiente)
- T038 `Tablist`: 21 pruebas con userEvent y `fireEvent` (cada tecla, vuelta circular, valor ausente, `preventDefault` solo en teclas de navegación, teclas con Alt/Ctrl/Meta ignoradas). T039 Decenas: 20 pruebas. T040 Terminaciones: 40 pruebas (selector con teclado, ML y estadístico, categoría que desaparece, las tres notas, barras, mapa de calor por tema, tendencia con 0 en meses ausentes). T041: `app.js` pierde `renderDecenas`, `renderEndingsSection`, `renderPrizeEndings`, `renderEndingsHeatmap`, `renderEndingsTrendChart`, `initEndCatTabs`, `endingsTrendChartInstance` y `ENDING_COLORS`; la plantilla pierde 11 `id`; la guardia de ids retirados los cubre y `test_ui_assets` deja de pedir las esferas de terminaciones en `app.js`.
- mutación: 75 mutantes (19 de `Tablist`, 22 de Decenas, 34 de Terminaciones); 70 detectados a la primera y los 5 supervivientes eran huecos de prueba (`preventDefault`, método `fallback`, degradado de ML, relleno de la serie y `aria-controls`); con las pruebas añadidas se detectan los 75.
- capturas (código antiguo `main` 09527f4 en 5010 y la isla en 5011; misma base sembrada de 600 sorteos y el mismo modelo; 1280×800, oscuro y claro; secciones alineadas a píxel entero y con el puntero fuera): Decenas 56 y 60 píxeles distintos de 1.502.000 (claro y oscuro) y Terminaciones 30 y 43 de 3.143.000, variación máxima 42/255, todos en el antialiasing de la esquina redondeada de las barras y de los números pequeños. Sin alinear salían de 1.230 a 43.490 píxeles por una fracción distinta de la sección (444,375 px frente a 347,281 px: el código antiguo y la isla no empiezan en la misma fracción de píxel porque lo que hay por encima de la sección es distinto). El marcado normalizado de una tarjeta de Decenas y los estilos calculados de sus 77 elementos coinciden.
- teclado, ML, tema y copiar en Chromium real, el mismo guion contra el antiguo y la isla: 24 de 25 observaciones idénticas (flechas, Inicio, Fin y vueltas, clic, interruptor ML con y sin categoría, Tab desde la lista, tema claro y oscuro en el mapa de calor, copiar al portapapeles y aviso). La que difiere: el botón de copiar se llama «Copiar 49» y no «Copiar» (decisión de `BotonCopiar`). 0 errores de consola; `POST /api/actualizar` abortado por si acaso.
- revisión (tier 1, un revisor): pass, 0 bloqueantes, 0 should-fix, 5 nits (ver la decisión de esta fecha y Q13 a Q15).
- no se guardan las capturas en el repositorio.

## Decision queue (adiciones — etapa 7)
- [review-after] Q13 — T038/N1: `aria-controls` por defecto de `Tablist` (`${idPrefijo}-panel-${id}`) sigue el plan, pero esos `id` no los crea el componente. Quien lo use sin paneles con ese `id` debe pasar `controla` (Terminaciones ya lo hace). T044 (Predicciones) y T053 (barra principal, cuyos paneles son `sec-*`) deben pasarlo.
- [review-after] Q14 — T040/N2: las pestañas de categoría controlan una región (`role="region"`, `aria-live`) y no un `tabpanel` etiquetado por la pestaña activa; el código antiguo no tenía `aria-controls`. Se puede llevar a `tabpanel` en una pasada de accesibilidad de todas las islas.
- [review-after] Q15 — T040/N4: las pruebas de Terminaciones sustituyen `Chart` por un doble y no comprueban que `datos` y `opciones` sean estables entre renders (el `Chart` real recrearía el gráfico en cada render si no lo fueran). Lo cubren las pruebas de `Chart` por separado.

## T043 a T045 — 2026-11-12 (etapa 8: Predicciones)
- status: complete (T046, la aprobación del dueño de las capturas, queda pendiente)
- T043 isla `predicciones-resumen`: 27 pruebas (tres premios y formato `""`, premios de 2 y 5 cifras tal como llegan, cuatro indicadores, terminación caliente del año con fecha simulada, esqueleto, error de sorteos con «Reintentar» y foco). `lib/predicciones.ts` (`terminacionCaliente`): 10 pruebas, incluido el orden de claves del objeto y el año completo. T044 isla `predicciones`: 35 pruebas (qué recomendaciones enseña cada combinación de modo, premio y categoría con las reglas de respaldo del código antiguo, rótulos, `×N azar`, degradado de ML, copiar, selectores con teclado, `aria-controls`, categoría que desaparece). `InterruptorML`: 7 pruebas. `Tablist` gana la prop `estilo` (23 pruebas). T045: `app.js` pierde `renderRecommendations`, `renderDashboard`, `renderBalls`, `copyNumber`, `fmtLift`, `liftBar`, `skelCard`, `catClase`, `buildCategoryUI`, `selectPrize`, `initPrizeTabs` e `initRecoCatTabs`; la plantilla pierde 4 `id`; la guardia de ids retirados cubre los 4 `id` y 12 funciones nuevas; `test_ui_assets` pasa sus aserciones de `app.js` a `Balls.test.tsx`, `PrediccionesResumen.test.tsx` y `Predicciones.test.tsx`; `puente.test.ts` (contra el `app.js` real) deja de depender de los botones de premio y comprueba que `setUseML` no toca un `.ml-toggle[data-isla]`.
- mutación: 73 mutantes iniciales (2 de `Tablist`, 8 de `InterruptorML`, 7 de la lógica, 25 del resumen y 31 de Predicciones); 71 detectados, 1 hueco real corregido (el año se comparaba sin el guion; ahora hay un caso con «202» frente a 2026) y 1 equivalente (un `useState('all' as string)` que escribí sin efecto). Más 6 de los arreglos de la revisión (error del resumen, foco, `id` del esqueleto): todos detectados.
- capturas (código antiguo `main` 873eb2a en 5012 y la isla en 5013; misma base sembrada de 600 sorteos y el mismo modelo; 1280×800, oscuro y claro; secciones alineadas a píxel entero y con el puntero fuera): 47 (claro) y 73 (oscuro) píxeles distintos de 1.078.000, misma altura, variación máxima 61/255, repartidos en emojis y esquinas de esferas.
- teclado, ML y copiar en Chromium real, el mismo guion contra el antiguo y la isla: idénticos los dos selectores con flechas, Inicio y Fin (premio), el cambio de modo, el reflejo en Terminaciones al volver, copiar y el aviso, el tema y 0 errores de consola. Diferencias, todas a favor de la isla: los botones de categoría son `tab` (solo «Todos» lo era), las flechas los recorren (antes no hacían nada) y Tab desde la lista pasa al primer botón de copiar y no a la categoría siguiente; la barra de confianza se muestra al ancho final (el código antiguo oscilaba entre el 90 y el 100 % en la carga). En texto plano el resumen no lleva los espacios entre elementos que sí llevaba (el `.last-draw-meta` es `display:flex`: no se ven).
- revisión (tier 1, un revisor): changes-needed → arreglada (ver la decisión de esta fecha).
- no se guardan las capturas en el repositorio.

## Decision queue (adiciones — etapa 8)
- [review-after] Q16 — T043/T044: el Store no tiene señal de error de `/api/stats` (solo `errorSorteos`), así que Predicciones, Decenas y Terminaciones se quedan en su esqueleto si fallan las estadísticas, sin mensaje ni reintento. Lo natural es un `errorStats` en el Store junto a la carga de `ReactStore` (T052), como `errorSorteos` (Q12), y que las islas que leen `stats` lo muestren.
- [review-after] Q17 — T044: el interruptor ML de Terminaciones sigue siendo un `.ml-toggle` de la plantilla que `setUseMLLP` actualiza con DOM. Al migrar el armazón (T054) puede sustituirse por `InterruptorML` y entonces `setUseMLLP` deja de tocar el DOM.

## T046 — aprobación del dueño — 2026-11-12
- status: complete
- el dueño revisó la pestaña Predicciones en la aplicación real (puerto 5000, rama `feat/react-etapa-8-predicciones`, base real) y la aprobó.
- no ejecutado en esta sesión: capturas nuevas píxel a píxel ni revisión de teclado/tema anotada; la aprobación se dio sobre la aplicación en marcha. Las capturas de la etapa 8 son las registradas al cerrar T045.
- T042 (aprobación de Decenas y Terminaciones) sigue pendiente de confirmación explícita.

## T047 a T050 — 2026-11-12 (etapa 9: Estadísticas, Tendencias y Análisis)
- status: complete salvo lo de «no ejecutado» (T051, la aprobación del dueño, queda pendiente)
- T047 isla Estadísticas (27 pruebas) con los componentes nuevos `Barras` y `CeldasPosicion`; T048 Tendencias (10) y T049 Análisis (18). T050: `app.js` pierde las 9 funciones `render*` de estas pestañas, las pestañas de premio antiguas, `esc`, `isLight`, `chartOpts` y `DIGIT_COLORS`; `LP.setStatsPrize` guarda el premio y avisa (como `setPrize`) en vez de buscar un botón; la plantilla monta las tres islas; la guardia de ids retirados cubre 15 id y 22 nombres nuevos.
- decisión de diseño: el tooltip de la dispersión enseña los premios tal como llegan (`primero`/`segundo` del sorteo) y no `String(x).padStart(4,'0')` del número ya convertido; la guardia `sin-relleno` prohíbe el relleno. El texto resultante es el mismo para premios de 4 cifras.
- hallazgo por las pruebas: el corte de T050 se llevó `_statsListas`, que `setUseMLLP` sigue usando; lo detectaron las pruebas del puente y se restituyó.
- controles: typecheck ✅ · pruebas del front 1088/1088 ✅ · build ✅ · pytest 719 passed, 1 skipped (base sembrada `sorteos_capturas`, 600 sorteos) ✅ · `node --check static/app.js` ✅.
- navegador real (puerto 5001, base real, 9.297 sorteos, Chromium): Estadísticas 9 tarjetas, 87 barras, 2 gráficos y 70 celdas de posición; Tendencias 2 tarjetas y 2 gráficos; Análisis 4 cuadrículas (40 celdas) y mapa de calor de 44 celdas; ningún esqueleto atascado; al elegir «2do Premio» cambia la primera barra (3552 → 3613) y la pestaña queda `aria-selected`; 0 errores de consola.
- no ejecutado: mutación (como en las etapas 7 y 8), revisión de tier 1 con un revisor, capturas píxel a píxel contra `main` y revisión manual del teclado y del tema (T051); `pip-audit` y `npm audit` tras los cambios (el CI los corre).

## T052 a T054 — 2026-11-12 (etapa 10, primera parte: ReactStore, barra de pestañas y botón de actualizar)
- status: complete (T055 a T058 pendientes; ni `main.tsx` ni la plantilla usan todavía estas piezas: el armazón sigue en `static/app.js` hasta T055)
- T052 `ReactStore` (`store/reactStore.ts`, 56 pruebas): carga en dos fases (sorteos y luego estadísticas), límite de 180 000 ms y 3 reintentos sin espera, un cuerpo de error o sin `total_sorteos` numérico nunca ocupa el lugar de `stats` (más estricto que `app.js`: también se mira `res.ok`), una sola carga a la vez, tema recordado en `localStorage` y aplicado a `data-theme`, aviso emergente por el elemento `#toast` (el temporizador nuevo anula el viejo). El contrato de `Store` gana `setTheme` y `setActiveTab`; `LegacyStore` las delega en el puente (`LP.setTheme`, `LP.setActiveTab`) para que las dos implementaciones pasen la misma suite.
- T053 barra de pestañas (`shell/Tabs.tsx`, `shell/Cabecera.tsx`, 40 pruebas): `PestanasPrincipales` (lista vertical de 14 con flechas, Inicio y Fin; ids `tab-<id>` y `aria-controls` `sec-<id>`), `useMenuLateral` con `BotonMenu` y `FondoMenu` (foco al abrir y al cerrar, Escape, cierre al ensanchar la ventana, `menu-open` en el cuerpo; quien lo use pone `inert` al resto), `BotonTema` y `EnlaceDeSalto`. `Tablist` gana `id`, `orientacion`, clase por pestaña y un segundo argumento `porTeclado` en `onCambio` (reemplaza la marca `_navPorTeclado` de `app.js`: Enter y Espacio llegan como clic y cierran el menú; las flechas no).
- T054 botón de actualizar (`shell/Actualizar.tsx`, 35 pruebas): mismo flujo que `runUpdate` (token por `prompt` y `sessionStorage`; 401 lo olvida; una red caída no guarda ni borra; éxito avisa 3 s y recarga, con el aviso del modelo sin reentrenar; error 4 s con el texto público del servidor o el genérico; botón desactivado mientras trabaja, incluida la recarga; doble clic en el mismo turno bloqueado). Nunca se muestra el cuerpo de la respuesta, el campo `output` ni el token. Probado solo con `fetch` falso: no se llamó nunca a `POST /api/actualizar` real.
- mutación: 10 + 2 (ReactStore, uno sobrevivió y se cubrió: aceptar un 500 con cuerpo de apariencia válida), 17 (barra, menú, tema y `Tablist`) y 13 + 1 (botón de actualizar, uno cubierto: marca anti doble clic en el mismo turno); todos detectados al final.
- controles: typecheck ✅ · pruebas del front 1224/1224 ✅ · build ✅ · pytest 719 passed, 1 skipped (base sembrada) ✅ · `node --check static/app.js` ✅.
- no ejecutado: navegador real con estas piezas (no están cableadas), revisión de tier 1 con un revisor, capturas, `pip-audit` y `npm audit`.
- por decidir en T055: el interruptor ML de la cabecera de Terminaciones y el pie con «Actualizado: …» siguen en la plantilla y en `renderLastUpdate`; el botón de actualizar vive en la cabecera de Resultados; el `#toast` lo escribe el Store por `id`, así que el armazón debe pintar ese elemento.
