---
type: spec
title: Spec — Actualizar el harness rsc a 4.0.5
description: WHAT y WHY de subir rsc de 3.6.0 a 4.0.5 y dejar de versionar su estado local de máquina.
tags: [sdd, spec, harness]
timestamp: 2026-11-05T12:00:00Z
topic: sdd
slug: rsc-4
branch: chore/rsc-4
status: clarified
---

# Spec — Actualizar el harness rsc a 4.0.5

> Slug: `rsc-4` · Status: clarified — aprobada por el dueño el 2026-11-05 · Created: 2026-11-05
> Inherits: [constitution](../constitution.md)
> Ficha FTD: [rsc-4](../../ftd/rsc-4.md)

## Problem & why
El harness que guía al asistente en este repo estaba en la versión 3.6.0. La 4.0.5 cambia el método de trabajo: `sdd` pasa a `asdd`, con revisión dentro de cada tarea según el riesgo. Además, la 4.0.5 declara que las copias de las skills y el estado del harness son locales de cada máquina. El repo todavía las guardaba, así que cada actualización llenaba el historial con cientos de archivos que no son del proyecto.

## Cost of not building it
Poco para la app: los sorteos, las estadísticas y las predicciones no cambian. El coste es para el trabajo diario. El asistente seguiría con un método viejo, y cada actualización del harness ensuciaría el historial y los PR con cientos de archivos ajenos a la app.

## The cheapest alternative
Quedarse en 3.6.0. Es gratis, pero las instrucciones de sesión ya avisan de la versión nueva y el método se queda atrás. Otra opción era actualizar y seguir versionando las copias. Se descartó: contradice el `.gitignore` que trae la propia 4.0.5 y deja el repo a medias.

## Goals
- El harness del proyecto queda en 4.0.5 y el diagnóstico de la herramienta lo da por sano.
- El repo deja de guardar copias del harness. Solo quedan la configuración compartida (`.rsc.json`, ajustes del asistente) y las skills que no gestiona rsc.
- Un clon nuevo puede reconstruir el harness con un solo comando.

## Non-goals / out of scope
- Cualquier cambio en el código de la app, los tests o la base de datos.
- Retocar las skills que no gestiona rsc (brainstorming, systematic-debugging, etc.).
- Migrar specs o documentos SDD anteriores al formato ASDD.
- Apagar o ajustar los controles nuevos de la v4.

## Users & context
El dueño del proyecto (único desarrollador), que trabaja con el asistente en esta máquina. Ocasionalmente, alguien que clona el repo público.

## What the user can do
Desde esta máquina, con el repo abierto, el dueño trabaja con el asistente usando el método `asdd` y el carril `ftd`. Quien clona el repo ejecuta `npx @ericrisco/rsc sync` para obtener el harness. Nadie necesita el harness para ejecutar la app ni los tests.

## What result they get
- `npx @ericrisco/rsc --version` muestra `4.0.5` para la herramienta y para el proyecto.
- `npx @ericrisco/rsc doctor` muestra `"healthy": true`.
- El PR muestra salidas del repo bajo `.rsc/` y `.claude/skills/<skill gestionada>`, más cambios en `.gitignore`, `.rsc.json`, `.claude/settings.json` y `.claude/rsc-bootstrap.mjs`. Ningún archivo de la app cambia.

## What it must respect
- `main` está cerrada: el cambio entra por rama y PR (memoria `branch-per-improvement`).
- Constitución: la suite de tests sigue en verde y el CI no depende del harness.
- Los archivos sacados del repo siguen en el disco de esta máquina. No se borra trabajo local.
- `.claude/launch.json` (servidor de vista previa) y `.claude/settings.local.json` no cambian de estado.

## How it proves it
Salidas de comandos, registradas en la ficha FTD [rsc-4](../../ftd/rsc-4.md): `rsc --version`, `rsc doctor`, `git ls-files -ci --exclude-standard` (vacío), existencia de `.rsc/` y `.claude/skills/asdd` en el disco, y `pytest -q` (`164 passed`). El CI del PR debe salir verde.

## Behaviour
- Main path: tras el cambio, el asistente carga las skills de la 4.0.5 y git ignora el estado del harness.
- Edge cases: en un clon sin harness, la app y los tests funcionan igual; el asistente avisa que falta y propone `rsc sync`.
- Error paths: si `rsc sync` falla en un clon, solo se pierde la ayuda del asistente; la app no se ve afectada.

## Acceptance criteria
- Given la rama `chore/rsc-4`, When se ejecuta `npx @ericrisco/rsc --version`, Then dice `4.0.5` para la herramienta y para el proyecto.
- Given la rama, When se ejecuta `npx @ericrisco/rsc doctor`, Then el resultado incluye `"healthy": true`.
- Given la rama, When se ejecuta `git ls-files -ci --exclude-standard`, Then no lista nada.
- Given la rama, When se lista el disco, Then `.rsc/` y `.claude/skills/asdd` existen.
- Given la rama, When se ejecuta `pytest -q`, Then todos los tests pasan.
- Given el diff contra `main`, When se filtra por archivos de la app (`*.py` fuera de `.claude/` y `.rsc/`, `static/`, `templates/`), Then no hay cambios.

## Points to clarify
- **suposición tomada** (validada por el dueño, 2026-11-05) — Nadie más trabaja con un clon que dependa de las copias versionadas. *Base:* proyecto de un único desarrollador. *Riesgo:* un colaborador tendría que ejecutar `rsc sync` una vez.
- **decisión diferida** — Si conviene migrar specs viejos al formato ASDD; queda fuera de este ciclo.
