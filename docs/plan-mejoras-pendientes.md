# Plan de Mejoras — Lotería de Panamá (Histórico Completado)

> Todas las fases de este plan inicial fueron implementadas. El seguimiento activo del proyecto, especificaciones SDD y documentos de tareas FTD viven en [`02-DOCS/wiki/index.md`](../02-DOCS/wiki/index.md).

## Completado
- [x] Cache de estadísticas (TTL 5 min, evita recalcular 50K simulaciones)
- [x] Análisis de 1er, 2do y 3er premio (tabs de premio en predicciones y estadísticas)
- [x] Paginación en tabla de resultados (50 por página con navegación)
- [x] Filtro por rango de fechas (date pickers en barra de filtros)
- [x] Gráficas de tendencia temporal con Chart.js (frecuencia de dígitos + volumen por mes)
- [x] Fecha de última actualización visible en header y footer
- [x] Copiar número al portapapeles (botón en cada tarjeta + toast feedback)
- [x] Exportar resultados a CSV (client-side, respeta filtros)
- [x] Actualización automática de datos (endpoint `/api/actualizar` protegido con `X-Update-Token` + botón UI)
- [x] Análisis de últimos 2 dígitos (terminaciones 00-99, heatmap, tendencias, recomendaciones)
- [x] Dark/Light mode toggle (CSS variables, localStorage, charts theme-aware)
- [x] Variables de entorno (`.env` + `python-dotenv` + `.env.example`, sin credenciales por defecto)
- [x] Actualizar `requirements.txt` y `requirements-dev.txt` (versiones fijadas con `==`, `SQLAlchemy 2.0.x`, `pytest` y `pip-audit` en CI)
- [x] Gráficas interactivas avanzadas (radar comparación por categoría + scatter correlación premios)
- [x] Separar CSS/JS del HTML (`static/style.css` + `static/app.js`)
- [x] Recomendaciones desde 1995 en adelante (filtro `_filter_recent` con `RECO_DATE_FROM`)
- [x] Modelo de Machine Learning (`HistGradientBoostingClassifier`, 4 clasificadores por posición, `early_stopping`, features de frecuencia rodante/gaps/temporales, retrain automático al actualizar datos, toggle ML/Estadístico en UI)
- [x] Sección de Decena Recomendada (triángulo SVG, patrones de 3 sorteos por categoría)
- [x] Precisión histórica / Backtesting (backtest ML+estadístico, métricas por posición, Top-1/Top-3, endings, gráfico tendencia mensual, comparación ML vs Estadístico)
- [x] Seguimiento de recomendaciones congeladas frente a resultados reales (`seguimiento.py`, pestaña «Seguimiento», método «Combinada» y marcador frente al azar)
- [x] Skeleton loaders (shimmer animation mientras carga data en cards de recomendaciones, estadísticas y decenas)
- [x] Responsive refinements (breakpoints tablet 900px + mobile 640px)
- [x] Aria labels y roles (`role=tablist/tab/tabpanel`, `aria-selected`, `aria-pressed`, `aria-live`, `scope=col`)
- [x] Navegación por teclado (Arrow keys en tablists, `Home`/`End`, `skip-link`, `focus-visible`)
