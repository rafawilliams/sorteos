import { readFileSync } from 'node:fs'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Sorteo, Stats } from '../api/types'
import { chartOptions, DIGIT_COLORS } from '../lib/chartOptions'
import { fmtLift, liftBar } from '../lib/formato'
import { StoreProvider } from '../store/StoreProvider'
import { crearStoreFalso } from '../store/storeFalso'
import type { Snapshot } from '../store/tipos'
import { Componente, nombre } from './Terminaciones'

// Chart.js no pinta en jsdom: el componente se sustituye por un doble que guarda las props que recibe.
const graficos = vi.hoisted(() => ({ props: [] as Array<Record<string, any>> }))
vi.mock('../components/Chart', () => ({
  Chart: (props: Record<string, unknown>) => {
    graficos.props.push(props)
    return <div data-testid="grafico" role="img" aria-label={String(props.etiqueta)} />
  },
}))

const STATS: Stats = JSON.parse(readFileSync('fixtures/stats.json', 'utf-8'))
const STATS_BT: Stats = JSON.parse(readFileSync('fixtures/stats_con_backtests.json', 'utf-8'))
const SORTEOS: Sorteo[] = JSON.parse(readFileSync('fixtures/sorteos.json', 'utf-8')).data
const CATEGORIAS = ['extraordinario', 'gordito', 'miercolito', 'dominical'] // orden de primera aparición en la fixture

function montar(estado: Partial<Snapshot> = {}) {
  const store = crearStoreFalso({ activeTab: 'terminaciones' as never, stats: STATS, sorteos: SORTEOS, ready: true, ...estado })
  const vista = render(
    <StoreProvider store={store}>
      <Componente />
    </StoreProvider>,
  )
  return { store, ...vista }
}
const texto = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
const recomendadas = () => screen.getByRole('region', { name: 'Terminaciones recomendadas' })
const tarjetas = () => Array.from(recomendadas().querySelectorAll('.reco-card')) as HTMLElement[]
const nota = () => document.querySelector('.terminaciones-nota')
const tarjetaDe = (titulo: string) => screen.getByRole('heading', { name: titulo }).closest('.card') as HTMLElement
const filas = (el: Element) => Array.from(el.querySelectorAll('.bar-row')).map((r) => ({ etiqueta: texto(r.querySelector('.bar-label')), conteo: texto(r.querySelector('.bar-fill')), ancho: (r.querySelector('.bar-fill') as HTMLElement).style.width, clase: r.querySelector('.bar-fill')!.className }))
const ultimoGrafico = () => graficos.props.at(-1)!

beforeEach(() => {
  graficos.props.length = 0
})

describe('isla Terminaciones: estados', () => {
  it('se llama «terminaciones», como el data-tab de su pestaña', () => {
    expect(nombre).toBe('terminaciones')
  })

  it('sin estadísticas enseña el esqueleto de carga y ningún contenido', () => {
    montar({ stats: null })
    expect(screen.getByRole('status', { name: 'Cargando terminaciones' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Terminaciones recomendadas' })).toBeNull()
  })

  it('con la carga de estadísticas fallida dice que no se pudo y ofrece reintentar, sin esqueleto', () => {
    montar({ stats: null, errorStats: true })
    expect(screen.getByRole('alert').textContent).toContain('No se pudieron cargar las estadísticas.')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('con las estadísticas sin terminaciones no falla y avisa de que no hay recomendaciones', () => {
    montar({ stats: { ...STATS, endings: undefined as never, ml_endings: undefined as never, endings_by_category: undefined as never } })
    expect(texto(recomendadas())).toContain('Aún no hay terminaciones recomendadas.')
    expect(graficos.props).toHaveLength(0)
  })
})

describe('isla Terminaciones: selector de categoría', () => {
  it('es un tablist con «Todos» y una pestaña por categoría, en orden de aparición', () => {
    montar()
    const lista = screen.getByRole('tablist', { name: 'Categoría de las terminaciones recomendadas' })
    expect(within(lista).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Todos', 'Extraordinario', 'Gordito del Zodiaco', 'Miercolito', 'Dominical'])
    expect(within(lista).getByRole('tab', { name: 'Todos' }).getAttribute('aria-selected')).toBe('true')
  })

  it('sin sorteos cargados solo hay «Todos» y las recomendaciones generales siguen visibles', () => {
    montar({ sorteos: [], ready: false })
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Todos'])
    expect(tarjetas().length).toBeGreaterThan(0)
  })

  it('elegir una categoría la marca y cambia las recomendaciones a las suyas', async () => {
    montar()
    await userEvent.click(screen.getByRole('tab', { name: 'Miercolito' }))
    expect(screen.getByRole('tab', { name: 'Miercolito' }).getAttribute('aria-selected')).toBe('true')
    const esperadas = STATS.endings_by_category.miercolito!.recommendations.map((r) => r.ending)
    expect(tarjetas().map((t) => texto(t.querySelector('.lotto-balls')))).toEqual(esperadas)
  })

  it('con las flechas del teclado pasa de «Todos» a la primera categoría', async () => {
    montar()
    screen.getByRole('tab', { name: 'Todos' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Extraordinario' }))
    expect(screen.getByRole('tab', { name: 'Extraordinario' }).getAttribute('aria-selected')).toBe('true')
  })

  it('si al recargar desaparece la categoría elegida, vuelve a «Todos»', async () => {
    const { store } = montar()
    await userEvent.click(screen.getByRole('tab', { name: 'Gordito del Zodiaco' }))
    act(() => store.cambiar({ sorteos: SORTEOS.filter((s) => s.cat !== 'gordito') }))
    expect(screen.getByRole('tab', { name: 'Todos' }).getAttribute('aria-selected')).toBe('true')
    expect(texto(nota())).toContain('En las pruebas por categoría con sorteos reales')
  })
})

describe('isla Terminaciones: recomendaciones', () => {
  it('«Todos» en modo estadístico usa endings.recommendations, con rótulos de posición', () => {
    montar()
    const rec = STATS.endings.recommendations
    expect(tarjetas().map((t) => texto(t.querySelector('.lotto-balls')))).toEqual(rec.map((r) => r.ending))
    expect(tarjetas().map((t) => texto(t.querySelector('.reco-rank'))).slice(0, 4)).toEqual(['1ro Terminación', '2do Terminación', '3ro Terminación', '4to Terminación'])
    expect(texto(recomendadas())).toContain('Terminaciones recomendadas — 📊 Estadístico')
  })

  it('con más de 10 recomendaciones el rótulo sigue con «11to»', () => {
    const rec = Array.from({ length: 11 }, (_, i) => ({ confidence: 1, ending: `${Math.floor(i / 10)}${i % 10}`, lift: 1, score: 1 }))
    montar({ stats: { ...STATS, endings: { ...STATS.endings, recommendations: rec } } })
    expect(texto(tarjetas()[10]!.querySelector('.reco-rank'))).toBe('11to Terminación')
  })

  it('cada tarjeta muestra la confianza como «×N azar» con su barra', () => {
    montar()
    const primera = tarjetas()[0]!
    const r = STATS.endings.recommendations[0]!
    expect(texto(primera.querySelector('.reco-confidence'))).toBe(fmtLift(r.confidence))
    expect(primera.querySelector('.reco-confidence')?.getAttribute('title')).toBe('Veces más probable que una terminación al azar (×1.00 = azar)')
    expect((primera.querySelector('.conf-bar-fill') as HTMLElement).style.width).toBe(`${liftBar(r.confidence)}%`)
  })

  it('las esferas son doradas y medianas en modo estadístico', () => {
    montar()
    const bolas = tarjetas()[0]!.querySelector('.lotto-balls')!
    expect(bolas.classList.contains('lotto-balls-md')).toBe(true)
    expect(bolas.querySelector('.ball-gold')).toBeTruthy()
    expect(tarjetas()[0]!.classList.contains('reco-ml')).toBe(false)
  })

  it('en modo ML usa ml_endings, esferas verdes, la marca reco-ml y el rótulo de ML', () => {
    montar({ useML: true })
    expect(tarjetas().map((t) => texto(t.querySelector('.lotto-balls')))).toEqual(STATS.ml_endings.map((r) => r.ending))
    expect(tarjetas().every((t) => t.classList.contains('reco-ml') && t.querySelector('.ball-green'))).toBe(true)
    expect(texto(recomendadas())).toContain('Terminaciones recomendadas — 🤖 Machine Learning')
  })

  it('en modo ML la barra de confianza lleva el degradado verde y en estadístico no', () => {
    const { unmount } = montar({ useML: true })
    expect((tarjetas()[0]!.querySelector('.conf-bar-fill') as HTMLElement).style.background).toContain('linear-gradient')
    unmount()
    montar()
    expect((tarjetas()[0]!.querySelector('.conf-bar-fill') as HTMLElement).style.background).not.toContain('linear-gradient')
  })

  it('las pestañas de categoría controlan la región de recomendaciones', () => {
    montar()
    const region = recomendadas()
    expect(region.id).not.toBe('')
    expect(screen.getAllByRole('tab').every((t) => t.getAttribute('aria-controls') === region.id)).toBe(true)
  })

  it('en modo ML y con una categoría usa su ml_recommendations', async () => {
    montar({ useML: true })
    await userEvent.click(screen.getByRole('tab', { name: 'Dominical' }))
    expect(tarjetas().map((t) => texto(t.querySelector('.lotto-balls')))).toEqual(STATS.endings_by_category.dominical!.ml_recommendations.map((r) => r.ending))
  })

  it('cambiar el modo en el Store cambia las recomendaciones sin perder la categoría', async () => {
    const { store } = montar()
    await userEvent.click(screen.getByRole('tab', { name: 'Dominical' }))
    act(() => store.cambiar({ useML: true }))
    expect(screen.getByRole('tab', { name: 'Dominical' }).getAttribute('aria-selected')).toBe('true')
    expect(tarjetas().map((t) => texto(t.querySelector('.lotto-balls')))).toEqual(STATS.endings_by_category.dominical!.ml_recommendations.map((r) => r.ending))
  })

  it('cada terminación tiene su botón para copiarla, con el número en el nombre', () => {
    montar()
    const primera = STATS.endings.recommendations[0]!.ending
    expect(within(tarjetas()[0]!).getByRole('button', { name: `Copiar ${primera}` })).toBeTruthy()
  })

  it('una categoría de los sorteos sin terminaciones en las estadísticas no falla y no recomienda nada', async () => {
    montar({ stats: { ...STATS, endings_by_category: {} } })
    await userEvent.click(screen.getByRole('tab', { name: 'Miercolito' }))
    expect(tarjetas()).toHaveLength(0)
    expect(texto(recomendadas())).toContain('Aún no hay terminaciones recomendadas.')
  })
})

describe('isla Terminaciones: nota de la prueba hacia atrás', () => {
  it('con «Todos» avisa de que por categoría las terminaciones aciertan como el azar', () => {
    montar()
    expect(texto(nota())).toBe('ℹ En las pruebas por categoría con sorteos reales, las terminaciones aciertan como el azar. Elige una categoría para ver la suya.')
  })

  it('con una categoría con backtest explica los aciertos frente al azar', async () => {
    montar({ stats: STATS_BT })
    await userEvent.click(screen.getByRole('tab', { name: 'Dominical' }))
    expect(texto(nota())).toBe(
      'ℹ Prueba del método estadístico con los últimos 200 sorteos de Dominical, recomendando solo con los sorteos anteriores: 94 aciertos frente a 59.5 del azar; al menos 1 acierto en el 39% de los sorteos frente al 27.1% del azar.',
    )
  })

  it('en modo ML añade que el ML no tiene prueba propia', async () => {
    montar({ stats: STATS_BT, useML: true })
    await userEvent.click(screen.getByRole('tab', { name: 'Dominical' }))
    expect(texto(nota()).endsWith('al menos 1 acierto en el 39% de los sorteos frente al 27.1% del azar. El ML no tiene prueba propia aquí (ver Seguimiento).')).toBe(true)
  })

  it('con una categoría sin backtest avisa de la muestra pequeña con su número de terminaciones', async () => {
    const dominical = { ...STATS.endings_by_category.dominical!, backtest: null, total_endings: 42 }
    montar({ stats: { ...STATS, endings_by_category: { ...STATS.endings_by_category, dominical } } })
    await userEvent.click(screen.getByRole('tab', { name: 'Dominical' }))
    expect(texto(nota())).toBe('ℹ Dominical tiene muy pocos sorteos para comprobarlo (42 terminaciones): una cifra alta aquí es ruido de muestra pequeña.')
  })

  it('una categoría sin entrada en las estadísticas cuenta 0 terminaciones', async () => {
    montar({ stats: { ...STATS, endings_by_category: {} } })
    await userEvent.click(screen.getByRole('tab', { name: 'Gordito del Zodiaco' }))
    expect(texto(nota())).toBe('ℹ Gordito del Zodiaco tiene muy pocos sorteos para comprobarlo (0 terminaciones): una cifra alta aquí es ruido de muestra pequeña.')
  })

  it('la nota es una región viva (aria-live polite)', () => {
    montar()
    expect(nota()?.getAttribute('aria-live')).toBe('polite')
  })
})

describe('isla Terminaciones: gráficos de barras', () => {
  it('calientes y frías: una barra por terminación, ancho relativo al máximo y su clase', () => {
    montar()
    const hot = STATS.endings.hot_cold.hot
    const max = Math.max(...hot.map((h) => h.count), 1)
    const esperado = hot.map((h) => ({ etiqueta: h.ending, conteo: String(h.count), ancho: `${((h.count / max) * 100).toFixed(1).replace(/\.0$/, '')}%`, clase: 'bar-fill hot' }))
    expect(filas(tarjetaDe('Terminaciones Calientes').querySelector('.bar-chart')!)).toEqual(esperado)
    expect(filas(tarjetaDe('Terminaciones Frías').querySelector('.bar-chart')!).every((f) => f.clase === 'bar-fill cold')).toBe(true)
  })

  it('los tres tops por premio enseñan como mucho 10 barras, dorada, verde y morada', () => {
    const muchos = Array.from({ length: 14 }, (_, i) => ({ count: 20 - i, ending: `${Math.floor(i / 10)}${i % 10}` }))
    montar({ stats: { ...STATS, endings: { ...STATS.endings, by_prize: { primero: muchos, segundo: muchos.slice(0, 3), tercero: [] } } } })
    const [p1, p2, p3] = ['Top — 1er Premio', 'Top — 2do Premio', 'Top — 3er Premio'].map((t) => filas(tarjetaDe(t).querySelector('.bar-chart')!))
    expect(p1).toHaveLength(10)
    expect(p1!.every((f) => f.clase === 'bar-fill gold')).toBe(true)
    expect(p1![0]!.ancho).toBe('100%')
    expect(p2!.every((f) => f.clase === 'bar-fill green')).toBe(true)
    expect(p2).toHaveLength(3)
    expect(p3).toHaveLength(0)
  })

  it('con el conteo en 0 la barra no escribe número y con todo en 0 no divide por cero', () => {
    montar({ stats: { ...STATS, endings: { ...STATS.endings, hot_cold: { hot: [{ count: 0, ending: '00' }], cold: [] } } } })
    const [barra] = filas(tarjetaDe('Terminaciones Calientes').querySelector('.bar-chart')!)
    expect(barra!.ancho).toBe('0%')
    expect(barra!.conteo).toBe('0')
  })
})

describe('isla Terminaciones: mapa de calor', () => {
  const mapa = () => document.querySelector('.ending-heatmap') as HTMLElement
  const celdas = () => Array.from(mapa().querySelectorAll('.ending-cell')) as HTMLElement[]

  it('tiene 100 celdas de 00 a 99 con su conteo y su título', () => {
    montar()
    expect(celdas()).toHaveLength(100)
    const c = celdas()[37]!
    const v = STATS.endings.frequency['37'] ?? 0
    expect(c.title).toBe(`37: ${v} veces`)
    expect(texto(c)).toBe(`37${v}`)
  })

  it('la leyenda dice el máximo y las cabeceras van de x0 a x9 y de 0x a 9x', () => {
    montar()
    const max = Math.max(...Object.values(STATS.endings.frequency), 1)
    expect(texto(mapa().querySelector('.heatmap-legend'))).toBe(`Menor frec.Mayor frec. (máx: ${max})`)
    expect(mapa().querySelector('.heatmap-legend')?.getAttribute('aria-hidden')).toBe('true')
    expect(texto(mapa())).toContain('x0x1x2x3x4x5x6x7x8x9')
    expect(texto(mapa())).toContain('0x')
    expect(texto(mapa())).toContain('9x')
  })

  it('marca como pico (cell-peak) solo las celdas con al menos el 85 % del máximo', () => {
    const frecuencia: Record<string, number> = { '00': 100, '01': 85, '02': 84, '03': 10 }
    montar({ stats: { ...STATS, endings: { ...STATS.endings, frequency: frecuencia } } })
    const pico = celdas().filter((c) => c.classList.contains('cell-peak')).map((c) => c.title.split(':')[0])
    expect(pico).toEqual(['00', '01'])
  })

  it('el fondo crece con la intensidad y una celda sin datos cuenta 0', () => {
    montar({ stats: { ...STATS, endings: { ...STATS.endings, frequency: { '00': 10, '01': 5 } } } })
    expect(celdas()[0]!.style.background).toBe('rgba(212, 175, 55, 0.69)')
    expect(celdas()[1]!.style.background).toBe('rgba(212, 175, 55, 0.36)')
    expect(celdas()[2]!.style.background).toBe('rgba(212, 175, 55, 0.04)')
  })

  it('con el tema oscuro el texto es oscuro en celdas intensas y claro en las flojas', () => {
    montar({ stats: { ...STATS, endings: { ...STATS.endings, frequency: { '00': 10, '01': 1 } } } })
    expect(celdas()[0]!.style.color).toBe('rgb(10, 10, 15)')
    expect(celdas()[1]!.style.color).toBe('rgb(240, 236, 226)')
  })

  it('con el tema claro el texto es blanco en celdas intensas y oscuro en las flojas', () => {
    montar({ theme: 'light', stats: { ...STATS, endings: { ...STATS.endings, frequency: { '00': 10, '01': 1 } } } })
    expect(celdas()[0]!.style.color).toBe('rgb(255, 255, 255)')
    expect(celdas()[1]!.style.color).toBe('rgb(26, 22, 18)')
  })

  it('sin frecuencias no falla y la leyenda dice máx 1', () => {
    montar({ stats: { ...STATS, endings: { ...STATS.endings, frequency: {} } } })
    expect(celdas()).toHaveLength(100)
    expect(texto(mapa().querySelector('.heatmap-legend'))).toContain('(máx: 1)')
  })
})

describe('isla Terminaciones: tendencia mensual', () => {
  it('pinta un gráfico de líneas con un mes por etiqueta y una serie por terminación', () => {
    montar()
    const g = ultimoGrafico()
    expect(g.type).toBe('line')
    expect(g.etiqueta).toBe('Gráfico de tendencia de terminaciones')
    const datos = g.datos('dark')
    expect(datos.labels).toEqual(STATS.endings.trends.map((t) => t.month))
    const terminaciones = Object.keys(STATS.endings.trends[0]!.endings)
    expect(datos.datasets.map((d: any) => d.label)).toEqual(terminaciones)
    expect(datos.datasets[0].data).toEqual(STATS.endings.trends.map((t) => t.endings[terminaciones[0]!] || 0))
  })

  it('cada serie lleva su color, su relleno suave y el trazo de siempre', () => {
    montar()
    const series = ultimoGrafico().datos('dark').datasets as any[]
    const [d0, d1] = series
    expect(d0).toMatchObject({ borderColor: DIGIT_COLORS[0], backgroundColor: `${DIGIT_COLORS[0]}20`, tension: 0.4, borderWidth: 2, pointRadius: 3, pointHoverRadius: 6 })
    expect(d1.borderColor).toBe(DIGIT_COLORS[1])
    expect(d1.backgroundColor).toBe(`${DIGIT_COLORS[1]}20`)
    expect(series).toHaveLength(10) // 10 terminaciones: los colores no se repiten
  })

  it('las opciones son las de siempre con leyenda y dependen del tema', () => {
    montar()
    expect(ultimoGrafico().opciones('light')).toEqual(chartOptions('light'))
    expect(ultimoGrafico().opciones('dark')).toEqual(chartOptions('dark'))
  })

  it('sin tendencia la tarjeta sigue pero no se pinta el gráfico', () => {
    montar({ stats: { ...STATS, endings: { ...STATS.endings, trends: [] } } })
    expect(graficos.props).toHaveLength(0)
    expect(screen.getByRole('heading', { name: 'Tendencia de Terminaciones por Mes' })).toBeTruthy()
  })

  it('un mes sin la terminación cuenta 0 en esa serie', () => {
    const trends: Stats['endings']['trends'] = [
      { month: '2020-01', endings: { '12': 3, '34': 1 } },
      { month: '2020-02', endings: { '12': 2 } },
    ]
    montar({ stats: { ...STATS, endings: { ...STATS.endings, trends } } })
    expect(ultimoGrafico().datos('dark').datasets.map((d: any) => d.data)).toEqual([
      [3, 2],
      [1, 0],
    ])
  })
})
