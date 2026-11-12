import { describe, expect, it } from 'vitest'
import { chartOptions, DIGIT_COLORS } from './chartOptions'

// Colores literales de `chartOpts()` de static/app.js (plan §0). Si cambian, los gráficos dejan de verse como hoy.
const CLARO = { texto: '#5c554a', tenue: '#9a9189', rejilla: 'rgba(139,105,20,0.1)', fondoTooltip: '#ffffff', bordeTooltip: 'rgba(139,105,20,0.2)', tituloTooltip: '#1a1612' }
const OSCURO = { texto: '#8a8693', tenue: '#4a4656', rejilla: 'rgba(212,175,55,0.06)', fondoTooltip: '#111118', bordeTooltip: '#d4af3740', tituloTooltip: '#f0ece2' }

// Las opciones de Chart.js son un árbol grande y con muchos tipos opcionales: se lee con un tipo laxo.
type Arbol = {
  responsive: boolean
  maintainAspectRatio: boolean
  plugins: { legend: { display: boolean; position: string; labels: { color: string; font: { family: string; size: number }; boxWidth: number; padding: number } }; tooltip: Record<string, unknown> }
  scales: Record<'x' | 'y', { ticks: { color: string; font: { family: string; size: number } }; grid: { color: string } }>
}
const opciones = (...args: Parameters<typeof chartOptions>) => chartOptions(...args) as unknown as Arbol

describe.each([
  ['light', CLARO],
  ['dark', OSCURO],
] as const)('chartOptions en tema %s', (tema, c) => {
  it('usa los colores literales de la hoja de estilos antigua', () => {
    const o = opciones(tema)
    expect(o.plugins.legend.labels.color).toBe(c.texto)
    expect(o.plugins.tooltip).toMatchObject({ backgroundColor: c.fondoTooltip, borderColor: c.bordeTooltip, borderWidth: 1, titleColor: c.tituloTooltip, bodyColor: c.texto })
    expect(o.scales.x.ticks.color).toBe(c.tenue)
    expect(o.scales.y.ticks.color).toBe(c.tenue)
    expect(o.scales.x.grid.color).toBe(c.rejilla)
    expect(o.scales.y.grid.color).toBe(c.rejilla)
  })
})

describe('chartOptions: lo que no depende del tema', () => {
  it('es responsive y no mantiene la proporción (el contenedor fija la altura)', () => {
    const o = opciones('dark')
    expect(o.responsive).toBe(true)
    expect(o.maintainAspectRatio).toBe(false)
  })

  it('la leyenda va abajo, con DM Sans 11, caja de 12 y relleno de 16', () => {
    expect(opciones('dark').plugins.legend).toMatchObject({ display: true, position: 'bottom', labels: { font: { family: 'DM Sans', size: 11 }, boxWidth: 12, padding: 16 } })
  })

  it('sin leyenda la oculta', () => {
    expect(opciones('dark', false).plugins.legend.display).toBe(false)
    expect(opciones('dark', true).plugins.legend.display).toBe(true)
  })

  it('los ejes: texto del eje x en DM Sans 10 y del eje y en JetBrains Mono 10', () => {
    const o = opciones('light')
    expect(o.scales.x.ticks.font).toEqual({ family: 'DM Sans', size: 10 })
    expect(o.scales.y.ticks.font).toEqual({ family: 'JetBrains Mono', size: 10 })
  })

  it('cada llamada devuelve un objeto nuevo (quien lo recibe puede modificarlo sin afectar a otros)', () => {
    const a = chartOptions('dark')
    const b = chartOptions('dark')
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
    ;(a as unknown as Arbol).scales.x.grid.color = 'rojo'
    expect(opciones('dark').scales.x.grid.color).toBe(OSCURO.rejilla)
  })
})

describe('DIGIT_COLORS', () => {
  it('tiene los diez colores literales de static/app.js, uno por dígito', () => {
    expect(DIGIT_COLORS).toEqual(['#ffd700', '#ff4d4d', '#4dabff', '#34d399', '#c084fc', '#ff9f43', '#ee5a6f', '#0abde3', '#10ac84', '#f368e0'])
  })
})
