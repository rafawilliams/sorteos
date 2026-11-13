import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import config from '../vite.config'

// El servidor de desarrollo (`npm run dev`, spec frontend-react T056) sirve `frontend/index.html` y reenvía la API y los
// archivos estáticos a Flask. Aquí se fija la configuración; que de verdad arranca contra Flask se comprueba a mano.

const pagina = readFileSync('index.html', 'utf-8')
const proxy = (config.server?.proxy ?? {}) as Record<string, string>

describe('servidor de desarrollo', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  async function proxyCon(flaskUrl: string | undefined) {
    vi.stubEnv('FLASK_URL', flaskUrl as string)
    if (flaskUrl === undefined) delete process.env.FLASK_URL
    vi.resetModules()
    const { default: cfg } = await import('../vite.config')
    return (cfg.server?.proxy ?? {}) as Record<string, string>
  }

  it('reenvía /api y /static a Flask', () => {
    expect(Object.keys(proxy).sort()).toEqual(['/api', '/static'])
    expect(proxy['/static']).toBe(proxy['/api'])
  })

  it('sin FLASK_URL apunta al 5000, donde corre `python app.py`', async () => {
    const p = await proxyCon(undefined)
    expect(p['/api']).toBe('http://127.0.0.1:5000')
    expect(p['/static']).toBe('http://127.0.0.1:5000')
  })

  it('con FLASK_URL apunta ahí (para probar contra Flask en otro puerto o con otra base)', async () => {
    const p = await proxyCon('http://127.0.0.1:5999')
    expect(p['/api']).toBe('http://127.0.0.1:5999')
    expect(p['/static']).toBe('http://127.0.0.1:5999')
  })

  it('la página de desarrollo carga main.tsx como módulo y trae la raíz y el aviso emergente', () => {
    expect(pagina).toContain('<script type="module" src="/src/main.tsx"></script>')
    expect(pagina).toContain('<div id="root">')
    expect(pagina).toContain('id="toast"')
  })

  it('la hoja de estilos y el icono se piden a /static, que es lo que se reenvía a Flask', () => {
    expect(pagina).toContain('href="/static/style.css"')
    expect(pagina).toContain('href="/static/favicon.svg"')
  })

  it('el build no cambia: sigue saliendo de src/main.tsx a static/dist/app.js, no de la página de desarrollo', () => {
    const entrada = (config.build?.rollupOptions?.input ?? '') as string
    expect(entrada).toBe('src/main.tsx')
    expect(config.build?.outDir).toBe('../static/dist')
    const salida = config.build?.rollupOptions?.output as { entryFileNames: string }
    expect(salida.entryFileNames).toBe('app.js')
  })
})
