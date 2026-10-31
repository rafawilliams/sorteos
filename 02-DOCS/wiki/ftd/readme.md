---
author: rafawilliams
branch: docs/readme
status: in-progress
---
# README del repositorio

## Intent
El repo es público y no tenía README: nadie sabía qué es ni cómo arrancarlo.

## Scope
- In: `README.md` en español (funcionalidades, stack, instalación, variables de `.env`, uso, API, tests, estructura, flujo de ramas) y aviso de que las predicciones no garantizan aciertos.
- Out: licencia (decisión del dueño), capturas de pantalla.

## Checklist
- [x] Datos del README contrastados con el código — prueba: rutas y límites con `grep @app.route|@limiter.limit`, Python `3.13.3`, sorteo más antiguo `1919-03-30` en la BD.
- [x] Variables de `.env` iguales a `.env.example` — prueba: DATABASE_URL, LOTERIA_API_USER, LOTERIA_API_PASSWORD, FLASK_DEBUG, ACTUALIZAR_TOKEN.

## Evidence
- Límites corregidos tras verificar: stats 10/min, backtesting 5/min, actualizar 2/min, resto 120/min.
- Hallazgo aparte: `actualizar_db.py` solo consulta 2026-02 y 2026-03 (meses fijos) → tarea propia.

## Next
PR a main.
