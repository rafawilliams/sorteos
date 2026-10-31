---
author: rafawilliams
branch: chore/actualizar-deps
status: in-progress
---
# Actualizar y fijar dependencias

## Intent
`pip-audit` reporta vulnerabilidades en `requests==2.31.0` (3, fix ≥2.33.0) y `mariadb==1.1.11` (PYSEC-2026-217, Connector/C). Varias dependencias no están fijadas, así que una instalación nueva puede romper.

## Scope
- In: `requests==2.34.2`, `mariadb==1.1.14`, fijar `Flask-Limiter`, `scikit-learn`, `joblib`, `numpy` a lo instalado; quitar `beautifulsoup4` (sin uso); `requirements-dev.txt` con `pytest` y `pip-audit`.
- Out: SQLAlchemy 2.x (cambio de API, tarea aparte), subir versiones mayores.

## Checklist
- [x] `pip-audit -r requirements.txt` sin vulnerabilidades de `requests` — prueba: salida del comando.
- [x] Todas las líneas de `requirements.txt` con `==` — prueba: grep.
- [x] `beautifulsoup4` no se importa en el proyecto — prueba: grep sin resultados.
- [x] Suite verde con las versiones nuevas — prueba: `pytest`.
- [x] La app arranca y `/api/sorteos` responde 200 — prueba: curl.

## Evidence
- `pip-audit` antes: 7 hallazgos (requests ×6, mariadb ×1). Después: 1 — `mariadb 1.1.14 PYSEC-2026-217`, sin versión que lo corrija.
  - No explotable aquí: requiere `escape_string()` manual + charset big5 + protocolo de texto; la app usa SQLAlchemy con parámetros.
- `grep -v "==" requirements.txt`: sin resultados. `grep bs4|BeautifulSoup`: sin resultados.
- `pytest`: `64 passed` con requests 2.34.2 y mariadb 1.1.14.
- Servidor real reiniciado: `GET /` 200, `GET /api/sorteos` 200 con datos de MariaDB (último sorteo 2026-10-30).

## Next
PR a main.
