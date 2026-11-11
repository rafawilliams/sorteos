---
type: spec
title: Spec — Migrar el front-end a React
description: WHAT y WHY de reemplazar la interfaz vanilla JS por una app React con TypeScript, migrando las 14 pestañas una a una sin cambiar lo que el usuario ve ni la API.
tags: [sdd, spec]
timestamp: 2026-11-11T12:00:00Z
topic: sdd
slug: frontend-react
status: draft
branch: feat/react-frontend
---

# Spec — Migrar el front-end a React

> Slug: `frontend-react` · Status: draft · Created: 2026-11-11
> Inherits: [constitution](../constitution.md) (`v1.0.0`, que esta spec enmienda en el principio 1 y en los que lo referencian)

## Problem & why
Toda la interfaz vive en un único archivo de ~1.400 líneas con estado global compartido (sorteos, estadísticas, modo ML/estadístico, premio elegido) y 14 pestañas que lo leen y lo escriben. Cada pestaña nueva o cambio de datos obliga a tocar ese archivo y a razonar sobre efectos en las demás. El dueño quiere una interfaz hecha con componentes y estado explícito, en React con TypeScript, para poder mantenerla y ampliarla.

**Objeción registrada (2026-11-11) y decisión del dueño.** Para quien consulta resultados no cambia nada visible. React exige un paso de construcción (Node) que el proyecto no tiene, y la constitución v1.0.0 prohíbe expresamente bundlers y frameworks JS. El 2026-11-02 el dueño había descartado modularizar el frontend. Aun así, el dueño decidió seguir y **enmendar la constitución** (MAJOR), migrar **pestaña a pestaña**, usar **TypeScript** y **parar a aprobar en cada fase**.

## Cost of not building it
Ninguno visible para el usuario final. El coste es de mantenimiento: seguir añadiendo funciones sobre un archivo único con estado global, donde un cambio en una pestaña puede romper otra sin que nada lo detecte (la única red son pruebas que leen el código fuente como texto).

## The cheapest alternative
Partir el archivo actual en varios módulos nativos del navegador, sin framework ni paso de construcción y sin enmendar la constitución. Reduce el tamaño de cada archivo, pero deja el estado global y la manipulación manual de la página, que es la fuente real de la fragilidad.

## Goals
- Que la interfaz completa funcione como app React con TypeScript, servida por el mismo servidor, consumiendo la misma API sin cambios de contrato.
- Que durante toda la migración la aplicación siga funcionando: cada etapa deja la app entera usable.
- Que la forma de las respuestas de la API quede descrita por tipos, para detectar desajustes al compilar y no en el navegador.
- Que la constitución refleje la nueva realidad (enmienda MAJOR) y el CI valide el nuevo front-end.

## Non-goals / out of scope
- Cambiar la API, la base de datos, el ML o cualquier cálculo estadístico del backend.
- Rediseñar la interfaz, añadir pestañas, datos o funciones nuevas: el resultado es el mismo que hoy.
- Cambiar el diseño visual (esferas, temas, paleta) más allá de lo que exija reproducirlo.
- Añadir enrutado por URL, renderizado en servidor, PWA, internacionalización o estado remoto con librerías extra «por si acaso».
- Cambiar la librería de gráficos o el modelo de seguridad de `POST /api/actualizar`.
- Migrar otras partes del repositorio (backend, scripts de sincronización).

## Users & context
El dueño y único mantenedor del repositorio; y quien usa la web para consultar resultados y recomendaciones de la lotería de Panamá. Este último no debe notar la migración.

## What the user can do
Cualquier visitante, sin iniciar sesión, usa las 14 pestañas existentes (Predicciones, Decenas, Terminaciones, Resultados, Estadísticas, Tendencias, Análisis, Comparador, Gaps, Simulador, Mis Números, Mensual, Precisión, Seguimiento), alterna ML/estadístico, elige premio y categoría, cambia entre tema claro y oscuro y filtra resultados, igual que hoy. Solo quien conoce el token puede lanzar la actualización de sorteos, igual que hoy.

## What result they get
Cada pestaña migrada muestra los mismos datos, con la misma estructura y estilos, que la pestaña actual para las mismas respuestas de la API. La referencia aprobada es **la aplicación actual en `main`**: capturas de cada una de las 14 pestañas, en tema oscuro y claro, tomadas antes de migrar la primera y guardadas como evidencia. Una pestaña se da por migrada solo cuando sus capturas coinciden con esa referencia y el dueño las ha visto.

## What it must respect
- Constitución: formato de premios (nunca rellenar con ceros; mostrar tal como llegan), fechas ISO, errores opacos, caché de 5 minutos (principios 7, 8, 15). Se **enmienda** el principio 1 (JavaScript vanilla sin bundlers ni frameworks) y se adapta el 6 (validación de sintaxis de `app.js`) y la definición de hecho.
- Accesibilidad (principio 14): roles ARIA de pestañas, navegación por teclado (flechas, Inicio/Fin, foco visible), `aria-live` y temas claro/oscuro persistidos.
- Decisión del 2026-11-02 (esferas de sorteo) y spec `mejoras-ui-esferas`: el aspecto de esferas, panel del último sorteo y mapas de calor se mantiene.
- La clave del token de actualización sigue guardada solo mientras dura la sesión del navegador.
- Rama y Pull Request por etapa, commits gitmoji en español, autoría humana (principios 9–11).
- La app sigue sirviéndose desde el mismo servidor Flask y el mismo puerto de desarrollo.

## How it proves it
- Por pestaña: capturas del antes (referencia) y del después, en ambos temas, guardadas en el archivo de verificación de la etapa.
- Comprobación automática de que cada pestaña migrada pide los mismos datos a la API y los muestra (prueba de componente con respuestas de ejemplo).
- Los tipos de la API se comprueban al compilar; una compilación con errores de tipos falla el CI.
- Prueba de accesibilidad por teclado de la barra de pestañas y del cambio de tema, repetida en cada etapa.
- La suite Python existente sigue en verde; las pruebas que hoy leen el código fuente de la interfaz se sustituyen por pruebas equivalentes sobre la nueva, sin quedarse sin cobertura.

## Behaviour
- Main path: el servidor entrega la app; esta carga los datos, muestra la pestaña activa y reacciona a los controles como hoy.
- Edge cases: sin sorteos o sin estadísticas suficientes (backtests `None`, categoría sin premios de 4 cifras) se muestran los mismos mensajes vacíos que hoy; premios de 2, 4 y 5 cifras y vacíos se muestran tal como llegan; el primer cálculo del modelo puede tardar y se ve el mismo estado de carga que hoy.
- Error paths: si la API falla, el usuario ve un mensaje genérico sin detalles internos y puede reintentar; una pestaña con error no deja inutilizables las demás.
- Convivencia: mientras haya pestañas sin migrar, ambas versiones coexisten en la misma página con el mismo estado compartido (modo ML, premio, tema) y sin duplicar peticiones a la API.

## Acceptance criteria
- Given la app migrada, When se abre cada una de las 14 pestañas con los mismos datos que en `main`, Then sus capturas coinciden con la referencia aprobada en tema oscuro y claro.
- Given una etapa a medias, When se carga la página, Then todas las pestañas, migradas o no, funcionan y comparten modo ML, premio y tema.
- Given la pestaña activa, When se usan flecha izquierda/derecha, Inicio y Fin, Then el foco y la selección cambian como en la versión actual y los roles ARIA se conservan.
- Given cualquier respuesta de la API con premios de 2, 4, 5 cifras o vacíos, When se muestran, Then el texto es idéntico al recibido (sin ceros añadidos).
- Given el token de actualización, When se introduce, Then solo se conserva durante la sesión del navegador y la actualización se comporta como hoy (401, 503, 502 y 500 con mensajes opacos).
- Given un cambio que rompe el tipo de una respuesta de la API, When corre el CI, Then falla la compilación.
- Given la migración completa, When corre `pytest -q -W error::SyntaxWarning` y la comprobación del front-end en CI, Then ambas pasan y ningún archivo de la interfaz anterior queda sin uso.
- Given la constitución, When termina la migración, Then está enmendada a v2.0.0 con la entrada correspondiente en su registro de cambios.

## Points to clarify
- **pregunta abierta** — ¿El servidor sirve la app ya construida desde el propio Flask (un solo proceso) o el desarrollo usa un servidor aparte con proxy a la API? Afecta al flujo de trabajo diario y a `launch.json`.
- **pregunta abierta** — ¿Se commitea la app construida o se construye siempre en CI y en el despliegue? Depende de cómo se despliega hoy.
- **suposición tomada** — Chart.js se mantiene como librería de gráficos, envuelta en componentes. *Base:* no cambiar la librería está en el alcance, y los 8 gráficos ya usan sus opciones por tema. *Riesgo:* si el dueño prefiere otra, cambia el alcance.
- **suposición tomada** — El orden de migración empieza por el armazón (carga de datos, tema, barra de pestañas) y sigue de pestañas simples a complejas. *Base:* minimiza el riesgo de la convivencia. *Riesgo:* si hay una pestaña prioritaria, se reordena el plan.
- **decisión diferida** — Enrutado por URL por pestaña; fuera de este ciclo.
- **decisión diferida** — Eliminar la carga de Chart.js desde red externa a favor de empaquetarla; se decide en `plan` si el build lo hace natural.
- **área no formulable** — Cómo mantener las pruebas de contenido que hoy leen el código fuente de la interfaz; sospecho que algunas cubren reglas (p. ej. categorías) que deberán pasar a pruebas de componente.
