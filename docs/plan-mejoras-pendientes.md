# Plan de Mejoras Pendientes — Lotería de Panamá

## Completado
- [x] Cache de estadísticas (TTL 5 min, evita recalcular 50K simulaciones)
- [x] Análisis de 1er, 2do y 3er premio (tabs de premio en predicciones y estadísticas)
- [x] Paginación en tabla de resultados (50 por página con navegación)
- [x] Filtro por rango de fechas (date pickers en barra de filtros)
- [x] Gráficas de tendencia temporal con Chart.js (frecuencia de dígitos + volumen por mes)
- [x] Fecha de última actualización visible en header y footer
- [x] Copiar número al portapapeles (botón en cada tarjeta + toast feedback)
- [x] Exportar resultados a CSV (client-side, respeta filtros)
- [x] Actualización automática de datos (endpoint + botón UI)
- [x] Análisis de últimos 2 dígitos (terminaciones 00-99, heatmap, tendencias, recomendaciones)
- [x] Dark/Light mode toggle (CSS variables, localStorage, charts theme-aware)
- [x] Variables de entorno (.env + python-dotenv + .env.example)
- [x] Actualizar requirements.txt (Flask + dotenv + versiones pineadas)
- [x] Gráficas interactivas avanzadas (radar comparación por categoría + scatter correlación premios)
- [x] Separar CSS/JS del HTML (static/style.css + static/app.js, HTML de 804→206 líneas)
- [x] Recomendaciones desde 1995 en adelante (filtro _filter_recent con RECO_DATE_FROM)
- [x] Modelo de Machine Learning (HistGradientBoosting, 4 clasificadores por posición, features de frecuencia rodante/gaps/temporales, retrain automático al actualizar datos, toggle ML/Estadístico en UI)
- [x] Sección de Decena Recomendada (triángulo SVG, patrones de 3 sorteos por categoría)
- [x] Precisión histórica / Backtesting (backtest ML+estadístico, métricas por posición, Top-1/Top-3, endings, gráfico tendencia mensual, comparación ML vs Estadístico)
- [x] Skeleton loaders (shimmer animation mientras carga data, se muestran inmediatamente en cards de recomendaciones, estadísticas y decenas)
- [x] Responsive refinements (breakpoints tablet 900px + mobile 640px: filtros apilados, grids adaptables, theme toggle compacto, cards y fuentes ajustadas, Chart.js responsive)
- [x] Aria labels y roles (role=tablist/tab/tabpanel en navegación, aria-selected, aria-pressed en ML toggle, aria-label en charts/tablas/inputs, role=status+aria-live en toast/loader, scope=col en th, role=search en filtros, role=table+role=img)
- [x] Navegación por teclado (Arrow keys en tablists, Home/End, tabindex management, skip-link "Saltar al contenido principal", focus-visible styles con outline dorado)

---

## Fase 2 — Funcionalidad (prioridad alta)

### 2.1 Copiar número al portapapeles
- Agregar botón de copiar en cada tarjeta de recomendación
- Feedback visual al copiar (tooltip "Copiado!")
- **Esfuerzo**: Bajo (~30 min)

### 2.2 Exportar resultados a CSV
- Botón de exportar en la sección de Resultados
- Exportar los resultados filtrados (respetando búsqueda, categoría y fechas)
- Generar CSV con: fecha, categoría, 1er, 2do, 3er, letras, serie, folio
- **Esfuerzo**: Bajo (~45 min)

### 2.3 Actualización automática de datos
- Endpoint `/api/actualizar` que ejecute la lógica de `actualizar_db.py`
- Botón en el UI "Actualizar datos" con spinner y confirmación
- Opcionalmente: tarea programada (cron) para sincronizar cada día
- **Esfuerzo**: Medio (~1.5h)

### 2.4 Precisión histórica de recomendaciones
- Comparar las predicciones generadas vs. resultados reales pasados
- Mostrar tasa de acierto (match exacto, match parcial por terminación)
- Sección "Historial de predicciones" con track record
- **Esfuerzo**: Alto (~3h)

---

## Fase 3 — UI/UX (prioridad media)

### 3.1 Dark/Light mode toggle
- CSS variables ya están en su lugar, agregar tema claro alternativo
- Toggle en el header, persistir preferencia en localStorage
- **Esfuerzo**: Medio (~1.5h)

### 3.2 Gráficas interactivas avanzadas
- Migrar barras CSS a Chart.js para interactividad (tooltips, zoom)
- Agregar gráfico de radar para comparar categorías
- Gráfico de dispersión para correlación entre premios
- **Esfuerzo**: Medio (~2h)

### 3.3 Indicadores de carga por sección
- Skeleton loaders en cada card mientras se calcula
- Loading state específico para la sección de estadísticas (más lenta)
- **Esfuerzo**: Bajo (~45 min)

### 3.4 Responsive refinements
- Mejorar la experiencia en móvil para las gráficas Chart.js
- Drawer/sidebar para filtros en pantallas pequeñas
- **Esfuerzo**: Bajo (~1h)

---

## Fase 4 — Backend & Seguridad (prioridad media)

### 4.1 Variables de entorno
- Mover credenciales de DB de `base.py` a `.env`
- Usar `python-dotenv` para cargar configuración
- Agregar `.env.example` con placeholders
- **Esfuerzo**: Bajo (~30 min)

### 4.2 Actualizar requirements.txt
- Agregar Flask a las dependencias
- Pinear versiones exactas
- **Esfuerzo**: Bajo (~10 min)

### 4.3 Separar CSS/JS del HTML
- Mover estilos a `static/style.css`
- Mover JavaScript a `static/app.js`
- Beneficio: mejor cache del navegador, mantenibilidad
- **Esfuerzo**: Medio (~1h)

---

## Fase 5 — Accesibilidad (prioridad baja)

### 5.1 Aria labels y roles
- Agregar `role="table"`, `aria-label` en charts
- Focus states visibles en todos los botones
- **Esfuerzo**: Medio (~1.5h)

### 5.2 Navegación por teclado
- Tab order lógico en filtros y tabs
- Enter/Space para activar tabs
- **Esfuerzo**: Bajo (~45 min)

---

## Orden de ejecución sugerido

1. **Fase 2.1 + 2.2** (Copiar + CSV) — Quick wins, alta satisfacción del usuario
2. **Fase 4.1 + 4.2** (Env vars + requirements) — Higiene técnica básica
3. **Fase 2.3** (Actualización automática) — Reduce trabajo manual
4. **Fase 3.1** (Dark/Light mode) — UX polish
5. **Fase 3.2** (Charts avanzados) — Visualización mejorada
6. **Fase 4.3** (Separar CSS/JS) — Mantenibilidad
7. **Fase 2.4** (Precisión histórica) — Feature diferenciador
8. **Fase 5** (Accesibilidad) — Compliance y usabilidad
