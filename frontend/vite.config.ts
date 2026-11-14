/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dónde corre Flask durante el desarrollo (`npm run dev`). Por defecto es `python app.py`, que escucha en el 5000 y suele
// hablar con la base real: para probar contra una base sembrada arranca Flask en otro puerto y pasa `FLASK_URL`.
const FLASK_URL = process.env.FLASK_URL ?? 'http://127.0.0.1:5000'

// La interfaz se construye en `static/dist/` con nombres fijos (sin hash) para que
// la plantilla de Flask la cargue siempre desde la misma ruta. No se commitea.
export default defineConfig({
  plugins: [react()],
  // Servidor de desarrollo con recarga en caliente: sirve `frontend/index.html` (la misma página que la plantilla de Flask) y
  // reenvía la API y los archivos estáticos (hoja de estilos, icono) a Flask. Solo es para desarrollar: la aplicación real
  // la sirve Flask con el build de `static/dist/`.
  server: {
    proxy: {
      '/api': FLASK_URL,
      '/static': FLASK_URL,
    },
  },
  build: {
    outDir: '../static/dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'src/main.tsx',
      output: {
        entryFileNames: 'app.js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: 'app[extname]',
      },
    },
  },
  test: {
    environment: 'jsdom',
    // Las pruebas del armazón montan las 14 secciones en jsdom: bajo carga rozaban los 5 s por defecto.
    testTimeout: 15000,
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    // Zona horaria fija: la lotería es de Panamá (UTC-5). Sin esto las pruebas de fechas dependen de la zona del CI.
    env: { TZ: 'America/Panama' },
  },
})
