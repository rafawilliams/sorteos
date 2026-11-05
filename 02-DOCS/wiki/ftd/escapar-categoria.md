---
author: Rafael Williams
branch: fix/escapar-categoria
status: in-progress
---
# Escapar la categoría (y lo que va con ella) al pintar HTML

## Intent
El revisor de seguridad del PR #31 vio que la categoría entra en `innerHTML` sin `esc()`. Si la API devolviera una categoría con HTML, como `"><img src=x onerror=…>`, la sincronización la guardaría y el navegador la ejecutaría. Ya existía antes del PR #31.

La búsqueda en `static/app.js` encontró 6 sitios: los 2 del revisor (177 y 195) y 4 más (195 en el atributo `class`, 359, 1121 y 1214). En el 359 sale también el método sin escapar, y en el 1214 la fecha y los premios.

## Scope
- In (`static/app.js`):
  - `esc()` en cada categoría, fecha, premio y método pintados con `innerHTML` en esos sitios;
  - el atributo `class` usa `catClase()`, que deja solo `[a-z0-9_-]`.
- Out:
  - validar la categoría en la sincronización;
  - la exportación CSV (inyección de fórmulas), que es otro tipo de riesgo;
  - el resto de los `innerHTML` con valores que no vienen de los datos.

## Checklist
- [x] Los 6 sitios escapados — prueba: `grep` solo deja el CSV (fuera del alcance) y la etiqueta de Chart.js (se dibuja en canvas, no es HTML).
- [x] Con una categoría maliciosa inyectada, ningún `<img>` aparece y el texto se ve literal — prueba: navegador (ver Evidence), rojo con el `app.js` de main.
- [x] La página normal se ve igual — prueba: navegador, `cat-pill cat-miercolito | Miercolito`, `cat-dominical | Dominical`, `cat-gordito | Gordito del Zodiaco`.
- [x] `node --check` y la suite completa en verde — prueba: node OK, `250 passed`.
- [ ] `rsc risk` y un revisor si tier ≥ 1.

## Evidence
- Categoría inyectada en `allSorteos`: `"><img src=x onerror="window.__xss=1">`; después, `renderSorteos()` y `renderStatCounters()`.
  - Con el arreglo: 0 `<img>`, `__xss = 0`; la etiqueta se ve literal y la clase queda `cat-pill cat-imgsrcxonerrorwindow__xss1`.
  - Con el `app.js` de main: 3 `<img>`, `__xss = 1` (el `onerror` se ejecuta).
- `rsc risk --base origin/main` → tier 1, 1 revisor.

## Next
Revisor de seguridad (tier 1).
