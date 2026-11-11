#!/usr/bin/env node
// Captura las 14 pestañas en tema oscuro y claro para comparar la interfaz antes y después
// de cada etapa de la migración a React (spec frontend-react, criterio AC1).
//
// Uso:
//   node frontend/scripts/capturas.mjs --salida <carpeta> [--url http://127.0.0.1:5000]
//        [--solo gaps,seguimiento] [--temas oscuro,claro]
//
// Deja un PNG por pestaña y tema con el nombre `<pestaña>-<tema>.png`. Ver README.md de esta
// carpeta: el servidor debe correr contra una base sembrada aparte, nunca contra la real.

import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

export const PESTAÑAS = [
  'predicciones', 'decenas', 'terminaciones', 'resultados', 'estadisticas', 'tendencias', 'analisis',
  'comparador', 'gaps', 'simulador', 'favoritos', 'mensual', 'precision', 'seguimiento',
]
export const TEMAS = { oscuro: 'dark', claro: 'light' }

const ESPERA_MAXIMA_MS = 300_000 // la primera carga de /api/stats entrena el modelo (50-100 s)

export function leerArgumentos(argv) {
  const opciones = { url: 'http://127.0.0.1:5000', salida: null, solo: null, temas: null }
  for (let i = 0; i < argv.length; i += 1) {
    const clave = argv[i]
    const valor = argv[i + 1]
    if (!clave.startsWith('--')) throw new Error(`Argumento inesperado: ${clave}`)
    const nombre = clave.slice(2)
    if (!(nombre in opciones)) throw new Error(`Opción desconocida: ${clave}`)
    if (valor === undefined || valor.startsWith('--')) throw new Error(`Falta el valor de ${clave}`)
    opciones[nombre] = valor
    i += 1
  }
  if (!opciones.salida) throw new Error('Falta --salida <carpeta>')
  const solo = opciones.solo ? opciones.solo.split(',') : PESTAÑAS
  for (const p of solo) if (!PESTAÑAS.includes(p)) throw new Error(`Pestaña desconocida: ${p}`)
  const temas = opciones.temas ? opciones.temas.split(',') : Object.keys(TEMAS)
  for (const t of temas) if (!(t in TEMAS)) throw new Error(`Tema desconocido: ${t}`)
  return { url: opciones.url.replace(/\/$/, ''), salida: resolve(opciones.salida), pestañas: solo, temas }
}

// Los gráficos de Chart.js animan en el canvas: se desactiva la animación en cuanto carga la librería.
const SIN_ANIMACION_CHART = `
  (() => {
    let valor
    Object.defineProperty(window, 'Chart', {
      configurable: true,
      get() { return valor },
      set(v) { valor = v; if (v && v.defaults) v.defaults.animation = false },
    })
  })()
`
const SIN_ANIMACION_CSS = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'

async function esperarCarga(page) {
  await page.waitForSelector('#content', { state: 'visible', timeout: ESPERA_MAXIMA_MS })
  // Hasta que no queden esqueletos ni cargadores de la pestaña activa, los datos no llegaron.
  await page.waitForFunction(
    () => !document.querySelector('#content .skeleton, #content .section.active .loader-wrap'),
    null,
    { timeout: ESPERA_MAXIMA_MS },
  )
  await page.evaluate(() => document.fonts.ready)
}

export async function capturar({ url, salida, pestañas, temas }) {
  mkdirSync(salida, { recursive: true })
  const navegador = await chromium.launch()
  const hechas = []
  try {
    for (const tema of temas) {
      const contexto = await navegador.newContext({ viewport: { width: 1280, height: 800 }, locale: 'es-PA', reducedMotion: 'reduce' })
      await contexto.addInitScript(SIN_ANIMACION_CHART)
      await contexto.addInitScript((valor) => localStorage.setItem('theme', valor), TEMAS[tema])
      const page = await contexto.newPage()
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      await page.addStyleTag({ content: SIN_ANIMACION_CSS })
      await esperarCarga(page)
      for (const pestaña of pestañas) {
        await page.click(`#navTabs [data-tab="${pestaña}"]`)
        await page.waitForFunction(
          (p) => document.querySelector(`#sec-${p}`)?.classList.contains('active'),
          pestaña,
          { timeout: 10_000 },
        )
        await esperarCarga(page)
        const archivo = join(salida, `${pestaña}-${tema}.png`)
        await page.locator(`#sec-${pestaña}`).screenshot({ path: archivo, animations: 'disabled' })
        hechas.push(archivo)
        console.log(`✔ ${pestaña}-${tema}.png`)
      }
      await contexto.close()
    }
  } finally {
    await navegador.close()
  }
  return hechas
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const opciones = leerArgumentos(process.argv.slice(2))
    const hechas = await capturar(opciones)
    console.log(`\n${hechas.length} capturas en ${opciones.salida}`)
  } catch (error) {
    console.error(`Error: ${error.message}`)
    process.exit(1)
  }
}
