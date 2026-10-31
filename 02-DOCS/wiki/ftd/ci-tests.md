---
author: rafawilliams
branch: ci/tests
status: in-progress
---
# CI: tests en cada PR con GitHub Actions

## Intent
Que ningún PR entre en `main` con tests rotos o dependencias vulnerables.

## Scope
- In: `.github/workflows/tests.yml` (PR y push a main): servicio MariaDB 11, Python 3.13, `tests/seed_db.py` con sorteos sintéticos deterministas, `pytest`, `pip-audit` (ignora PYSEC-2026-217, sin fix publicado). README con la insignia.
- Out: protección de rama obligatoria en GitHub (configuración del repo, decisión del dueño), despliegue.

## Checklist
- [x] `seed_db.py` se niega a sembrar una tabla con datos — prueba: ejecutarlo contra la BD local (que tiene datos).
- [x] Workflow verde en GitHub Actions — prueba: `gh run watch` / conclusión `success`.

## Evidence
- `seed_db.py` contra BD local: "La tabla sorteos ya tiene datos: no se siembra", exit 1; BD sigue con 9294 filas.
- Run 41197150506: success en 1m12s — `Sembrados 600 sorteos sintéticos`, `64 passed`, `No known vulnerabilities found, 1 ignored`. Aviso Node.js 20 deprecado.
- Subidas `checkout@v5` y `setup-python@v6`. Run 41197275671: success en 1m2s, `64 passed`, sin aviso de Node.js.

## Next
Merge a main. Opcional: exigir el check "test" en la protección de la rama main.
