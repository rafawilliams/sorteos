---
type: spec
title: Spec — Poner al día CLAUDE.md tras los PR #25–#27
description: WHAT y WHY de corregir las instrucciones del asistente que describen métodos ya cambiados (decenas, recomendación estadística, /api/stats, tamaños).
tags: [sdd, spec, harness, docs]
timestamp: 2026-11-05T15:10:00Z
topic: sdd
slug: claude-md-decenas
branch: docs/claude-md-decenas
status: clarified
---

# Spec — Poner al día CLAUDE.md tras los PR #25–#27

> Slug: `claude-md-decenas` · Status: clarified — aprobada por el dueño el 2026-11-05 · Created: 2026-11-05
> Inherits: [constitution](../constitution.md)

## Problem & why
`CLAUDE.md` es lo que el asistente lee antes de trabajar en este repo. Tras los PR #25, #26 y #27, cuatro frases describen cosas que ya no son así:
- el método de las decenas (patrón de 3 sorteos sin mínimo, desde 1919, solo el 1er premio);
- «Monte Carlo recommendations» en el estadístico;
- `/api/stats` sin las terminaciones por categoría ni los backtests;
- el tamaño de los archivos (`app.py` unas 420 y `estadisticas.py` unas 840 líneas; hoy son 439 y 931).

En el PR #27 se dejó fuera a propósito, porque editar `CLAUDE.md` sube el riesgo a nivel 2.

## Cost of not building it
Un asistente futuro leería instrucciones falsas. Podría «arreglar» las decenas hacia el método viejo, o razonar con un Monte Carlo que ya no existe. El coste es de errores evitables en sesiones futuras, no de la app en sí.

## The cheapest alternative
Dejarlo así y confiar en que el asistente lea el código. No basta: `CLAUDE.md` prevalece como instrucción, y una instrucción falsa pesa más que el código que contradice.

## Goals
- Que las cuatro frases describan el comportamiento actual de `main`.

## Non-goals / out of scope
- Reescribir o reorganizar `CLAUDE.md`.
- Tocar código, tests o cualquier otro archivo de configuración del asistente (`.claude/`, `.rsc/`).
- Documentar en `CLAUDE.md` cosas que ya están bien descritas.

## Users & context
El asistente (y quien lea `CLAUDE.md`) al empezar una sesión en este repo.

## What the user can do
Abrir `CLAUDE.md` y encontrar el método vigente de las decenas, la recomendación estadística, el contenido de `/api/stats` y el tamaño aproximado de los archivos.

## What result they get
Un diff de `CLAUDE.md` que solo cambia esas cuatro frases. Referencia: el código de `main` tras el PR #27 (`estadisticas.decena_recommendation`, `decena_backtest`, `number_recommendation`, `construir_stats`) y `wc -l app.py estadisticas.py`.

## What it must respect
- Lo que dice `CLAUDE.md` debe coincidir con el código. No se inventa comportamiento.
- El resto de `CLAUDE.md` queda intacto.
- `main` cerrada: rama y PR.

## How it proves it
- `git diff origin/main -- CLAUDE.md` solo muestra las cuatro frases.
- `git diff origin/main --stat` solo lista `CLAUDE.md` y esta spec.
- Cada frase nueva se contrasta con el código citado.
- Un panel de 3 revisores (correctness, security, tests) contrasta el texto con el código.

## Behaviour
- Main path: el asistente lee las frases nuevas y razona con el método actual.
- Edge cases: ninguno; es texto.
- Error paths: si una frase no coincide con el código, la revisión la marca y se corrige antes de subir.

## Acceptance criteria
- Given `CLAUDE.md`, When se lee la línea de decenas, Then describe: datos desde 1995, patrón del 1er premio de los 3 últimos sorteos, seguidoras de los 3 premios, mínimo 20 → par → frecuencia, confianza = lift ÷ 10 % y `decena_backtest` de 200 sorteos con azar = decenas distintas ÷ 10.
- Given `CLAUDE.md`, When se lee la descripción de `estadisticas.py`, Then no dice «Monte Carlo».
- Given `CLAUDE.md`, When se lee `/api/stats`, Then menciona las terminaciones por categoría y los backtests de terminaciones y decenas.
- Given `CLAUDE.md`, When se lee el encabezado del backend, Then los tamaños son unas 440 y 930 líneas.
- Given el diff contra `main`, When se listan los archivos, Then solo aparecen `CLAUDE.md` y esta spec.

## Points to clarify
- **suposición tomada** (validada por el dueño, 2026-11-05) — Corregir los tamaños de archivo aunque no se pidió explícitamente. *Base:* está en la misma pasada y es igual de falso. *Riesgo:* ninguno.
