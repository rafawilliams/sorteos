---
author: rafawilliams
branch: chore/sqlalchemy-2
status: done
---
# Actualizar SQLAlchemy 1.4 a 2.x

## Intent
`SQLAlchemy==1.4.41` emite `DeprecationWarning: datetime.datetime.utcfromtimestamp() is deprecated` en Python 3.13 y usa `sqlalchemy.ext.declarative.declarative_base` (movido a `sqlalchemy.orm.declarative_base` en 2.0). Actualizar a `SQLAlchemy 2.x` elimina el warning y deja la capa ORM al día.

## Scope
- In: actualizar y fijar `SQLAlchemy==2.0.55` en `requirements.txt`; cambiar `from sqlalchemy.ext.declarative import declarative_base` por `from sqlalchemy.orm import declarative_base` en `base.py`; cerrar descriptores de archivo y hacer `engine.dispose()` en fixtures de tests; verificar cero warnings con `pytest -W error` y conexión real a MariaDB.
- Out: reescribir las consultas `session.query(...)` a `select(...)` (la API `Session.query` sigue soportada en 2.0 sin deprecación).

## Checklist
- [x] `base.py` importa `declarative_base` desde `sqlalchemy.orm` — prueba: importación y tests sin `MovedIn20Warning`.
- [x] `requirements.txt` fija `SQLAlchemy==2.0.55` — prueba: `pip show SQLAlchemy` (`2.0.55`) y `pip-audit -r requirements.txt --ignore-vuln PYSEC-2026-217` (`No known vulnerabilities found, 1 ignored`).
- [x] Suite completa en verde y con **0 warnings** (`pytest -q -W error`) — prueba: `153 passed in 4.87s`.
- [x] Lectura y resumen contra MariaDB real (`get_sorteos()`, `get_last_update()`, `seguimiento.resumen()`) — prueba: `SQLAlchemy: 2.0.55 sorteos: 9296 last_update: 2026-10-30 pendientes: 4`.

## Evidence
- `pytest -q -W error`: `153 passed in 4.87s` (0 `DeprecationWarning`, 0 `MovedIn20Warning`, 0 `ResourceWarning`).
- `pip-audit -r requirements.txt --ignore-vuln PYSEC-2026-217`: `No known vulnerabilities found, 1 ignored`.
- MariaDB real: `get_sorteos()` devuelve 9296 sorteos, `get_last_update()` devuelve `2026-10-30`, `seguimiento.resumen()` devuelve las 4 categorías pendientes.

## Next
PR a main (2026-11-01).
