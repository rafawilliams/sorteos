---
type: spec
title: Spec — Mejoras de UI (Esferas de Sorteo, Dashboard y Visualización)
description: WHAT y WHY del rediseño visual de tarjetas con esferas de sorteo (bolos 3D), panel principal de último sorteo en el Dashboard y mejoras de legibilidad en tablas y mapas de calor.
tags: [sdd, spec, ui]
timestamp: 2026-11-02T20:06:00Z
topic: sdd
slug: mejoras-ui-esferas
status: approved in autopilot, not item by item (2026-11-02)
---

# Spec — Mejoras de UI (Esferas de Sorteo, Dashboard y Visualización)

> Slug: `mejoras-ui-esferas` · Status: approved in autopilot, not item by item · Created: 2026-11-02
> Inherits: [constitution](../constitution.md) (`v1.0.0`)

## Problem & why
La interfaz actual muestra los números recomendados, los premios del último sorteo y las cifras de las tablas como texto plano con un estilo muy parecido al de los contadores secundarios, por lo que al abrir la aplicación cuesta distinguir de un vistazo el resultado oficial completo del último sorteo (sus 3 premios en su formato real de 2, 4 o 5 cifras más Letras, Serie y Folio), diferenciar visualmente las recomendaciones de 4 cifras y de terminaciones (2 cifras) entre el modo estadístico y el modo ML, y leer con rapidez las tablas densas y los mapas de calor de 100 terminaciones y de posiciones.

**Objeción registrada (2026-11-02) y decisión del dueño.** Un cambio visual no modifica la precisión de los modelos ni añade rutas nuevas, y alterar el marcado generado en el cliente puede afectar el contraste en modo claro o la accesibilidad si no se cuida. El dueño eligió abordar los bloques **B (Estética y tarjetas con Esferas de Sorteo / Opción 2)**, **C (Dashboard principal)** y **D (Tablas, mapas de calor y gráficos)** dejando intacta la estructura de las 14 pestañas, en modo autopilot.

## Cost of not building it
Los datos siguen siendo correctos, pero la experiencia de lectura permanece plana: el bloque inicial (`#dashboardSummary`) presenta el último sorteo comprimido en una tarjeta pequeña sin Letras, Serie ni Folio y con el mismo peso visual que cuatro métricas sueltas; las tarjetas de predicción no transmiten identidad de sorteo de lotería; y los mapas de calor carecen de leyenda de escala y de resaltado claro de los valores máximos.

## The cheapest alternative
Ajustar únicamente tamaños de fuente y márgenes en la hoja de estilos sin cambiar la representación de los números ni la composición del resumen inicial ni las leyendas de los mapas de calor. Mejora ligeramente el espaciado, pero no introduce la representación por dígito en esferas de sorteo, ni muestra los metadatos completos del último sorteo en el Dashboard, ni añade referencia visual a los mapas de calor.

## Goals
- Representar cada cifra de los números recomendados (4 cifras en Predicciones y Mensual; 2 cifras en Terminaciones) y de los premios principales mediante esferas de sorteo individuales (bolos con relieve visual), diferenciando por color el método activo (Estadístico vs ML) y el nivel de premio (1ro, 2do, 3ro) sin perder la lectura íntegra del número ni la función de copiado.
- Reestructurar el resumen rápido del Dashboard (`#dashboardSummary`) en un bloque protagonista para el **Último Sorteo Oficial** (categoría, fecha formateada, los 3 premios en esferas respetando su longitud real de 2, 4 o 5 cifras, más Letras, Serie y Folio) acompañado de una cuadrícula clara de 4 indicadores clave (Top Estadístico, Top ML, Terminación más caliente del año y Total de sorteos).
- Mejorar la legibilidad de tablas (Resultados, Comparador, Gaps, Seguimiento) y mapas de calor (100 Terminaciones y Posición vs Dígito) incorporando leyenda de intensidad (frío → caliente), resaltado de valores pico y jerarquía visual en celdas de premios y estados.
- Preservar al 100 % la accesibilidad (roles ARIA, navegación por teclado, lectura por tecnologías de asistencia del número completo sin deletreo forzado de esferas) y el contraste tanto en modo oscuro como en modo claro (`[data-theme="light"]`).

## Non-goals / out of scope
- Cambiar, agrupar o eliminar cualquiera de las 14 pestañas de navegación principal (opción A descartada por el usuario).
- Modificar rutas, cálculos estadísticos, pesos del modelo ML o el esquema de base de datos en el backend.
- Alterar el formato real de los premios recibidos de la API (prohibido rellenar con ceros a 4 cifras premios de 2 o 5 cifras).
- Añadir librerías externas de interfaz o bundlers.

## Users & context
Personas que consultan la web en escritorio o móvil (en tema oscuro o claro) para revisar el último sorteo oficial de la Lotería de Panamá, comparar las recomendaciones antes del próximo sorteo y explorar frecuencias, terminaciones, decenas, gaps y seguimiento histórico.

## Behaviour
- **Esferas de sorteo (Bolos 3D) en números y premios (Bloque B):**
  - En las tarjetas de recomendación de Predicciones, Terminaciones y Mensual, cada dígito del número o terminación se muestra dentro de una esfera circular con volumen visual (dorada para modo Estadístico, esmeralda para modo ML; y destacada en el 1er recomendado), manteniendo un contenedor con etiqueta accesible del número completo y el botón de copiar funcional.
  - Si un premio tiene 2, 4 o 5 cifras (o está vacío en sorteos históricos sin 2do/3er premio), se renderizan exactamente tantas esferas como cifras tenga su formato real (o un guion `—` si está vacío).
- **Dashboard Principal jerarquizado (Bloque C):**
  - El contenedor `#dashboardSummary` muestra a la izquierda un panel destacado del **Último Sorteo** con insignia de categoría, fecha legible, tres bloques para 1er, 2do y 3er premio con esferas diferenciadas por color (oro, esmeralda y púrpura) y pie de billete con Letras, Serie y Folio.
  - A la derecha muestra una cuadrícula 2×2 de tarjetas KPI con Top Recomendación Estadística, Top ML, Terminación Más Caliente del año en curso y Total de Sorteos en la historia.
- **Mapas de calor, tablas y visualización refinada (Bloque D):**
  - Los mapas de calor de Terminaciones (`00–99`) y de Posición vs Dígito incluyen una cabecera/leyenda de escala visual (menor a mayor frecuencia) y destacan con borde/relieve las celdas de mayor frecuencia.
  - Las tablas de Resultados, Comparador, Gaps y Seguimiento presentan filas con separación clara, premios en cápsulas/insignias diferenciadas por premio y variables de superficie definidas tanto en tema oscuro como en `[data-theme="light"]` (corrigiendo además variables huérfanas como `--surface-2` o `.heatmap-table` sin estilo dedicado).

## Acceptance criteria
- Given cualquier número recomendado de 4 cifras o terminación de 2 cifras en Predicciones, Terminaciones o Mensual, When se renderiza la tarjeta en modo Estadístico o ML, Then cada dígito aparece en su propia esfera circular (`.lotto-ball`) con la variante de color correspondiente y el botón `Copiar` copia el número íntegro sin espacios.
- Given un sorteo con premios de 2, 4 o 5 cifras (p. ej. Gordito con 2do/3er premio de 2 cifras o Extraordinario de 5 cifras), When se muestra en el panel de Último Sorteo del Dashboard o en las tablas, Then se muestran exactamente las cifras reales sin aplicar `padStart(4)` ni truncar.
- Given la vista inicial de la aplicación (`#dashboardSummary`), When se cargan los datos de sorteos y estadísticas, Then se visualiza el panel del Último Sorteo con 1er, 2do y 3er premio más Letras, Serie y Folio, junto a los 4 indicadores KPI.
- Given los mapas de calor de Terminaciones y Posiciones y las tablas `.heatmap-table`, When el usuario alterna entre tema oscuro y tema claro (`[data-theme="light"]`), Then las leyendas de escala, celdas y tablas mantienen contraste legible y estilos completos.
- Given la suite de pruebas (`pytest -q -W error::SyntaxWarning`), la auditoría de dependencias y la validación de sintaxis de `static/app.js`, When se ejecutan tras los cambios, Then todas pasan sin errores ni regresiones.

## Points to clarify
- **resuelta (frontier 2026-11-02)** — Áreas de mejora seleccionadas por el dueño: B (Estética y tarjetas), C (Dashboard principal) y D (Gráficos, mapas de calor y tablas), manteniendo las 14 pestañas actuales.
- **resuelta (frontier 2026-11-02)** — Dirección estética elegida por el dueño: Opción 2 (Esferas de Sorteo / Bolillero 3D) y continuación en modo autopilot.
- **suposición tomada** — Para no entorpecer a lectores de pantalla al dividir un número `"0482"` en cuatro elementos visuales `<span>`, el contenedor padre lleva `aria-label="0482"` y cada esfera individual lleva `aria-hidden="true"`. *Base:* principio 14 de la Constitución (accesibilidad e interfaz). *Riesgo:* ninguno.

## Revisions
- 2026-11-02 — Especificación creada y aprobada en autopilot tras selección de áreas B+C+D y Opción 2 (Esferas de Sorteo).
