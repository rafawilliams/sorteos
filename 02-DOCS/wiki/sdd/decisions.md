# SDD decisions (append-only)

## 2026-10-31 — seguimiento-recomendaciones: alcance
- Objeción planteada: los sorteos son independientes y el backtest da ML y estadístico al nivel del azar; comparar no mejora la predicción.
- Decisión del dueño: marcador + ponderación de métodos (no reentrenar con errores).
- Se registra: top-5 por categoría y 10 terminaciones, por método (ML, estadístico, combinada). Decena fuera.
- Registro automático: el primero calculado tras el último sorteo de la categoría, congelado.
- Acierto de número: exacto en cualquier premio de 4 cifras.
- Ponderación: «Combinada» nueva, por media de dígitos en su posición en los últimos 20 sorteos comparados; 50/50 con menos de 10.
- 2026-10-31 — clarify: pesos proporcionales; azar teórico y «próximo sorteo» confirmados; rama feat/seguimiento; autopilot.

## 2026-11-01 — constitution: ratificación v1.0.0
- Opciones de barra de calidad: (1) mantener `pytest -W error::SyntaxWarning` + `pip-audit` + `node --check`; (2) añadir Ruff; (3) añadir Ruff + mypy. Elegida la opción 1 para reflejar el gate actual de CI sin añadir dependencias nuevas.
- Contradicción resuelta en §4 Branching: el borrador de onboarding indicaba `--workflow main`, pero el repositorio trabaja con `main` protegido y PRs (#1–#14). Se ratifica rama dedicada + Pull Request con CI en verde.
- Ratificada `02-DOCS/wiki/sdd/constitution.md` en versión `v1.0.0` (16 principios numerados y verificables + Definition of Done).
