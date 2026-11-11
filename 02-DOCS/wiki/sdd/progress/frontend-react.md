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
