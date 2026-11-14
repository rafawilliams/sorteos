import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Stats } from '../api/types'
import { chartOptions, DIGIT_COLORS } from '../lib/chartOptions'
import { StoreProvider } from '../store/StoreProvider'
import { crearStoreFalso } from '../store/storeFalso'
import type { Snapshot } from '../store/tipos'
import { Componente, nombre } from './Tendencias'

// Chart.js no pinta en jsdom: el componente se sustituye por un doble que guarda las props que recibe.
const graficos = vi.hoisted(() => ({ props: [] as Array<Record<string, any>> }))
vi.mock('../components/Chart', () => ({
  Chart: (props: Record<string, unknown>) => {
    graficos.props.push(props)
    return <div data-testid="grafico" role="img" aria-label={String(props.etiqueta)} />
  },
}))

const STATS: Stats = JSON.parse(readFileSync('fixtures/stats.json', 'utf-8'))
const TENDENCIA = STATS.trends

function montar(estado: Partial<Snapshot> = {}) {
  const store = crearStoreFalso({ activeTab: 'tendencias' as never, stats: STATS, ready: true, ...estado })
  const vista = render(
    <StoreProvider store={store}>
      <Componente />
    </StoreProvider>,
  )
  return { store, ...vista }
}
const graficoDe = (etiqueta: string) => graficos.props.filter((p) => p.etiqueta === etiqueta).at(-1)!
const DIGITOS = 'Gráfico de tendencia de dígitos por mes'
const VOLUMEN = 'Gráfico de volumen de sorteos por mes'

beforeEach(() => {
  graficos.props.length = 0
})

describe('isla Tendencias', () => {
  it('se llama «tendencias», como el data-tab de su pestaña', () => {
    expect(nombre).toBe('tendencias')
  })

  it('sin estadísticas enseña el esqueleto de carga y ningún gráfico', () => {
    montar({ stats: null })
    expect(screen.getByRole('status', { name: 'Cargando tendencias' })).toBeTruthy()
    expect(graficos.props).toHaveLength(0)
  })

  it('con la carga de estadísticas fallida dice que no se pudo y ofrece reintentar, sin esqueleto', () => {
    montar({ stats: null, errorStats: true })
    expect(screen.getByRole('alert').textContent).toContain('No se pudieron cargar las estadísticas.')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
    expect(graficos.props).toHaveLength(0)
  })

  it('pinta dos tarjetas con su título, su insignia y su gráfico', () => {
    montar()
    const tarjetas = Array.from(document.querySelectorAll('.card.reveal')) as HTMLElement[]
    expect(tarjetas.map((t) => [t.querySelector('.card-title')!.textContent, t.querySelector('.card-badge')!.textContent])).toEqual([
      ['Frecuencia de Dígitos por Mes', 'Últimos 24 meses'],
      ['Sorteos por Mes', 'Volumen'],
    ])
    expect(tarjetas[0]!.querySelector('[data-testid="grafico"]')).toBeTruthy()
    expect(tarjetas[1]!.querySelector('[data-testid="grafico"]')).toBeTruthy()
    expect(tarjetas[0]!.style.marginBottom).toBe('28px')
  })

  it('sin tendencia no se pinta ningún gráfico y no falla', () => {
    montar({ stats: { ...STATS, trends: [] } })
    expect(graficos.props).toHaveLength(0)
    expect(screen.getByRole('heading', { name: 'Sorteos por Mes' })).toBeTruthy()
  })

  it('con trends ausente tampoco falla', () => {
    montar({ stats: { ...STATS, trends: undefined as never } })
    expect(graficos.props).toHaveLength(0)
  })

  it('el gráfico de dígitos es de líneas, con un dataset por dígito y los colores de siempre', () => {
    montar()
    const g = graficoDe(DIGITOS)
    expect(g.type).toBe('line')
    const datos = g.datos('dark')
    expect(datos.labels).toEqual(TENDENCIA.map((t) => t.month))
    expect(datos.datasets).toHaveLength(10)
    datos.datasets.forEach((d: any, i: number) => {
      expect(d.label).toBe(`Dígito ${i}`)
      expect(d.borderColor).toBe(DIGIT_COLORS[i])
      expect(d.backgroundColor).toBe(`${DIGIT_COLORS[i]}20`)
      expect(d.data).toEqual(TENDENCIA.map((t) => t.digits[String(i)] || 0))
      expect([d.tension, d.borderWidth, d.pointRadius, d.pointHoverRadius]).toEqual([0.4, 2, 3, 6])
    })
  })

  it('un dígito ausente de un mes cuenta 0', () => {
    montar({ stats: { ...STATS, trends: [{ month: '2026-01', sorteos: 2, digits: { '3': 5 } }] } })
    const datos = graficoDe(DIGITOS).datos('dark')
    expect(datos.datasets[3].data).toEqual([5])
    expect(datos.datasets[0].data).toEqual([0])
  })

  it('el gráfico de volumen es de barras con los sorteos de cada mes y el degradado dorado a azul', () => {
    montar()
    const g = graficoDe(VOLUMEN)
    expect(g.type).toBe('bar')
    const datos = g.datos('dark')
    const n = TENDENCIA.length
    expect(datos.labels).toEqual(TENDENCIA.map((t) => t.month))
    const d = datos.datasets[0]
    expect(d.label).toBe('Sorteos por mes')
    expect(d.data).toEqual(TENDENCIA.map((t) => t.sorteos))
    expect(d.backgroundColor[0]).toBe('rgba(212,175,55,0.7)')
    expect(d.backgroundColor.at(-1)).toBe(`rgba(${Math.round(212 - (50 * (n - 1)) / n)},${Math.round(175 - (30 * (n - 1)) / n)},${Math.round(55 + (100 * (n - 1)) / n)},0.7)`)
    expect(d.backgroundColor).toHaveLength(n)
    expect([d.borderColor, d.borderWidth, d.borderRadius]).toEqual(['rgba(212,175,55,0.3)', 1, 6])
  })

  it('las opciones salen de chartOptions: con leyenda en las líneas y sin ella en las barras', () => {
    montar()
    expect(graficoDe(DIGITOS).opciones('light')).toEqual(chartOptions('light'))
    expect(graficoDe(VOLUMEN).opciones('dark')).toEqual(chartOptions('dark', false))
    expect(graficoDe(DIGITOS).opciones('dark').plugins.legend.display).toBe(true)
    expect(graficoDe(VOLUMEN).opciones('dark').plugins.legend.display).toBe(false)
  })

  it('datos y opciones son estables entre renders (el gráfico real no se recrea)', () => {
    const { rerender, store } = montar()
    const antes = [graficoDe(DIGITOS), graficoDe(VOLUMEN)]
    rerender(
      <StoreProvider store={store}>
        <Componente />
      </StoreProvider>,
    )
    const despues = [graficoDe(DIGITOS), graficoDe(VOLUMEN)]
    expect(despues[0]!.datos).toBe(antes[0]!.datos)
    expect(despues[0]!.opciones).toBe(antes[0]!.opciones)
    expect(despues[1]!.datos).toBe(antes[1]!.datos)
    expect(despues[1]!.opciones).toBe(antes[1]!.opciones)
  })
})
