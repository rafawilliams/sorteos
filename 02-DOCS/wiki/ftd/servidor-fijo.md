---
author: rafawilliams
branch: feat/servidor-fijo
status: done
merged: 2026-11-14
pr: #68
---
# Servidor fijo: siempre arriba, solo en este equipo

## Intent
`python app.py` es el servidor de desarrollo de Flask: con `FLASK_DEBUG=1` arranca el depurador de Werkzeug (permite ejecutar código) y muere al cerrar la terminal. El dueño quiere la aplicación siempre arriba y accesible solo desde su equipo (decisión del 2026-11-14: «solo local en este equipo»). Windows 11 y MariaDB ya es un servicio automático; faltaba el servidor y quien lo reinicie.

## Scope
- In: `servir.py` (waitress, `127.0.0.1`, puerto 5000 o `LOTERIA_PUERTO`, `FLASK_DEBUG` apagado antes de importar la app); `waitress==3.0.2` en `requirements.txt`; `scripts/tarea_servidor.ps1` (registra o quita la tarea «Loteria-Servidor» del Programador de tareas: al iniciar sesión, reinicio cada minuto si falla, log en `logs/servidor.log`); `logs/` en `.gitignore`; comandos en `CLAUDE.md`.
- Out: NSSM o servicio de Windows; acceso desde otros equipos; HTTPS o proxy inverso; cambiar `app.py` (sigue sirviendo el modo desarrollo); registrar la tarea en la máquina del dueño (paso aparte, después de fusionar).

## Checklist
- [x] El host es `127.0.0.1` y no se puede cambiar por entorno — prueba: `tests/test_servir.py`.
- [x] El puerto es 5000, se cambia con `LOTERIA_PUERTO` y un valor inválido falla con mensaje claro (6 casos) — prueba: `tests/test_servir.py`.
- [x] `main` apaga `FLASK_DEBUG` antes de importar la app y llama a `waitress.serve` con la app, host y puerto — prueba: `tests/test_servir.py` (rojas antes: no existía `servir`).
- [x] Servidor real: sirve la API y escucha solo en `127.0.0.1` — prueba: `servir.py` en el puerto 5001 con la base sembrada, `/api/sorteos` → `total` 600, `netstat` → `127.0.0.1:5001 LISTENING` (y ninguna escucha en `0.0.0.0`).
- [x] `pytest -q -W error::SyntaxWarning` y `pip-audit` en verde — ver Evidence.
- [x] El script de la tarea tiene sintaxis válida — prueba: analizador de PowerShell (`Parser.ParseFile`, 0 errores).
- [ ] La tarea se registra, arranca el servidor y lo reinicia tras un fallo — **no ejecutado**: cambia el sistema del dueño; se hace tras fusionar y con su visto bueno.

## Evidence
- `pytest -q -W error::SyntaxWarning` (base sembrada) → 590 passed, 1 skipped. `pip-audit -r requirements.txt --ignore-vuln PYSEC-2026-217` → sin vulnerabilidades conocidas (1 ignorada, la de siempre).
- `rsc risk` → ver el PR.
- No se probó el script de la tarea con `Register-ScheduledTask`: solo el análisis de sintaxis.

## Next
Fusionado en main el 2026-11-14 (470bf98).
