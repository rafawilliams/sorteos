---
author: rafawilliams
branch: fix/pool-conexiones
status: done
merged: 2026-11-09
pr: #35
---
# Conexiones viejas del pool a MariaDB

## Intent
La primera petición tras un rato sin tráfico devolvía 500 (`mariadb.InterfaceError`: se perdió la conexión) y las siguientes funcionaban. El pool de SQLAlchemy reutilizaba una conexión que MariaDB ya había cerrado por inactividad. Comprobar la conexión antes de usarla y renovarla cada hora.

## Scope
- In: `create_engine(..., pool_pre_ping=True, pool_recycle=3600)` en `base.py`.
- Out: reintentos de consultas, cambiar `wait_timeout` del servidor MariaDB, el primer fallo observado justo tras arrancar (con el pool vacío; sin causa conocida).

## Checklist
- [x] El engine tiene `pre_ping` y `recycle` ≤ 3600 — prueba: `tests/test_config.py::TestPoolConexiones` (fallaba antes).
- [x] Una conexión cerrada por el servidor ya no rompe la petición — prueba: script con el engine real de `base.py` y `wait_timeout=2` contra MariaDB real.
- [x] Suite verde — prueba: `pytest`.

## Evidence
- Antes: `/api/sorteos` tres veces seguidas tras horas parado → 500, 200, 200. Script aislado sin opciones → `InterfaceError`; con `pool_pre_ping=True` o `pool_recycle` corto → OK.
- Tests nuevos: 2 fallaban antes del cambio (`_recycle == -1`, sin pre-ping).
- Después: `pytest` → `263 passed`. Engine real de `base.py` tras cerrar el servidor la conexión → consulta OK (9296 sorteos). Servidor en `127.0.0.1:5000` recargado con el cambio: `/api/sorteos` → 200, 200.

## Next
Fusionado en main el 2026-11-09 (846631c).
