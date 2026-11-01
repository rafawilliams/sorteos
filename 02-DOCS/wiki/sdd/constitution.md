---
type: constitution
title: sorteos — Constitution
description: Principios innegociables que obedecen todas las fases rsc-sdd.
tags: [sdd, constitution]
timestamp: 2026-11-01T12:16:00Z
topic: sdd
version: v1.0.0
---

# sorteos — Constitution

> Version: v1.0.0 · Ratified: 2026-11-01 · Last amended: 2026-11-01
> Los principios innegociables que obedecen todas las fases rsc-sdd.

## 1. Stack canon

1. **Runtime y lenguajes:** Python 3.13 en backend y JavaScript vanilla (ES6+) con CSS nativo en frontend, sin bundlers ni frameworks JS. Verificado en `.github/workflows/tests.yml`.
2. **Frameworks fijos:** Flask (API REST), SQLAlchemy + MariaDB 11 (persistencia), scikit-learn (`HistGradientBoostingClassifier` para ML) y Chart.js (visualización). Cambiar cualquiera de ellos requiere enmienda MAJOR.
3. **Dependencias:** todas las dependencias de producción y desarrollo se fijan con versión exacta (`==`) en `requirements.txt` y `requirements-dev.txt`.

## 2. Quality bar

4. **Suite de pruebas limpia:** todo cambio debe pasar `pytest -q -W error::SyntaxWarning` sin fallos ni warnings de sintaxis.
5. **Auditoría de dependencias:** `pip-audit -r requirements.txt --ignore-vuln PYSEC-2026-217` debe pasar sin vulnerabilidades en cada PR (`.github/workflows/tests.yml`).
6. **Validez de frontend:** cualquier cambio en `static/app.js` debe validar sintaxis con `node -e "new Function(require('fs').readFileSync('static/app.js','utf8'))"`.

## 3. Conventions

7. **Integridad de formato de premios:** la base de datos guarda los premios tal como los publica la fuente; `loteria.premio_en_formato` los normaliza al leer a su formato real (2, 4 o 5 cifras; vacío queda `""`). Prohibido aplicar `.zfill(4)` o `padStart(4)` ciego; las estadísticas y el ML de 4 cifras filtran con `len(p) == 4`.
8. **Contratos de API y errores:** fechas siempre en ISO 8601 (`YYYY-MM-DD`), respuestas serializadas con `_json_safe()`, y errores `5xx`/`4xx` nunca exponen trazas ni `str(e)` internos al cliente (detalles solo en el log del servidor).
9. **Mensajes de commit:** formato gitmoji al inicio (`✨`, `🐛`, `🔒`, `🧹`, `📝`, `👷`, `⬆️`) y descripción en español, validado por `gitmoji-guard`.

## 4. Branching & shipping

10. **Rama y Pull Request obligatorios:** todo cambio se desarrolla en una rama (`feat/*`, `fix/*`, `chore/*`, `docs/*`, `ci/*`) y entra a `main` mediante Pull Request con el workflow `Tests` en verde. Prohibido hacer push directo a `main`.
11. **Autoría humana en Git:** los commits y PRs llevan exclusivamente la autoría del dueño del repositorio. Prohibido añadir `Co-Authored-By` de IA o pies de «generated with».

## 5. Security & privacy floor

12. **Cero secretos en el repositorio:** credenciales (`DATABASE_URL`, `LOTERIA_API_USER`, `LOTERIA_API_PASSWORD`, `ACTUALIZAR_TOKEN`) viven únicamente en `.env` (ignorado por git) y se exigen con `base.require_env()` sin valores por defecto en el código.
13. **Superficie expuesta protegida:** `FLASK_DEBUG` está desactivado por defecto (`base.env_flag`) y `POST /api/actualizar` exige cabecera `X-Update-Token` validada con `hmac.compare_digest` (401 si no coincide, 503 si no está configurado).

## 6. UX / accessibility floor

14. **Accesibilidad e interfaz:** toda vista o pestaña interactiva mantiene roles ARIA (`tablist`, `tab`, `tabpanel`, `aria-selected`, `aria-live`), navegación completa por teclado (flechas, `Home`/`End`, `focus-visible`) y compatibilidad visual en modo oscuro y claro (`[data-theme="light"]` + `isLight()`).

## 7. Performance budgets

15. **Presupuesto de respuesta y caché:** los endpoints pesados (`/api/stats`, `/api/sorteos`, `/api/backtesting`) mantienen caché en memoria con TTL de 5 minutos, y el modelo ML se sirve desde `models/predictor.joblib` para responder `/api/stats` en `< 1 s` con modelo entrenado y caché caliente.

## 8. Knowledge & decisions

16. **Registro de decisiones:** toda decisión significativa de diseño o alcance se añade en modo append-only a `02-DOCS/wiki/sdd/decisions.md` (o `02-DOCS/wiki/harness/decisions.md`) con fecha, opciones y motivo, manteniendo el puntero read-first en `CLAUDE.md`.

## Definition of Done (the merge bar `verify` runs against)

Un cambio se fusiona solo cuando TODO se cumple:

- [ ] `pytest -q -W error::SyntaxWarning` en verde (principio 4).
- [ ] `pip-audit` sin vulnerabilidades nuevas y sintaxis JS válida si aplica (principios 5–6).
- [ ] Formatos de premios (2/4/5 cifras), fechas ISO y errores opacos respetados (principios 7–8).
- [ ] En rama dedicada, con commits gitmoji, autoría humana y PR en verde (principios 9–11).
- [ ] Sin secretos en código ni regresiones en `X-Update-Token` / `FLASK_DEBUG` (principios 12–13).
- [ ] Roles ARIA, teclado y temas claro/oscuro preservados si hay cambios UI (principio 14).
- [ ] Caché de 5 min y persistencia de `predictor.joblib` intactos (principio 15).
- [ ] Decisiones y documentos SDD/FTD actualizados en `02-DOCS/wiki/` (principio 16).

## Amendment log (append-only)

| Date | Version | Change | Why |
|------|---------|--------|-----|
| 2026-10-31 | draft | Draft generated by `rsc onboard`. | The SDD floor needs a constitution; ratification is the `constitution` phase's. |
| 2026-11-01 | v1.0.0 | Ratified initial constitution (16 principles + DoD); fixed workflow from `main` to branch + PR. | Formalizar las reglas reales tras los PRs #1–#14. |
