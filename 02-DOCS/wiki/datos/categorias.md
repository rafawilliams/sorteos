---
type: topic
title: Categorías de sorteo
description: Qué sorteos hay, qué nombres usa la API para cada uno y cuándo se juegan.
tags: [datos, dominio, categorias]
timestamp: 2026-11-05T21:30:00Z
topic: datos
---

# Categorías de sorteo

Confirmado por el dueño el 2026-11-05.

| Categoría | Otros nombres en la API | Cuándo se juega | Formato de premios |
| --- | --- | --- | --- |
| `dominical` | — | domingos | 4 cifras |
| `miercolito` | — | miércoles | 4 cifras (2 cifras en 1962–1966) |
| `gordito` | `zodiaco` (Gordito del Zodíaco) | viernes | 1º de 4 cifras; 2º y 3º de 2 cifras desde 1996 |
| `extraordinario` | `extraordinaria`, `extraordonario` | solo en abril, agosto y diciembre | 5 cifras desde 1995 |

- Las grafías alternativas son **el mismo sorteo**. `loteria.categoria_canonica` las junta al leer y al guardar.
- En la base quedan 2 filas guardadas como `zodiaco` (2023-12-01 y 2023-12-29). No se modifican: se leen como `gordito`.
- Spec: [categorias-unicas](../sdd/specs/categorias-unicas.md).
