/**
 * Arnés de pruebas: levanta `static/app.js` de verdad dentro de jsdom, con la plantilla real y `fetch` apuntando a los
 * fixtures. Cada llamada a `levantarLegacy` deja una instancia nueva y aislada (DOM nuevo, estado `let` nuevo).
 *
 * Límites conocidos: jsdom no ejecuta los `onclick="…"` en línea de la plantilla, así que las pruebas llaman a
 * `toggleTheme()` / `toggleML()` (las mismas funciones que invoca el atributo); Chart.js, IntersectionObserver y el
 * `<canvas>` son dobles mínimos.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { vi } from 'vitest'

// Sin `new URL(…, import.meta.url)`: vite lo trataría como un activo y rechazaría rutas fuera de `frontend/`.
const aqui = dirname(fileURLToPath(import.meta.url))
const raiz = (ruta: string) => resolve(aqui, '../../..', ruta)
const fixture = (nombre: string) => JSON.parse(readFileSync(raiz(`frontend/fixtures/${nombre}.json`), 'utf-8'))

/** Cuerpo de la plantilla sin Jinja ni `<script>`: lo que el navegador tendría tras renderizarla. */
function plantilla(): string {
  const html = readFileSync(raiz('templates/index.html'), 'utf-8')
  const cuerpo = html.slice(html.indexOf('<body>') + '<body>'.length, html.lastIndexOf('</body>'))
  return cuerpo
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/\{%[\s\S]*?%\}/g, '')
    .replace(/\{\{[\s\S]*?\}\}/g, '')
}

export interface Legacy {
  /** Dispara `DOMContentLoaded` como lo haría el navegador y espera a que termine la carga inicial. */
  iniciar(): Promise<void>
  /**
   * Hace fallar la siguiente recarga: `/api/stats` con un 500 y cuerpo JSON, y la lista de sorteos por red caída o,
   * con `sorteosComo: 'cuerpo'`, también con un 500 y cuerpo JSON (sin lista, ni siquiera con estado de error HTTP
   * del que fiarse: el cuerpo no es un array).
   */
  fallarSiguienteRecarga(sorteosComo?: 'red' | 'cuerpo'): void
  /** URLs pedidas por `fetch`, en orden. */
  readonly peticiones: string[]
}

class ChartFalso {
  static defaults: Record<string, unknown> = { font: {}, plugins: { legend: { labels: {} } } }
  destroy() {}
  update() {}
}

export function levantarLegacy(): Legacy {
  const peticiones: string[] = []
  const fallos = { sorteos: 0, stats: 0, comoCuerpo: false }
  const respuesta = (cuerpo: unknown, estado = 200) => ({ ok: estado < 400, status: estado, json: async () => cuerpo })

  vi.stubGlobal('fetch', async (entrada: string) => {
    const url = String(entrada)
    peticiones.push(url)
    if (url.startsWith('/api/sorteos')) {
      if (fallos.sorteos > 0) {
        fallos.sorteos -= 1
        if (fallos.comoCuerpo) return respuesta({ error: 'Error interno' }, 500)
        throw new TypeError('Failed to fetch')
      }
      return respuesta(fixture('sorteos'))
    }
    if (url.startsWith('/api/stats')) {
      if (fallos.stats > 0) {
        fallos.stats -= 1
        return respuesta({ error: 'Error interno' }, 500)
      }
      return respuesta(fixture('stats'))
    }
    if (url.startsWith('/api/gaps')) return respuesta(fixture('gaps'))
    return respuesta({ error: 'no existe' }, 404)
  })
  vi.stubGlobal('Chart', ChartFalso)
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  HTMLCanvasElement.prototype.getContext = (() => ({})) as unknown as HTMLCanvasElement['getContext']

  document.body.innerHTML = plantilla()
  document.documentElement.removeAttribute('data-theme')
  localStorage.clear()

  // `app.js` registra su arranque en `DOMContentLoaded`: se captura el manejador para llamarlo una sola vez por
  // instancia (si no, cada instancia anterior reaccionaría a cada evento).
  let arranque: (() => Promise<void>) | undefined
  const original = document.addEventListener.bind(document)
  const espia = vi.spyOn(document, 'addEventListener').mockImplementation(((tipo: string, fn: EventListener, opts?: unknown) => {
    if (tipo === 'DOMContentLoaded') arranque = fn as unknown as () => Promise<void>
    else original(tipo, fn, opts as AddEventListenerOptions)
  }) as typeof document.addEventListener)
  try {
    ;(0, eval)(readFileSync(raiz('static/app.js'), 'utf-8'))
  } finally {
    espia.mockRestore()
  }

  return {
    iniciar: async () => {
      if (!arranque) throw new Error('app.js no registró su arranque en DOMContentLoaded')
      await arranque()
    },
    fallarSiguienteRecarga: (sorteosComo = 'red') => {
      fallos.comoCuerpo = sorteosComo === 'cuerpo'
      fallos.sorteos = 1
      fallos.stats = 3 // `app.js` reintenta `/api/stats` hasta 3 veces
    },
    peticiones,
  }
}
