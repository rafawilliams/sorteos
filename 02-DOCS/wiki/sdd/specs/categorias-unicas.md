---
type: spec
title: Spec — Una sola categoría por sorteo (extraordinario y gordito)
description: WHAT y WHY de tratar extraordinaria/extraordonario como extraordinario y zodiaco como gordito en toda la app.
tags: [sdd, spec, datos, harness]
timestamp: 2026-11-05T21:30:00Z
topic: sdd
slug: categorias-unicas
branch: fix/categorias-unicas
status: clarified
---

# Spec — Una sola categoría por sorteo

> Slug: `categorias-unicas` · Status: clarified — aprobada por el dueño el 2026-11-05 · Created: 2026-11-05
> Inherits: [constitution](../constitution.md)

## Problem & why
El dueño confirma, el 2026-11-05, que **extraordinario, extraordinaria y extraordonario son el mismo sorteo**, y que **zodiaco es el gordito** (Gordito del Zodíaco).

El código las trata como categorías distintas:
- `actualizar_db.py` guarda la categoría tal como llega de la API.
- El ML les da códigos distintos (`CAT_MAP`).
- Hay una etiqueta para cada una (`CAT_LABELS` en Python y JS).
- `CLAUDE.md` las lista por separado.

En la base hay hoy 166 `extraordinario`, 0 `extraordinaria`, 0 `extraordonario` y **2 `zodiaco`**. Esos 2 son los gordito del 01-12-2023 y del 29-12-2023. Salen aparte del gordito en estadísticas, terminaciones, decenas y pestañas.

## Cost of not building it
- Los 2 sorteos de gordito de diciembre de 2023 no cuentan en el gordito, y aparecen como una categoría «Zodiaco» con muestras de 2 sorteos.
- Si la API manda una variante, se crea una categoría nueva. Tendría estadísticas propias, un registro aparte en Seguimiento y no llevaría el aviso de meses del extraordinario.

## The cheapest alternative
Un `UPDATE` de las 2 filas `zodiaco` en la base. No basta: no protege de variantes futuras de la API, y cambia datos de producción cuando no hace falta.

## Goals
- Una función única, `loteria.categoria_canonica`, que se use al leer (`get_sorteos`) y al guardar (`actualizar_db`): `extraordinaria`/`extraordonario` → `extraordinario` y `zodiaco` → `gordito`.
- El ML, las etiquetas y `CLAUDE.md` coherentes con eso.
- El dato apuntado en la wiki.

## Non-goals / out of scope
- Modificar filas ya guardadas en la base: se normaliza al leer.
- Los sorteos dudosos (9379, 9368/9378, 9381 y los históricos).
- Reentrenar el modelo a mano: se reentrena en la próxima sincronización.

## Users & context
Quien mira las estadísticas, las predicciones o Seguimiento de gordito y extraordinario. Y el asistente, que lee `CLAUDE.md` al trabajar en el repo.

## What the user can do
Ver gordito y extraordinario como una sola categoría cada uno, en todas las pestañas, con todos sus sorteos.

## What result they get
El gordito con 401 sorteos (incluye los 2 de diciembre de 2023). No aparece ninguna categoría «Zodiaco», «Extraordinaria» ni «Extraordonario».

## What it must respect
- Los premios siguen en su formato real: `zodiaco` y `gordito` ya comparten la regla de 2 cifras en 2º y 3º.
- La protección de duplicados de `actualizar_db` sigue funcionando: `ALIAS_CATEGORIA` pasa a usar la función única.
- `main` cerrada: rama, PR y panel de 3 revisores (nivel 2 por `CLAUDE.md`).

## How it proves it
- pytest:
  - `categoria_canonica` para las 7 grafías, mayúsculas y espacios incluidos;
  - `_row_to_dict` devuelve `gordito` para una fila `zodiaco`, con los premios de 2 cifras intactos;
  - `fila_a_loteria` guarda `extraordinario` para `extraordonario`;
  - `clave_sorteo` y `descartar_sospechosos` siguen tratando `zodiaco` como `gordito`.
- Datos reales: `get_sorteos()` no devuelve ninguna categoría fuera de {dominical, miercolito, gordito, extraordinario}, y gordito pasa de 399 a 401.
- Navegador: no aparece la pestaña ni la etiqueta «Zodiaco».
- Panel de 3 revisores (correctness, security, tests).

## Behaviour
- Main path: cada sorteo leído o guardado lleva su categoría canónica.
- Edge cases: mayúsculas y espacios (`" Extraordonario "`); una categoría desconocida se devuelve tal cual, en minúsculas y sin espacios; `None` o vacía → `""`.
- Error paths: ninguno nuevo; la función no lanza excepciones.

## Acceptance criteria
- Given una fila `zodiaco` en la base, When se lee con `get_sorteos`, Then su `cat` es `gordito`.
- Given una fila de la API con `cat` = `Extraordonario `, When se guarda, Then `tipo` = `extraordinario`.
- Given el ML, When codifica una variante, Then usa el mismo código que su categoría canónica.
- Given `CLAUDE.md`, When se lee *Categories*, Then dice que las variantes son el mismo sorteo y que se normalizan con `loteria.categoria_canonica`.

## Points to clarify
- **suposición tomada** — Juntar `zodiaco` con `gordito` va incluido («todo junto», 2026-11-05). *Base:* el alias ya existía en `actualizar_db` y no hay gordito en las fechas de esos 2 sorteos. *Riesgo:* bajo.
- **suposición tomada** — `CLAUDE.md` va en este mismo PR («todo junto»). *Riesgo:* nivel 2: spec y panel.
