import { readFileSync } from 'node:fs'
import { act, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Sorteo, Stats } from './api/types'
import { URL_SORTEOS, URL_STATS } from './store/reactStore'

// Chart.js no pinta en jsdom: el componente se sustituye por un doble.
vi.mock('./components/Chart', () => ({
  Chart: (props: Record<string, unknown>) => <div role="img" aria-label={String(props.etiqueta)} />,
}))

const STATS: Stats = JSON.parse(readFileSync('fixtures/stats.json', 'utf-8'))
const SORTEOS: Sorteo[] = JSON.parse(readFileSync('fixtures/sorteos.json', 'utf-8')).data

let fetchFalso: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  fetchFalso = vi.fn(async (url: string) => new Response(JSON.stringify(url === URL_SORTEOS ? { data: SORTEOS } : url === URL_STATS ? STATS : {}), { status: url === URL_SORTEOS || url === URL_STATS ? 200 : 404 }))
  vi.stubGlobal('fetch', fetchFalso)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('main.tsx', () => {
  it('pinta el armazón en #root, sustituye el cargador de la plantilla y lanza la primera carga', async () => {
    document.body.innerHTML = '<div id="root"><div class="loader-wrap">Cargando datos de sorteos…</div></div>'
    await act(async () => {
      await import('./main')
    })
    const raiz = document.getElementById('root')!
    expect(raiz.querySelector('.loader-wrap')).toBeNull()
    expect(raiz.querySelector('.app')).not.toBeNull()
    expect(raiz.querySelectorAll('section.section')).toHaveLength(14)
    await waitFor(() => expect(fetchFalso.mock.calls.map((c) => c[0])).toEqual([URL_SORTEOS, URL_STATS]))
    await waitFor(() => expect(document.getElementById('lastUpdate')!.textContent).toMatch(/^Última actualización: /))
  })

  it('arranca con el tema guardado en el navegador', async () => {
    localStorage.setItem('theme', 'light')
    document.body.innerHTML = '<div id="root"></div>'
    await act(async () => {
      await import('./main')
    })
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('sin #root lo dice en la consola, no lanza y no pide ningún dato', async () => {
    document.body.innerHTML = ''
    await expect(import('./main')).resolves.toBeDefined()
    expect(console.error).toHaveBeenCalledWith('Falta el elemento #root: no se puede montar la interfaz.')
    expect(fetchFalso).not.toHaveBeenCalled()
  })

  it('ya no descubre islas por marcadores: no usa import.meta.glob ni el puente window.LP', () => {
    const fuente = readFileSync('src/main.tsx', 'utf-8')
    expect(fuente).not.toContain('import.meta.glob')
    expect(fuente).not.toContain('data-react-root')
    expect(fuente).not.toContain('window.LP')
  })
})
