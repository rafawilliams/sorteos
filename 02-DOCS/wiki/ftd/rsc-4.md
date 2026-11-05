---
author: rafawilliams
branch: chore/rsc-4
status: done
---
# Actualizar rsc de 3.6.0 a 4.0.5

## Intent
Subir el harness `rsc` a la versión mayor 4.0.5. Trae el método `asdd`, que reemplaza a `sdd` y añade una revisión en cada tarea escalada por `rsc risk`. Además, la v4 trata `.rsc/` y los enlaces de skills de `.claude/skills/*` como estado local de la máquina, no como contenido del repo.

## Scope
- In: `npx @ericrisco/rsc@latest`; `.gitignore`, `.rsc.json`, `.claude/settings.json`, `.claude/rsc-bootstrap.mjs`; dejar de versionar `.rsc/` y las skills que gestiona rsc (`git rm --cached`; los archivos siguen en el disco).
- Out: código de la aplicación. Las skills que no gestiona rsc (brainstorming, systematic-debugging, etc.) siguen versionadas.

## Checklist
- [x] `rsc` en 4.0.5 — prueba: `npx @ericrisco/rsc --version` → `rsc 4.0.5 / installed in this project: 4.0.5`.
- [x] Harness sano tras el cambio — prueba: `npx @ericrisco/rsc doctor` → `"healthy": true`.
- [x] Archivos ignorados fuera del índice y aún en el disco — prueba: `git ls-files -ci --exclude-standard` vacío; `.rsc/` y `.claude/skills/asdd` existen.
- [x] Suite en verde — prueba: `pytest -q` → `164 passed`.

## Evidence
- Diff contra main: 490 archivos fuera del índice, 4 modificados y 2 añadidos (esta ficha y la spec) = 496.
- Revisión de cierre: panel de 3 refutadores (correctness, security, tests), sin hallazgos (2026-11-05).
- Para un clon nuevo: ejecutar `npx @ericrisco/rsc sync` para reconstruir `.rsc/` y las skills.

## Next
PR a main (2026-11-05). Spec: [rsc-4](../sdd/specs/rsc-4.md).
