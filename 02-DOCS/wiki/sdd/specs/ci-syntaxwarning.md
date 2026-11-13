---
type: spec
title: Spec — El CI falla ante un SyntaxWarning de Python
description: WHAT y WHY de hacer que un SyntaxWarning nuevo rompa el job de tests del CI en lugar de pasar inadvertido.
tags: [sdd, spec, ci]
timestamp: 2026-11-12T12:00:00Z
topic: sdd
slug: ci-syntaxwarning
branch: ci/syntaxwarning-error
status: approved
---

# Spec — El CI falla ante un SyntaxWarning de Python

> Slug: `ci-syntaxwarning` · Status: approved — aprobada por el dueño el 2026-11-12 («si continua») · Created: 2026-11-12
> Inherits: [constitution](../constitution.md)

## Problem & why
Python avisa con un `SyntaxWarning` de cosas que hoy funcionan pero que serán errores en una versión futura (por ejemplo, una secuencia de escape inválida en una cadena). Con la configuración actual el aviso sale en el log del CI y nadie lo lee, así que el problema solo se descubre el día que Python lo convierte en error y rompe la app. La verificación de la migración a React (T058, criterio 8) pedía que el CI lo vigilara, y solo se había comprobado a mano.

## Cost of not building it
Poco hoy: la app y los tests no cambian. El coste es futuro: al subir de versión de Python, un aviso ignorado puede romper la app o los tests de golpe y a la vez, sin que ningún PR lo señale. El criterio 8 de T058 sigue sin cubrir en el CI.

## The cheapest alternative
Dejarlo como está y mirar el log del CI de vez en cuando. Es gratis, pero depende de que alguien lea un log que casi siempre está en verde. Otra opción es una revisión manual al subir de versión de Python. Se descarta porque llega tarde: el aviso se acumula durante meses y se paga todo junto.

## Goals
- Un `SyntaxWarning` introducido por un PR hace que el job de tests del CI salga en rojo en ese mismo PR.
- Con el código actual el CI sigue en verde.

## Non-goals / out of scope
- Convertir en error otros avisos de Python (`DeprecationWarning`, etc.).
- Cambiar versiones de Python o de dependencias.
- Tocar el job del frontend, la auditoría de dependencias o el código de la app.
- Vigilar los avisos del propio código del frontend o de TypeScript.

## Users & context
El dueño del proyecto (único desarrollador), que abre PR contra `main` y mira el resultado del CI.

## What the user can do
Abrir un PR como siempre. Si el PR añade código con un `SyntaxWarning`, el CI se lo dice con un fallo en el job de tests, sin que nadie tenga que leer el log.

## What result they get
Un PR sin avisos sale en verde. Un PR con un aviso de sintaxis sale en rojo, y el log del job nombra el archivo y la línea. La referencia es el resultado de los comandos de «Cómo lo demuestra», no una captura.

## What it must respect
- `main` está cerrada: el cambio entra por rama y PR.
- Constitución: la suite de tests sigue en verde y el CI no depende del harness.
- Los 569 tests actuales siguen pasando, con los 11 omitidos como hasta ahora.
- El resto del workflow (instalación, base de datos de prueba, auditoría de dependencias, job del frontend) no cambia.

## How it proves it
Salidas de comandos, guardadas en la verificación del PR:
- `pytest -q -W error::SyntaxWarning` en local con el código actual: todos los tests pasan.
- Una prueba en negativo: un archivo temporal con una secuencia de escape inválida hace fallar el mismo comando. Sin esa prueba, un verde no demuestra que el flag vigile algo.
- El CI del PR sale verde.

## Behaviour
- Main path: el job de tests ejecuta la suite con los `SyntaxWarning` tratados como error y termina en verde si no hay ninguno.
- Edge cases: un `SyntaxWarning` en el código de un test o de la app falla igual. Uno que surge dentro de una dependencia instalada se compila al importarla y también falla; si un día pasa, se decide entonces si se excluye esa dependencia.
- Error paths: si el aviso aparece, el job falla con el archivo y la línea en el log. No hay reintento automático.

## Acceptance criteria
- Given el código de la rama, When se ejecuta `pytest -q -W error::SyntaxWarning`, Then todos los tests pasan.
- Given un archivo de Python con una secuencia de escape inválida en una cadena, When se importa bajo `-W error::SyntaxWarning`, Then falla con un `SyntaxError` que nombra el archivo y la línea.
- Given el workflow `.github/workflows/tests.yml`, When se lee el paso «Run tests», Then ejecuta `pytest -q -W error::SyntaxWarning`.
- Given el diff contra `main`, When se listan los archivos cambiados, Then solo aparecen `.github/workflows/tests.yml` y los documentos de esta spec.
- Given el PR, When termina el CI, Then el job de tests y el del frontend salen en verde.

## Points to clarify
- **suposición tomada** — Ninguna dependencia instalada genera hoy un `SyntaxWarning` al importarse. *Base:* la suite completa pasa en local con el flag. *Riesgo:* la versión de Python o de las dependencias del CI (3.13 en ubuntu) puede diferir de la local; el CI del PR lo confirma.
- **decisión diferida** — Tratar como error otros avisos (`DeprecationWarning`); fuera de este ciclo.
