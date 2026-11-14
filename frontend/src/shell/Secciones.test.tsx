import { readFileSync } from 'node:fs'
import { act, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Sorteo, Stats } from '../api/types'
import { StoreProvider } from '../store/StoreProvider'
import { crearReactStore, URL_SORTEOS } from '../store/reactStore'
import { crearStoreFalso } from '../store/storeFalso'
import { Secciones } from './Secciones'

// Chart.js no pinta en jsdom: el componente se sustituye por un doble.
vi.mock('../components/Chart', () => ({
  Chart: (props: Record<string, unknown>) => <div role="img" aria-label={String(props.etiqueta)} />,
}))
// La pestaña Decenas se rompe: el resto de la página tiene que seguir viva.
vi.mock('../tabs/Decenas', () => ({
  nombre: 'decenas',
  Componente: () => {
    throw new Error('fallo interno con detalles secretos')
  },
}))

const STATS: Stats = JSON.parse(readFileSync('fixtures/stats.json', 'utf-8'))
const SORTEOS: Sorteo[] = JSON.parse(readFileSync('fixtures/sorteos.json', 'utf-8')).data

beforeEach(() => {
  localStorage.clear()
  document.body.innerHTML = '<div id="toast"></div>'
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => new Response(JSON.stringify(url === URL_SORTEOS ? { data: SORTEOS } : STATS))),
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Secciones: un fallo queda dentro de su sección', () => {
  it('la sección rota enseña un aviso genérico y las demás siguen con su contenido', async () => {
    const store = crearReactStore()
    render(
      <StoreProvider store={store}>
        <Secciones />
      </StoreProvider>,
    )
    await act(async () => store.cargar())
    const rota = document.getElementById('sec-decenas')!
    expect(within(rota).getByRole('alert').textContent).toBe('No se pudo mostrar esta sección. Recarga la página para intentarlo de nuevo.')
    expect(rota.textContent).not.toContain('secretos')
    expect(rota.querySelector('h2')).toBeNull() // el título también cae con el borde de su sección
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(within(document.getElementById('sec-estadisticas')!).getByRole('heading', { name: 'Estadísticas Generales' })).toBeInTheDocument()
    expect(document.getElementById('sec-estadisticas')!.querySelectorAll('.bar-row').length).toBeGreaterThan(0)
    expect(document.querySelectorAll('section.section')).toHaveLength(14)
  })

  it('el detalle del fallo va a la consola con el nombre de la sección', async () => {
    const store = crearReactStore()
    render(
      <StoreProvider store={store}>
        <Secciones />
      </StoreProvider>,
    )
    expect(console.error).toHaveBeenCalledWith('La sección «decenas» falló', expect.any(Error))
  })
})

describe('Secciones: Predicciones con las estadísticas caídas', () => {
  it('enseña un único aviso con «Reintentar», no uno por cada isla que lee las estadísticas', () => {
    const store = crearStoreFalso({ stats: null, errorStats: true, sorteos: SORTEOS, ready: true })
    render(
      <StoreProvider store={store}>
        <Secciones />
      </StoreProvider>,
    )
    const seccion = document.getElementById('sec-predicciones')!
    expect(within(seccion).getAllByRole('alert')).toHaveLength(1)
    expect(within(seccion).getAllByRole('button', { name: 'Reintentar' })).toHaveLength(1)
  })
})
