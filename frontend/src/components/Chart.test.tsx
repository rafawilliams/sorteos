import { act, render } from '@testing-library/react'
import type { ChartData, ChartOptions } from 'chart.js'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chartOptions } from '../lib/chartOptions'
import { StoreProvider } from '../store/StoreProvider'
import { crearStoreFalso } from '../store/storeFalso'
import type { Tema } from '../store/tipos'
import { Chart } from './Chart'

// Chart.js no pinta en jsdom (no hay <canvas>): se sustituye por un doble que registra lo que recibe y lo que se destruye.
const doble = vi.hoisted(() => {
  const creados: Array<{ canvas: unknown; config: { type: string; data: unknown; options: Record<string, unknown> }; destruido: boolean }> = []
  class ChartFalso {
    static register = () => {}
    destruido = false
    constructor(canvas: unknown, config: { type: string; data: unknown; options: Record<string, unknown> }) {
      creados.push(Object.assign(this, { canvas, config }) as never)
    }
    destroy() {
      this.destruido = true
    }
  }
  return { creados, ChartFalso }
})
vi.mock('chart.js', () => ({
  Chart: doble.ChartFalso,
  BarController: {}, LineController: {}, RadarController: {}, ScatterController: {},
  CategoryScale: {}, LinearScale: {}, RadialLinearScale: {},
  BarElement: {}, LineElement: {}, PointElement: {}, Tooltip: {}, Legend: {}, Filler: {},
}))

const vivos = () => doble.creados.filter((c) => !c.destruido)
const datosDe = (etiqueta: string) => (): ChartData => ({ labels: ['a'], datasets: [{ label: etiqueta, data: [1] }] })
const opcionesDe = (tema: Tema, leyenda = true): ChartOptions => chartOptions(tema, leyenda)

function montar(props: Partial<React.ComponentProps<typeof Chart>> = {}, tema: Tema = 'dark', estricto = false) {
  const store = crearStoreFalso({ theme: tema })
  const propios = { type: 'bar' as const, datos: datosDe('x'), opciones: opcionesDe, ...props }
  const hijo = (
    <StoreProvider store={store}>
      <Chart {...propios} />
    </StoreProvider>
  )
  const vista = render(estricto ? <StrictMode>{hijo}</StrictMode> : hijo)
  return { store, propios, ...vista, repintar: (nuevos: Partial<React.ComponentProps<typeof Chart>> = {}) => vista.rerender(
    <StoreProvider store={store}>
      <Chart {...propios} {...nuevos} />
    </StoreProvider>,
  ) }
}

const mediaReducida = (reducida: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: reducida && q.includes('prefers-reduced-motion'), addEventListener: () => {}, removeEventListener: () => {} }))

beforeEach(() => {
  doble.creados.length = 0
  mediaReducida(false)
})
afterEach(() => vi.unstubAllGlobals())

describe('Chart: crea el gráfico', () => {
  it('con el tipo, los datos y las opciones del tema actual, sobre un canvas', () => {
    montar({ type: 'line', datos: datosDe('serie') }, 'light')
    expect(vivos()).toHaveLength(1)
    const c = vivos()[0]!
    expect(c.config.type).toBe('line')
    expect((c.config.data as ChartData).datasets[0]!.label).toBe('serie')
    expect(c.config.options).toMatchObject(chartOptions('light') as Record<string, unknown>)
    expect(c.canvas).toBeInstanceOf(HTMLCanvasElement)
  })

  it('el canvas es una imagen con nombre accesible, dentro de un contenedor con la clase de la hoja de estilos', () => {
    const { container } = montar({ etiqueta: 'Distribución mensual comparativa' })
    const canvas = container.querySelector('canvas')!
    expect(canvas).toHaveAttribute('role', 'img')
    expect(canvas).toHaveAttribute('aria-label', 'Distribución mensual comparativa')
    expect(canvas.parentElement).toHaveClass('chart-container')
  })

  it('con `altura` fija la altura del contenedor; sin ella la decide la hoja de estilos', () => {
    const { container, unmount } = montar({ altura: 320 })
    expect((container.querySelector('.chart-container') as HTMLElement).style.height).toBe('320px')
    unmount()
    const otro = montar()
    expect((otro.container.querySelector('.chart-container') as HTMLElement).style.height).toBe('')
  })

  it('no modifica los objetos que le pasa quien lo usa', () => {
    const opciones = Object.freeze(chartOptions('dark')) as ChartOptions
    expect(() => montar({ opciones: () => opciones })).not.toThrow()
  })
})

describe('Chart: el tema', () => {
  it('al cambiar el tema destruye el gráfico y crea otro con los colores del tema nuevo', () => {
    const { store } = montar({}, 'dark')
    const primero = vivos()[0]!
    act(() => store.cambiar({ theme: 'light' }))
    expect(primero.destruido).toBe(true)
    expect(vivos()).toHaveLength(1)
    const nuevo = vivos()[0]!
    expect(nuevo).not.toBe(primero)
    expect(nuevo.config.options).toMatchObject(chartOptions('light') as Record<string, unknown>)
    expect(nuevo.config.options).not.toMatchObject(chartOptions('dark') as Record<string, unknown>)
  })

  it('los datos también se piden con el tema nuevo (los colores de las series pueden depender de él)', () => {
    const datos = vi.fn((tema: Tema): ChartData => ({ labels: [], datasets: [{ data: [], borderColor: tema === 'dark' ? 'oro' : 'marron' }] }))
    const { store } = montar({ datos }, 'dark')
    act(() => store.cambiar({ theme: 'light' }))
    expect(datos).toHaveBeenLastCalledWith('light')
    expect((vivos()[0]!.config.data as ChartData).datasets[0]!.borderColor).toBe('marron')
  })

  it('cambiar otra cosa del estado (la pestaña) no recrea el gráfico', () => {
    const { store } = montar()
    act(() => store.cambiar({ activeTab: 'gaps' }))
    expect(doble.creados).toHaveLength(1)
  })
})

describe('Chart: ciclo de vida', () => {
  it('al desmontar destruye el gráfico', () => {
    const { unmount } = montar()
    unmount()
    expect(vivos()).toHaveLength(0)
    expect(doble.creados[0]!.destruido).toBe(true)
  })

  it('con datos nuevos (otra función) recrea el gráfico', () => {
    const { repintar } = montar({ datos: datosDe('a') })
    const primero = vivos()[0]!
    repintar({ datos: datosDe('b') })
    expect(primero.destruido).toBe(true)
    expect((vivos()[0]!.config.data as ChartData).datasets[0]!.label).toBe('b')
    expect(vivos()).toHaveLength(1)
  })

  it('repintar con las mismas funciones y el mismo tema no lo recrea', () => {
    const { repintar } = montar()
    repintar()
    repintar()
    expect(doble.creados).toHaveLength(1)
  })

  it('con otro tipo de gráfico lo recrea', () => {
    const { repintar } = montar({ type: 'bar' })
    repintar({ type: 'line' })
    expect(vivos()).toHaveLength(1)
    expect(vivos()[0]!.config.type).toBe('line')
  })

  it('en StrictMode (doble montaje) queda exactamente un gráfico vivo', () => {
    montar({}, 'dark', true)
    expect(vivos()).toHaveLength(1)
  })
})

describe('Chart: movimiento reducido', () => {
  it('si la persona prefiere menos movimiento, sin animaciones', () => {
    mediaReducida(true)
    montar()
    expect(vivos()[0]!.config.options.animation).toBe(false)
  })

  it('si no, deja las animaciones por defecto de Chart.js', () => {
    mediaReducida(false)
    montar()
    expect('animation' in vivos()[0]!.config.options).toBe(false)
  })

  it('sin matchMedia en el entorno tampoco falla', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(() => montar()).not.toThrow()
  })
})
