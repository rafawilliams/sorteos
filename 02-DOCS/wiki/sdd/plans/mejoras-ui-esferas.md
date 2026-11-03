---
type: plan
title: Plan — Mejoras de UI (Esferas de Sorteo, Dashboard y Visualización)
description: HOW de la spec mejoras-ui-esferas — sistema de bolos 3D (.lotto-ball), rediseño de #dashboardSummary, mejoras de tablas/heatmaps y pruebas de contrato UI.
tags: [sdd, plan, ui]
timestamp: 2026-11-02T20:16:00Z
topic: sdd
slug: mejoras-ui-esferas
status: implemented (autopilot)
---

# Plan — Mejoras de UI (Esferas de Sorteo, Dashboard y Visualización)

Spec: [mejoras-ui-esferas](../specs/mejoras-ui-esferas.md) · Constitution: [v1.0.0](../constitution.md)

## Arquitectura y diseño técnico

### 1. Sistema de Esferas de Sorteo (`.lotto-ball`) y Tarjetas (Bloque B)
- **Helper JS `renderBalls(value, variant = 'gold', size = 'md')` en `static/app.js`:**
  - Recibe una cadena (`"0482"`, `"98"`, `"05309"` o `""`).
  - Nunca aplica `padStart(4)`: itera carácter por carácter sobre `String(value)` tal como viene normalizado por la API (respetando el Principio 7 de la Constitución). Si está vacío, devuelve `<span class="num-empty">—</span>`.
  - Devuelve un contenedor `<span class="lotto-balls lotto-balls-${size}" aria-label="${esc(value)}">` cuyos hijos son `<span class="lotto-ball ball-${variant}" aria-hidden="true">${esc(ch)}</span>`.
- **Variantes CSS en `static/style.css`:**
  - `.ball-gold` (1er premio / modo Estadístico): gradiente radial esférico dorado con brillo especular superior izquierdo (`radial-gradient(circle at 32% 30%, ...)`), sombra proyectada y borde sutil.
  - `.ball-green` (2do premio / modo ML): gradiente radial esmeralda.
  - `.ball-purple` (3er premio): gradiente radial púrpura/amatista.
  - `.ball-hot` (terminaciones calientes / alertas): gradiente coral/rojo.
  - Tamaños: `lg` (tarjetas de recomendación principales: 42–46px), `md` (terminaciones / dashboard: 30–34px), `sm` (tablas / seguimiento: 24px).
  - Soporte completo para `[data-theme="light"]` ajustando sombras y contraste del dígito interior.
- **Tarjetas de recomendación (`.reco-card`):**
  - En `renderRecommendations()`, `renderEndingsSection()` y `renderMonthlySection()`, reemplazan el número plano por `renderBalls(...)`, añaden barra de confianza unificada (`.conf-bar` + `.conf-bar-fill`, corrigiendo en Mensual las clases `.reco-bar-wrap`/`.reco-bar` que no tenían CSS) y mantienen intacto el botón `.copy-btn` con `data-num`.

### 2. Dashboard Principal (`#dashboardSummary`) (Bloque C)
- **Layout `.dashboard-hero-grid` en `renderDashboard()`:**
  - **Columna izquierda (`.last-draw-card`):** tarjeta destacada para el último sorteo (`allSorteos[0]`) con:
    - Cabecera: insignia de categoría (`.cat-pill.cat-${last.cat}`), etiqueta «Último Sorteo Oficial» y fecha formateada con `formatDate(last.fecha)`.
    - Cuerpo de 3 premios (`.last-draw-prizes`): tres cajas (`1er Premio`, `2do Premio`, `3er Premio`) que llaman a `renderBalls(last.primero, 'gold', 'md')`, `renderBalls(last.segundo, 'green', 'md')` y `renderBalls(last.tercero, 'purple', 'md')`.
    - Pie tipo billete (`.last-draw-meta`): muestra `Letras`, `Serie` y `Folio` con tipografía monoespaciada (o `—` si el sorteo no tiene ese campo).
  - **Columna derecha (`.dashboard-kpis`):** cuadrícula 2×2 de tarjetas KPI:
    1. **Top Estadístico:** esferas `sm` en oro + porcentaje de confianza.
    2. **Top ML:** esferas `sm` en esmeralda + porcentaje de confianza.
    3. **Terminación Caliente:** esferas `sm` en rojo (`ball-hot`) + conteo en el año actual.
    4. **Historial Total:** total de sorteos formateado + rango histórico desde 1919.

### 3. Mapas de Calor, Tablas y Gráficos (Bloque D)
- **Variables y clases faltantes en `static/style.css`:**
  - Definir `--surface-2` en `:root` y `[data-theme="light"]` (usada en Gaps y Mensual).
  - Definir estilos completos para `.heatmap-table` (usada en Comparador, Gaps y Ventaja Mensual): bordes redondeados, cabeceras con contraste, celdas alineadas y hover de fila.
  - Definir `.cat-badge` (usada en Simulador y Favoritos) alineada con `.cat-pill`.
- **Mapas de calor (`renderEndingsHeatmap` y `renderHeatmap`):**
  - Añadir barra de leyenda superior (`.heatmap-legend`: `Baja frecuencia` → gradiente de muestras → `Alta frecuencia · ★ Top`).
  - Destacar las celdas top (≥ 85 % del máximo) con clase `.cell-peak` (borde dorado brillante y ligero realce).
- **Tablas de Resultados y Seguimiento:**
  - En `renderSorteos()`, presentar los 3 premios con insignias monoespaciadas diferenciadas por premio (`.prize-chip.prize-1`, `.prize-2`, `.prize-3`) y Letras/Serie/Folio con estilo de metadato limpio.

## Análisis de consistencia (`analyze` gate)
- **Principio 1 y 2 (Stack canon y validez JS):** Todo en JS vanilla y CSS nativo en `static/app.js`, `static/style.css` y `templates/index.html`, verificable con `node -e "new Function(require('fs').readFileSync('static/app.js','utf8'))"`.
- **Principio 7 (Formatos de premios):** `renderBalls()` renderiza la longitud exacta de la cadena recibida (`2`, `4` o `5` cifras), sin `padStart(4)`.
- **Principio 14 (Accesibilidad y temas):** `renderBalls()` usa `aria-label` con el número completo en el contenedor y `aria-hidden="true"` en cada esfera; todos los nuevos selectores incluyen soporte en `[data-theme="light"]`.

## Tareas (`tasks`)
| # | Tarea | Done-check | Depende |
|---|---|---|---|
| T1 | Actualizar `static/style.css` con el sistema `.lotto-ball` (variantes gold/green/purple/hot y tamaños lg/md/sm), layout `.dashboard-hero-grid` / `.last-draw-card`, `.heatmap-table`, `.heatmap-legend`, `.prize-chip`, `--surface-2` y reglas `[data-theme="light"]` + responsive | Archivo CSS válido con variables definidas en dark y light | — |
| T2 | Actualizar `static/app.js` añadiendo `renderBalls()` y mejorando `renderDashboard()`, `renderRecommendations()`, `renderEndingsSection()`, `renderMonthlySection()`, `renderSorteos()`, `renderEndingsHeatmap()` y `renderHeatmap()` sin romper ningún ID ni rol ARIA | `node -e "new Function(require('fs').readFileSync('static/app.js','utf8'))"` pasa sin errores | T1 |
| T3 | Añadir pruebas en `tests/test_ui_assets.py` verificando la presencia de las clases y helpers clave (`.lotto-ball`, `renderBalls`, `.dashboard-hero-grid`, `.heatmap-table`, `[data-theme="light"]`, ausencia de `padStart(4)` en premios de tabla/dashboard) | `pytest -q -W error::SyntaxWarning` pasa al 100 % | T2 |
| T4 | Actualizar `02-DOCS/wiki/index.md` y `02-DOCS/wiki/sdd/decisions.md`, y ejecutar la fase `verify` | Reporte de verificación en `02-DOCS/wiki/sdd/verifications/mejoras-ui-esferas-2026-11-02.md` en PASS | T3 |
