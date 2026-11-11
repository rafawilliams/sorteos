# Capturas de referencia (spec `frontend-react`, criterio AC1)

`capturas.mjs` saca una captura por pestaña y tema (14 × 2 = 28) para comparar la interfaz antes y
después de cada etapa de la migración. La comparación la hace el dueño a ojo.

## Regla de oro: nunca contra la base real

El servidor de capturas debe usar **otra base de datos**, sembrada con datos sintéticos fijos:

- `tests/seed_db.py` se niega a sembrar una tabla con datos, así que no puede tocar la base real.
- `/api/stats` guarda recomendaciones en la tabla `predicciones` al calcular; contra la base real
  eso ensuciaría tus datos.
- La base real cambia con cada sorteo nuevo: la referencia dejaría de ser comparable.

## Preparación (una sola vez)

1. Crea una base vacía en tu MariaDB local:

   ```sql
   CREATE DATABASE sorteos_capturas CHARACTER SET utf8mb4;
   ```

2. Siémbrala (la variable solo vale para ese comando; `.env` no se toca):

   ```bash
   DATABASE_URL="mariadb+mariadbconnector://USUARIO:CLAVE@127.0.0.1:3306/sorteos_capturas" \
     python tests/seed_db.py 600
   ```

3. Instala el navegador de Playwright:

   ```bash
   npm --prefix frontend ci
   npx --prefix frontend playwright install chromium
   ```

## Uso

1. Arranca el servidor contra esa base. Hazlo desde una copia limpia de la rama, sin un
   `models/predictor.joblib` entrenado con datos reales: la primera petición a `/api/stats`
   entrena el modelo con los datos sintéticos (50-100 s) y lo guarda ahí.

   ```bash
   DATABASE_URL="mariadb+mariadbconnector://USUARIO:CLAVE@127.0.0.1:3306/sorteos_capturas" python app.py
   ```

2. Saca las capturas:

   ```bash
   node frontend/scripts/capturas.mjs --salida <carpeta>
   node frontend/scripts/capturas.mjs --salida <carpeta> --solo gaps,seguimiento --temas oscuro
   ```

   Deja `<pestaña>-oscuro.png` y `<pestaña>-claro.png`. La referencia se guarda en
   `02-DOCS/attachments/react-baseline/` y cada etapa saca sus capturas con el mismo comando y la
   misma base.

## Qué hace el script para que sean comparables

- Ventana fija de 1280 × 800 y local `es-PA`.
- Desactiva las animaciones CSS y las de Chart.js (en cuanto carga la librería).
- Espera a que desaparezcan los esqueletos y los cargadores antes de capturar.
- Captura solo la sección de la pestaña activa, no la cabecera (que lleva la fecha de última
  actualización).
