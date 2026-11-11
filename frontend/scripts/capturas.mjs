#!/usr/bin/env node
// Captura las 14 pestañas en tema oscuro y claro para comparar la interfaz antes y después
// de cada etapa de la migración a React (spec frontend-react, criterio AC1).
//
// Uso:
//   node frontend/scripts/capturas.mjs --salida <carpeta> [--url http://127.0.0.1:5001]
//        [--sorteos 600] [--solo gaps,seguimiento] [--temas oscuro,claro]
//
// Deja un PNG por pestaña y tema con el nombre `<pestaña>-<tema>.png`. Ver README.md de esta
// carpeta: el servidor debe correr contra una base sembrada aparte, nunca contra la real.
// Antes de capturar se comprueba que el servidor sirve exactamente `--sorteos` sorteos (600, los de
// `tests/seed_db.py`); si sirve otra cantidad, el script se niega a seguir.

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
  const opciones = { url: 'http://127.0.0.1:5001', salida: null, solo: null, temas: null, sorteos: '600' }
  for (let i = 0; i < argv.length; i += 1) {
    const clave = argv[i]
    const valor = argv[i + 1]
    if (!clave.startsWith('--')) throw new Error(`Argumento inesperado: ${clave}`)
    const nombre = clave.slice(2)
    if (!Object.hasOwn(opciones, nombre)) throw new Error(`Opción desconocida: ${clave}`)
    if (valor === undefined || valor.startsWith('--')) throw new Error(`Falta el valor de ${clave}`)
    opciones[nombre] = valor
    i += 1
  }
  if (!opciones.salida) throw new Error('Falta --salida <carpeta>')
  if (!/^[1-9]\d*$/.test(opciones.sorteos)) throw new Error(`Valor no válido para --sorteos: ${opciones.sorteos}`)
  const solo = opciones.solo ? opciones.solo.split(',') : PESTAÑAS
  for (const p of solo) if (!PESTAÑAS.includes(p)) throw new Error(`Pestaña desconocida: ${p}`)
  const temas = opciones.temas ? opciones.temas.split(',') : Object.keys(TEMAS)
  for (const t of temas) if (!Object.hasOwn(TEMAS, t)) throw new Error(`Tema desconocido: ${t}`)
  return {
    url: opciones.url.replace(/\/$/, ''),
    salida: resolve(opciones.salida),
    pestañas: solo,
    temas,
    sorteos: Number(opciones.sorteos),
  }
}

// Seguro contra el error de capturar la base real: el servidor debe servir justo los sorteos sembrados.
export async function comprobarBase(url, esperados, fetchFn = fetch) {
  let total
  try {
    // Con un tiempo límite: si algo ocupa el puerto y no responde, falla pronto en vez de colgarse.
    const respuesta = await fetchFn(`${url}/api/sorteos?page=1&per_page=1`, { signal: AbortSignal.timeout(10_000) })
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`)
    total = (await respuesta.json()).total
  } catch (error) {
    throw new Error(`No se pudo comprobar la base del servidor en ${url}: ${error.message}`)
  }
  if (!Number.isInteger(total)) {
    throw new Error(`No se pudo comprobar la base del servidor en ${url}: respuesta inesperada (no trae el total de sorteos). ¿Es la aplicación correcta?`)
  }
  if (total !== esperados) {
    throw new Error(
      `El servidor de ${url} sirve ${total} sorteos y se esperaban ${esperados} (la base sembrada). `
      + 'Parece que no es la base de capturas: revisa frontend/scripts/README.md antes de capturar.',
    )
  }
  return total
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

// Sin animaciones ni transiciones. Las tarjetas `.reveal` nacen con opacity:0 y solo se ven cuando un
// IntersectionObserver las ve entrar en pantalla; la captura no hace scroll, así que se fuerzan visibles.
export const CSS_CAPTURA = [
  '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
  '.reveal{opacity:1!important;transform:none!important}',
].join('')

async function esperarCarga(page) {
  await page.waitForSelector('#content', { state: 'visible', timeout: ESPERA_MAXIMA_MS })
  // Hasta que no queden esqueletos ni cargadores visibles en la pestaña activa, los datos no llegaron.
  await page.waitForFunction(
    // Solo cuentan los visibles: algunas pestañas dejan su cargador en el DOM con display:none.
    () => ![...document.querySelectorAll('#content .skeleton, #content .section.active .loader-wrap')].some((e) => e.offsetParent !== null),
    null,
    { timeout: ESPERA_MAXIMA_MS },
  )
  await page.evaluate(() => document.fonts.ready)
}

// Falla en voz alta si alguna tarjeta de la pestaña sigue transparente: saldría en blanco en el PNG.
async function comprobarTarjetasVisibles(page, pestaña) {
  await page.waitForFunction(
    (p) => [...document.querySelectorAll(`#sec-${p} .reveal`)].every((e) => getComputedStyle(e).opacity === '1'),
    pestaña,
    { timeout: 10_000 },
  ).catch(() => {
    throw new Error(`La pestaña ${pestaña} tiene tarjetas .reveal transparentes: la captura saldría incompleta`)
  })
}

// `dependencias` solo existe para las pruebas: permite comprobar que la guarda va antes de crear la
// carpeta o lanzar el navegador sin necesitar un servidor ni Chromium.
export async function capturar({ url, salida, pestañas, temas, sorteos }, { fetchFn = fetch, motor = chromium } = {}) {
  await comprobarBase(url, sorteos, fetchFn)
  mkdirSync(salida, { recursive: true })
  const navegador = await motor.launch()
  const hechas = []
  try {
    for (const tema of temas) {
      const contexto = await navegador.newContext({ viewport: { width: 1280, height: 800 }, locale: 'es-PA', reducedMotion: 'reduce' })
      await contexto.addInitScript(SIN_ANIMACION_CHART)
      await contexto.addInitScript((valor) => localStorage.setItem('theme', valor), TEMAS[tema])
      const page = await contexto.newPage()
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      await page.addStyleTag({ content: CSS_CAPTURA })
      await esperarCarga(page)
      for (const pestaña of pestañas) {
        await page.click(`#navTabs [data-tab="${pestaña}"]`)
        await page.waitForFunction(
          (p) => document.querySelector(`#sec-${p}`)?.classList.contains('active'),
          pestaña,
          { timeout: 10_000 },
        )
        await esperarCarga(page)
        await comprobarTarjetasVisibles(page, pestaña)
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
