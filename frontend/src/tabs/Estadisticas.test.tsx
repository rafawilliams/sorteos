import { readFileSync } from 'node:fs'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Sorteo, Stats } from '../api/types'
import { StoreProvider } from '../store/StoreProvider'
import { crearStoreFalso } from '../store/storeFalso'
import type { Snapshot } from '../store/tipos'
import { Componente, nombre } from './Estadisticas'

// Chart.js no pinta en jsdom: el componente se sustituye por un doble que guarda las props que recibe.
const graficos = vi.hoisted(() => ({ props: [] as Array<Record<string, any>> }))
vi.mock('../components/Chart', () => ({
  Chart: (props: Record<string, unknown>) => {
    graficos.props.push(props)
    return <div data-testid="grafico" role="img" aria-label={String(props.etiqueta)} />
  },
}))

const STATS: Stats = JSON.parse(readFileSync('fixtures/stats.json', 'utf-8'))
const STATS_FORMATOS: Stats = JSON.parse(readFileSync('fixtures/stats_formatos_reales.json', 'utf-8'))
const SORTEOS: Sorteo[] = JSON.parse(readFileSync('fixtures/sorteos.json', 'utf-8')).data

function montar(estado: Partial<Snapshot> = {}) {
  const store = crearStoreFalso({ activeTab: 'estadisticas' as never, stats: STATS, sorteos: SORTEOS, ready: true, ...estado })
  const vista = render(
    <StoreProvider store={store}>
      <Componente />
    </StoreProvider>,
  )
  return { store, ...vista }
}
const texto = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
const tarjetaDe = (titulo: string) => screen.getByRole('heading', { name: titulo }).closest('.card') as HTMLElement
const filas = (el: Element) =>
  Array.from(el.querySelectorAll('.bar-row')).map((r) => ({
    etiqueta: texto(r.querySelector('.bar-label')),
    conteo: texto(r.querySelector('.bar-fill')),
    ancho: (r.querySelector('.bar-fill') as HTMLElement).style.width,
    clase: r.querySelector('.bar-fill')!.className,
  }))
const graficoDe = (etiqueta: string) => graficos.props.filter((p) => p.etiqueta === etiqueta).at(-1)!

beforeEach(() => {
  graficos.props.length = 0
})

describe('isla Estadísticas: estados', () => {
  it('se llama «estadisticas», como el data-tab de su pestaña', () => {
    expect(nombre).toBe('estadisticas')
  })

  it('sin estadísticas enseña el selector de premio y el esqueleto, sin tarjetas', () => {
    montar({ stats: null })
    expect(screen.getByRole('status', { name: 'Cargando estadísticas' })).toBeTruthy()
    expect(screen.getByRole('tablist', { name: 'Seleccionar premio para estadísticas' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Frecuencia de Dígitos' })).toBeNull()
  })

  it('con la carga de estadísticas fallida dice que no se pudo y ofrece reintentar, sin esqueleto', () => {
    montar({ stats: null, errorStats: true })
    expect(screen.getByRole('alert').textContent).toContain('No se pudieron cargar las estadísticas.')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('tablist', { name: 'Seleccionar premio para estadísticas' })).toBeTruthy()
  })

  it('con estadísticas pinta las ocho tarjetas del código antiguo y el panel de formatos', () => {
    montar()
    const titulos = Array.from(document.querySelectorAll('.card-title')).map((t) => texto(t))
    expect(titulos.slice(0, 8)).toEqual(['Frecuencia de Dígitos', 'Terminaciones Populares', 'Números Calientes', 'Números Fríos', 'Series Más Frecuentes', 'Letras Más Frecuentes', 'Comparación por Categoría', 'Correlación 1er vs 2do Premio'])
    expect(screen.getByRole('heading', { name: 'Premios de Otros Formatos' })).toBeTruthy()
    expect(document.querySelectorAll('.card.reveal').length).toBe(9)
  })

  it('las estadísticas vacías no fallan', () => {
    montar({ stats: { ...STATS, prizes: undefined as never, digit_frequency: undefined as never, last_digit_pairs: undefined as never, hot_cold: undefined as never, series_folio: undefined as never, letras: undefined as never, by_category: undefined as never, formatos: undefined as never }, sorteos: [] })
    expect(screen.getByRole('heading', { name: 'Frecuencia de Dígitos' })).toBeTruthy()
    expect(graficos.props).toHaveLength(0)
  })
})

describe('isla Estadísticas: selector de premio', () => {
  it('muestra los tres premios con el elegido seleccionado y aria-controls hacia la región', () => {
    montar()
    const pestañas = within(screen.getByRole('tablist', { name: 'Seleccionar premio para estadísticas' })).getAllByRole('tab')
    expect(pestañas.map((p) => texto(p))).toEqual(['1er Premio', '2do Premio', '3er Premio'])
    expect(pestañas.map((p) => p.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false'])
    const region = screen.getByRole('region', { name: 'Estadísticas del premio elegido' })
    expect(pestañas.every((p) => p.getAttribute('aria-controls') === region.id)).toBe(true)
  })

  it('elegir un premio lo guarda en el store y repinta con las cifras de ese premio', async () => {
    const { store } = montar()
    const antes = filas(tarjetaDe('Frecuencia de Dígitos'))
    await userEvent.click(screen.getByRole('tab', { name: '2do Premio' }))
    expect(store.llamadas).toContainEqual({ accion: 'setStatsPrize', args: ['segundo'] })
    const esperado = Object.entries(STATS.prizes.segundo.digit_frequency!).map(([d, c]) => ({ etiqueta: d, conteo: String(c) }))
    expect(filas(tarjetaDe('Frecuencia de Dígitos')).map((f) => ({ etiqueta: f.etiqueta, conteo: f.conteo }))).toEqual(esperado)
    expect(filas(tarjetaDe('Frecuencia de Dígitos'))).not.toEqual(antes)
  })

  it('las flechas, Inicio y Fin recorren los premios', async () => {
    const { store } = montar()
    screen.getByRole('tab', { name: '1er Premio' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    await userEvent.keyboard('{End}')
    await userEvent.keyboard('{Home}')
    expect(store.llamadas.filter((l) => l.accion === 'setStatsPrize').map((l) => l.args[0])).toEqual(['segundo', 'tercero', 'primero'])
  })

  it('un premio sin estadísticas propias cae a las generales, como el código antiguo', () => {
    montar({ statsPrize: 'tercero', stats: { ...STATS, prizes: { ...STATS.prizes, tercero: {} as never } } })
    const esperado = Object.entries(STATS.digit_frequency).map(([d, c]) => ({ etiqueta: d, conteo: String(c) }))
    expect(filas(tarjetaDe('Frecuencia de Dígitos')).map((f) => ({ etiqueta: f.etiqueta, conteo: f.conteo }))).toEqual(esperado)
  })
})

describe('isla Estadísticas: barras', () => {
  it('la frecuencia de dígitos va de 0 a 9 con el ancho relativo al máximo y la barra dorada', () => {
    montar()
    const df = STATS.prizes.primero.digit_frequency!
    const maximo = Math.max(...Object.values(df))
    const f = filas(tarjetaDe('Frecuencia de Dígitos'))
    expect(f).toHaveLength(Object.keys(df).length)
    f.forEach((fila) => {
      expect(fila.clase).toBe('bar-fill gold')
      expect(parseFloat(fila.ancho)).toBeCloseTo(Number(((df[fila.etiqueta]! / maximo) * 100).toFixed(1)), 5)
    })
    expect(f.some((x) => parseFloat(x.ancho) === 100)).toBe(true)
  })

  it('las terminaciones populares enseñan como mucho 12, en verde', () => {
    montar()
    const total = Object.keys(STATS.prizes.primero.last_digit_pairs!).length
    const f = filas(tarjetaDe('Terminaciones Populares'))
    expect(f).toHaveLength(Math.min(12, total))
    expect(f.every((x) => x.clase === 'bar-fill green')).toBe(true)
  })

  it('calientes y fríos usan sus clases y el número como etiqueta', () => {
    montar()
    const hc = STATS.prizes.primero.hot_cold!
    expect(filas(tarjetaDe('Números Calientes')).map((x) => [x.etiqueta, x.conteo, x.clase])).toEqual(hc.hot.map((h) => [h.number, String(h.count), 'bar-fill hot']))
    expect(filas(tarjetaDe('Números Fríos')).map((x) => [x.etiqueta, x.conteo, x.clase])).toEqual(hc.cold.map((h) => [h.number, String(h.count), 'bar-fill cold']))
  })

  it('series (doradas) y letras (verdes) salen de series_folio y letras', () => {
    montar()
    expect(filas(tarjetaDe('Series Más Frecuentes')).map((x) => [x.etiqueta, x.conteo, x.clase])).toEqual(STATS.series_folio.series.map((s) => [s.value, String(s.count), 'bar-fill gold']))
    expect(filas(tarjetaDe('Letras Más Frecuentes')).map((x) => [x.etiqueta, x.conteo, x.clase])).toEqual(STATS.letras.map((l) => [l.letra, String(l.count), 'bar-fill green']))
  })

  it('una lista vacía no deja barras ni falla', () => {
    montar({ stats: { ...STATS, letras: [], series_folio: { series: [], folios: [] } } })
    expect(filas(tarjetaDe('Letras Más Frecuentes'))).toEqual([])
    expect(filas(tarjetaDe('Series Más Frecuentes'))).toEqual([])
  })

  it('el texto de una serie con caracteres especiales se escapa y no se interpreta como HTML', () => {
    montar({ stats: { ...STATS, series_folio: { folios: [], series: [{ value: '<b>x</b>', count: 3 }] } } })
    const tarjeta = tarjetaDe('Series Más Frecuentes')
    expect(texto(tarjeta.querySelector('.bar-label'))).toBe('<b>x</b>')
    expect(tarjeta.querySelector('b')).toBeNull()
  })
})

describe('isla Estadísticas: gráficos', () => {
  it('el radar compara las tres categorías principales con sus colores y porcentajes', () => {
    montar()
    const g = graficoDe('Gráfico radar comparación por categoría')
    expect(g.type).toBe('radar')
    expect(g.altura).toBe(380)
    const datos = g.datos('dark')
    expect(datos.labels).toEqual(['Dígito 0', 'Dígito 1', 'Dígito 2', 'Dígito 3', 'Dígito 4', 'Dígito 5', 'Dígito 6', 'Dígito 7', 'Dígito 8', 'Dígito 9'])
    expect(datos.datasets.map((d: any) => d.label)).toEqual(['Dominical', 'Miercolito', 'Gordito del Zodiaco'])
    expect(datos.datasets.map((d: any) => d.borderColor)).toEqual(['#ffd700', '#34d399', '#ff4d4d'])
    datos.datasets.forEach((d: any) => expect(d.data.reduce((a: number, b: number) => a + b, 0)).toBeCloseTo(100, 5))
  })

  it('el radar deja fuera el extraordinario y las categorías sin frecuencia, y no se pinta sin ninguna', () => {
    const { by_category } = STATS
    montar({ stats: { ...STATS, by_category: { dominical: by_category.dominical!, extraordinario: by_category.extraordinario! } } })
    expect(graficoDe('Gráfico radar comparación por categoría').datos('dark').datasets.map((d: any) => d.label)).toEqual(['Dominical'])
  })

  it('sin categorías principales no hay radar', () => {
    montar({ stats: { ...STATS, by_category: { extraordinario: STATS.by_category.extraordinario! } } })
    expect(screen.queryByRole('img', { name: 'Gráfico radar comparación por categoría' })).toBeNull()
  })

  it('las opciones del radar dependen del tema y el tooltip da el porcentaje con un decimal', () => {
    montar()
    const g = graficoDe('Gráfico radar comparación por categoría')
    const oscuro = g.opciones('dark')
    const claro = g.opciones('light')
    expect(oscuro.scales.r.pointLabels.color).toBe('#8a8693')
    expect(claro.scales.r.pointLabels.color).toBe('#5c554a')
    expect(oscuro.scales.r.grid.color).toBe('rgba(212,175,55,0.08)')
    expect(claro.scales.r.grid.color).toBe('rgba(139,105,20,0.1)')
    expect(oscuro.scales.r.ticks.display).toBe(false)
    expect(oscuro.scales.r.beginAtZero).toBe(true)
    expect(oscuro.plugins.tooltip.callbacks.label({ dataset: { label: 'Dominical' }, raw: 12.345 })).toBe('Dominical: 12.3%')
  })

  it('la dispersión usa los 500 sorteos más recientes con premios de 4 cifras', () => {
    const sorteos: Sorteo[] = Array.from({ length: 600 }, (_, i) => ({ ...SORTEOS[0]!, primero: String(1000 + i), segundo: String(2000 + i) }))
    sorteos[0] = { ...sorteos[0]!, segundo: '98' } // formato de 2 cifras: se descarta
    sorteos[1] = { ...sorteos[1]!, primero: '' }
    montar({ sorteos })
    const g = graficoDe('Gráfico de dispersión correlación premios')
    expect(g.type).toBe('scatter')
    const puntos = g.datos('dark').datasets[0].data
    expect(puntos).toHaveLength(498)
    expect(puntos[0]).toEqual({ x: 1002, y: 2002, primero: '1002', segundo: '2002' })
    expect(puntos.at(-1)).toEqual({ x: 1499, y: 2499, primero: '1499', segundo: '2499' })
  })

  it('la dispersión cambia de color con el tema y su tooltip enseña los premios tal como llegan', () => {
    montar()
    const g = graficoDe('Gráfico de dispersión correlación premios')
    expect(g.datos('dark').datasets[0].backgroundColor).toBe('rgba(255,215,0,0.3)')
    expect(g.datos('light').datasets[0].backgroundColor).toBe('rgba(184,134,11,0.35)')
    const o = g.opciones('dark')
    expect(o.plugins.legend.display).toBe(false)
    expect(o.scales.x.title.text).toBe('1er Premio')
    expect(o.scales.y.title.text).toBe('2do Premio')
    expect(o.plugins.tooltip.callbacks.label({ raw: { x: 7, y: 42, primero: '0007', segundo: '0042' } })).toBe('1ro: 0007 — 2do: 0042')
  })

  it('sin sorteos con dos premios de 4 cifras no hay dispersión', () => {
    montar({ sorteos: [] })
    expect(screen.queryByRole('img', { name: 'Gráfico de dispersión correlación premios' })).toBeNull()
  })

  it('los datos de la dispersión son estables entre renders (el gráfico real no se recrea)', () => {
    const { rerender, store } = montar()
    const antes = graficoDe('Gráfico de dispersión correlación premios')
    rerender(
      <StoreProvider store={store}>
        <Componente />
      </StoreProvider>,
    )
    const despues = graficoDe('Gráfico de dispersión correlación premios')
    expect(despues.datos).toBe(antes.datos)
    expect(despues.opciones).toBe(antes.opciones)
  })
})

describe('isla Estadísticas: premios de otros formatos', () => {
  const formatos = () => screen.getByRole('heading', { name: 'Premios de Otros Formatos' }).closest('.card') as HTMLElement

  it('sin premios de ese formato lo dice', () => {
    montar()
    expect(texto(formatos())).toContain('2 cifrasSin premios de este formato.5 cifrasSin premios de este formato.')
  })

  it('con premios enseña total, categorías, premios, rango, cuadrículas por posición y los más frecuentes', () => {
    montar({ stats: STATS_FORMATOS })
    const dos = within(formatos()).getByLabelText('Estadísticas de premios de 2 cifras')
    expect(texto(dos.querySelector('h4'))).toBe('2 cifras — 300 premios')
    const resumen = dos.querySelector('p')!
    expect(resumen.querySelectorAll('br')).toHaveLength(2)
    expect(resumen.innerHTML).toBe('gordito (300)<br>2do: 150 · 3ro: 150<br>2014-01-12 → 2019-09-29')
    expect(Array.from(dos.querySelectorAll('small.section-subtitle')).map((s) => texto(s))).toEqual(['Decenas', 'Unidades'])
    expect(dos.querySelectorAll('.pos-grid')).toHaveLength(2)
    const cinco = within(formatos()).getByLabelText('Estadísticas de premios de 5 cifras')
    expect(texto(cinco.querySelector('h4'))).toBe('5 cifras — 450 premios')
    expect(Array.from(cinco.querySelectorAll('small.section-subtitle')).map((s) => texto(s))).toEqual(['Dec. millar', 'Millares', 'Centenas', 'Decenas', 'Unidades'])
    const calientes = within(cinco).getByRole('img', { name: 'Números de 5 cifras más frecuentes' })
    expect(filas(calientes)[0]).toMatchObject({ etiqueta: STATS_FORMATOS.formatos['5']!.hot_cold.hot[0]!.number, clase: 'bar-fill hot' })
  })

  it('las celdas de posición llevan su title con la posición, el dígito y las veces', () => {
    montar({ stats: STATS_FORMATOS })
    const dos = within(formatos()).getByLabelText('Estadísticas de premios de 2 cifras')
    const celda = dos.querySelector('.pos-cell') as HTMLElement
    const [digito, veces] = Object.entries(STATS_FORMATOS.formatos['2']!.position_frequency[0]!)[0]!
    expect(celda.title).toBe(`Decenas: dígito ${digito} — ${veces} veces`)
    expect(texto(celda)).toBe(`${digito}${veces}`)
  })

  it('el color de las celdas crece con la frecuencia y el texto cambia en el tema claro', () => {
    montar({ stats: STATS_FORMATOS, theme: 'light' })
    const dos = within(formatos()).getByLabelText('Estadísticas de premios de 2 cifras')
    const celdas = Array.from(dos.querySelector('.pos-grid')!.querySelectorAll('.pos-cell')) as HTMLElement[]
    const pos = Object.values(STATS_FORMATOS.formatos['2']!.position_frequency[0]!)
    const max = Math.max(...pos)
    const iMax = pos.indexOf(max)
    expect(celdas[iMax]!.style.background).toContain(`rgba(212, 175, 55, ${(0.65).toFixed(2).replace(/0$/, '')})`)
    expect(celdas[iMax]!.style.color).toBe('rgb(255, 255, 255)')
  })

  it('un formato con total pero sin rango de fechas ni cuadrículas no falla', () => {
    const base = STATS_FORMATOS.formatos['2']!
    montar({ stats: { ...STATS_FORMATOS, formatos: { '2': { ...base, date_range: null, position_frequency: undefined as never, hot_cold: undefined as never } } } })
    const dos = within(formatos()).getByLabelText('Estadísticas de premios de 2 cifras')
    expect(dos.querySelectorAll('.pos-grid')).toHaveLength(0)
    expect(filas(dos)).toEqual([])
  })
})
