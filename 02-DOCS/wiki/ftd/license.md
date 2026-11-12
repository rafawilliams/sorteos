---
author: rafawilliams
branch: docs/license
status: done
---
# Añadir licencia MIT y actualizar README

## Intent
El repositorio es público pero carecía de archivo `LICENSE` (decisión aplazada en `docs/readme` y `chore/limpieza`). Además, `README.md` aún mencionaba `SQLAlchemy 1.4` y no listaba `seguimiento.py` ni `GET /api/seguimiento`.

## Scope
- In: crear `LICENSE` con licencia MIT (`Copyright (c) 2026 Rafael Williams`); añadir sección `## Licencia` en `README.md` y poner al día la versión de SQLAlchemy (`2.0`) y las referencias a `Seguimiento` (`GET /api/seguimiento`, `seguimiento.py`).
- Out: código de aplicación.

## Checklist
- [x] `LICENSE` creado en la raíz con texto estándar MIT — prueba: lectura del archivo (21 líneas).
- [x] `README.md` incluye `## Licencia`, `SQLAlchemy 2.0`, `GET /api/seguimiento` y `seguimiento.py` — prueba: `Select-String` en `README.md`.
- [x] Suite de pruebas en verde (`pytest -q -W error`) — prueba: `153 passed` sin warnings.

## Evidence
- `LICENSE`: texto MIT con `Copyright (c) 2026 Rafael Williams`.
- `README.md`: añadida pestaña/funcionalidad `Seguimiento`, `SQLAlchemy 2.0`, `GET /api/seguimiento`, `seguimiento.py` y sección `## Licencia`.
- `pytest -q -W error`: `153 passed` con 0 warnings.

## Next
PR a main (2026-11-01).
