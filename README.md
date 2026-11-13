# Lotería de Panamá — Estadísticas y Predicciones

[![Tests](https://github.com/rafawilliams/sorteos/actions/workflows/tests.yml/badge.svg)](https://github.com/rafawilliams/sorteos/actions/workflows/tests.yml)

Aplicación web para analizar los resultados históricos de la Lotería Nacional de Panamá y generar números recomendados con estadística y machine learning.

> **Aviso:** la lotería es un juego de azar. Las "predicciones" de esta app son un ejercicio de análisis de datos, no una garantía de acierto. La sección **Precisión** compara cada método con el azar sobre sorteos pasados.

## Funcionalidades

- **Resultados**: sorteos desde 1919, con filtros por categoría, búsqueda, rango de fechas, paginación y exportación a CSV.
- **Predicciones**: números recomendados para 1er, 2do y 3er premio, en modo **Estadístico** (frecuencias ponderadas por recencia + Monte Carlo) o **ML** (un `HistGradientBoostingClassifier` por posición de dígito).
- **Decenas** y **Terminaciones** (últimos 2 dígitos, 00–99): mapas de calor, tendencias y recomendaciones.
- **Estadísticas, Tendencias y Análisis**: frecuencias de dígitos, números calientes y fríos, gaps, comparación entre números y simulador histórico.
- **Precisión**: backtesting de ML frente a Estadístico (Top-1 y Top-3 por posición).
- **Seguimiento**: registro congelado de recomendaciones antes de cada sorteo, comparación frente al resultado real, método «Combinada» y marcador frente al azar.
- Tema claro y oscuro, diseño responsive, navegación por teclado y roles ARIA.

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Python 3.13, Flask, Flask-Limiter |
| Datos | MariaDB, SQLAlchemy 2.0 |
| ML | scikit-learn, pandas, numpy, joblib |
| Frontend | React 19 + TypeScript (Vite, Vitest), Chart.js |

## Requisitos

- Python 3.13
- Node.js 22.x (versión exacta en `.nvmrc`) para construir la interfaz
- Un servidor MariaDB con una base de datos `sorteos`

## Instalación

```bash
git clone https://github.com/rafawilliams/sorteos.git
cd sorteos

python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux / macOS

pip install -r requirements-dev.txt

npm --prefix frontend ci          # dependencias del frontend
npm --prefix frontend run build   # genera static/dist/app.js
```

> Toda la interfaz es React: la página que sirve Flask solo trae un `<div id="root">` y el script `static/dist/app.js`, que está en `.gitignore`. Sin ese build la página muestra el comando para construirlo; vuelve a ejecutar el `build` tras cada `git pull` que toque `frontend/`.

## Configuración

Copia `.env.example` a `.env` y completa los valores:

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Conexión a MariaDB, p. ej. `mariadb+mariadbconnector://user:password@127.0.0.1:3306/sorteos` |
| `LOTERIA_API_USER` | Sí | Usuario de la API de `api.loteriapanama.net` |
| `LOTERIA_API_PASSWORD` | Sí | Contraseña de la API |
| `ACTUALIZAR_TOKEN` | No | Token secreto para `POST /api/actualizar`. Si está vacío, la actualización desde la web queda deshabilitada. |
| `FLASK_DEBUG` | No | `1` activa el modo debug (solo en desarrollo local). Apagado por defecto. |

Para generar un token:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

`.env` está en `.gitignore`: nunca lo subas al repositorio.

## Uso

```bash
python app.py            # servidor en http://127.0.0.1:5000
python actualizar_db.py  # sincroniza desde el mes del último sorteo guardado hasta hoy
python actualizar_db.py --desde 2026-01  # o desde un mes concreto (YYYY-MM)
```

La primera llamada a `/api/stats` entrena el modelo ML si no está en caché (`models/predictor.joblib`), lo que tarda entre 50 y 100 segundos. Las siguientes tardan menos de 1 segundo.

El botón **↻ Actualizar datos** de la web pide el `ACTUALIZAR_TOKEN` la primera vez y lo guarda solo durante la sesión de la pestaña.

## API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/sorteos` | Sorteos paginados. Parámetros: `page`, `per_page`, `cat`, `q`, `from`, `to`, `all` |
| GET | `/api/stats` | Estadísticas completas y predicciones (caché de 5 min) |
| GET | `/api/gaps` | Sorteos transcurridos desde la última aparición de cada número o terminación |
| GET | `/api/comparar?numeros=0042,1234` | Comparación de varios números |
| GET | `/api/simulador?numero=0042` | Cuántas veces habría ganado un número. Parámetros: `from`, `to`, `cat` |
| GET | `/api/backtesting?last_n=500` | Precisión de ML frente a Estadístico |
| GET | `/api/seguimiento` | Recomendaciones congeladas frente a resultados reales y marcador frente al azar |
| POST | `/api/actualizar` | Sincroniza sorteos y reentrena el modelo. Requiere la cabecera `X-Update-Token` |

Todas las rutas tienen límite de peticiones por IP: 120/min por defecto, `/api/stats` 10/min, `/api/backtesting` 5/min y `/api/actualizar` 2/min.

## Tests

```bash
pytest                         # suite completa del backend
pip-audit -r requirements.txt  # vulnerabilidades conocidas en dependencias

npm --prefix frontend run typecheck       # tipos de TypeScript
npm --prefix frontend test -- --run       # pruebas del frontend (Vitest)
npm --prefix frontend audit --audit-level=high
```

GitHub Actions ejecuta ambos conjuntos en cada Pull Request: el backend contra un MariaDB con sorteos sintéticos (`tests/seed_db.py`) y el frontend con typecheck, pruebas, build y `npm audit`.

## Estructura

```
app.py            Rutas Flask, caché y acceso a BD
estadisticas.py   Cálculos estadísticos puros, decenas, terminaciones, gaps, comparador y simulador
ml_model.py       Modelo ML: features, entrenamiento, predicción y backtesting
seguimiento.py    Registro congelado de recomendaciones y comparación con resultados reales
base.py           Configuración (.env) y conexión SQLAlchemy
loteria.py        Modelo ORM de la tabla sorteos
actualizar_db.py  Sincronización desde api.loteriapanama.net
frontend/         Interfaz React + TypeScript: shell/ (armazón, barra de pestañas, menú, tema, botón de actualizar), tabs/ (una por sección), components/, store/ (ReactStore y contrato), lib/ y api/ (cliente tipado)
static/           style.css y dist/ (build de React, no versionado)
templates/        index.html
tests/            Tests con pytest
```

## Contribuir

Cada mejora va en su propia rama (`feat/...`, `fix/...`, `docs/...`, `chore/...`) y entra en `main` mediante un Pull Request.

## Licencia

Distribuido bajo la licencia [MIT](LICENSE).
