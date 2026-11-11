/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// La interfaz se construye en `static/dist/` con nombres fijos (sin hash) para que
// la plantilla de Flask la cargue siempre desde la misma ruta. No se commitea.
export default defineConfig({
  plugins: [react()],
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
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    // Zona horaria fija: la lotería es de Panamá (UTC-5). Sin esto las pruebas de fechas dependen de la zona del CI.
    env: { TZ: 'America/Panama' },
  },
})
