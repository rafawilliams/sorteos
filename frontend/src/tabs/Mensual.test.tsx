import { readFileSync } from 'node:fs'
import { act, render, screen, within, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PerfilMensual, Stats } from '../api/types'
import { chartOptions, DIGIT_COLORS } from '../lib/chartOptions'
import { fmtLift, liftBar } from '../lib/formato'
import { StoreProvider } from '../store/StoreProvider'
import { crearStoreFalso } from '../store/storeFalso'
import { Componente, nombre } from './Mensual'

// Chart.js no pinta en jsdom: el componente se sustituye por un doble que guarda las props que recibe.
const graficos = vi.hoisted(() => ({ props: [] as Array<Record<string, any>> }))
vi.mock('../components/Chart', () => ({
  Chart: (props: Record<string, unknown>) => {
    graficos.props.push(props)
    return <div data-testid="grafico" role="img" aria-label={String(props.etiqueta)} />
  },
}))

const STATS: Stats = JSON.parse(readFileSync('fixtures/stats.json', 'utf-8'))
const MR = STATS.monthly_reco
const conReco = (parcial: Partial<Stats['monthly_reco']>): Stats => ({ ...STATS, monthly_reco: { ...MR, ...parcial } })
const perfil = (extra: Partial<PerfilMensual> = {}): PerfilMensual => ({ ...MR.monthly_profiles[0]!, ...extra })

function montar(stats: Stats | null = STATS) {
  const store = crearStoreFalso({ activeTab: 'mensual' as never, stats })
  const arbol = (
    <StoreProvider store={store}>
      <Componente />
    </StoreProvider>
  )
  const vista = render(arbol)
  return { store, arbol, ...vista }
}
const objetivo = () => screen.getByRole('region', { name: 'Recomendación para el próximo mes' })
const detalle = () => screen.getByRole('region', { name: 'Perfiles mensuales detallados' })
const tarjetas = () => Array.from(detalle().querySelectorAll(':scope > .card')) as HTMLElement[]
const ultimoGrafico = () => graficos.props.at(-1)!

beforeEach(() => {
  graficos.props.length = 0
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true })
})
afterEach(() => vi.restoreAllMocks())

describe('contrato y estados', () => {
  it('se llama «mensual» como el data-tab de la barra', () => {
    expect(nombre).toBe('mensual')
  })

  it('con `stats` nulo muestra su esqueleto y nada más', () => {
    montar(null)
    expect(screen.getByRole('status', { name: 'Cargando recomendación mensual' })).toBeInTheDocument()
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    expect(graficos.props).toHaveLength(0)
  })

  it('sin `monthly_reco` dice que aún no hay datos mensuales, sin romper', () => {
    montar({ ...STATS, monthly_reco: undefined as never })
    expect(screen.getByText('Aún no hay datos mensuales.')).toBeInTheDocument()
    expect(graficos.props).toHaveLength(0)
  })

  it('con `monthly_reco` nulo también', () => {
    montar({ ...STATS, monthly_reco: null as never })
    expect(screen.getByText('Aún no hay datos mensuales.')).toBeInTheDocument()
  })
})

describe('mes objetivo', () => {
  it('titula con el mes y el año y cuenta los sorteos históricos', () => {
    montar()
    expect(within(objetivo()).getByText(`📅 ${MR.target_month_name} ${MR.target_year}`)).toBeInTheDocument()
    expect(within(objetivo()).getByText(`${MR.target_draws_historical} sorteos históricos`)).toHaveClass('badge-gold')
  })

  it('explica en qué se basa, con los números históricos con separador de miles', () => {
    montar({ ...STATS, monthly_reco: { ...MR, target_numbers_historical: 9296 } })
    const parrafo = within(objetivo()).getByText(/Basado en/)
    expect(parrafo).toHaveTextContent(`Basado en ${(9296).toLocaleString()} números que salieron en ${MR.target_month_name} desde 1995.`)
    expect(parrafo.querySelectorAll('strong')).toHaveLength(2)
  })

  it('la tarjeta del mes objetivo lleva el borde dorado', () => {
    montar()
    // Estilo en línea, no calculado: jsdom no resuelve `var()` en `getComputedStyle`.
    expect((objetivo().querySelector('.card') as HTMLElement).style.border).toBe('2px solid var(--gold-400)')
  })

  it('lista cada recomendación con su puesto, sus esferas, su barra de confianza y su botón de copiar', () => {
    montar()
    const tarjetasReco = objetivo().querySelectorAll('.reco-card')
    expect(tarjetasReco).toHaveLength(MR.recommendations.length)
    const rotulos = Array.from(tarjetasReco).map((t) => t.querySelector('.reco-rank')!.textContent)
    expect(rotulos.slice(0, 3)).toEqual(['1RO RECOMENDADO', '2DO RECOMENDADO', '3RO RECOMENDADO'])
    if (rotulos.length > 3) expect(rotulos[3]).toBe('4TO RECOMENDADO')
    MR.recommendations.forEach((r, i) => {
      const t = tarjetasReco[i] as HTMLElement
      const esferas = within(t).getByLabelText(r.number)
      expect(esferas).toHaveClass('lotto-balls', 'lotto-balls-lg')
      expect(esferas.querySelectorAll('.ball-gold')).toHaveLength(r.number.length)
      expect(within(t).getByRole('button', { name: `Copiar ${r.number}` })).toBeInTheDocument()
      const confianza = t.querySelector('.reco-confidence') as HTMLElement
      expect(confianza).toHaveAttribute('title', 'Veces más probable que un número al azar (×1.00 = azar)')
      expect(confianza).toHaveTextContent(fmtLift(r.confidence))
      expect((confianza.querySelector('.conf-bar-fill') as HTMLElement).style.width).toBe(`${liftBar(r.confidence)}%`)
    })
  })

  it('a partir del quinto puesto el rótulo es «5TO», «6TO»…', () => {
    const seis = Array.from({ length: 6 }, (_, i) => ({ ...MR.recommendations[0]!, number: String(1000 + i) }))
    montar(conReco({ recommendations: seis }))
    const rotulos = Array.from(objetivo().querySelectorAll('.reco-rank')).map((r) => r.textContent)
    expect(rotulos).toEqual(['1RO RECOMENDADO', '2DO RECOMENDADO', '3RO RECOMENDADO', '4TO RECOMENDADO', '5TO RECOMENDADO', '6TO RECOMENDADO'])
  })

  it('sin recomendaciones no hay rejilla de recomendaciones', () => {
    montar(conReco({ recommendations: [] }))
    expect(objetivo().querySelector('.reco-grid')).toBeNull()
    expect(within(objetivo()).getByText(/📅/)).toBeInTheDocument()
  })

  it('«Copiar» de una recomendación copia ese número', async () => {
    montar()
    await act(async () => void fireEvent.click(within(objetivo()).getByRole('button', { name: `Copiar ${MR.recommendations[0]!.number}` })))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(MR.recommendations[0]!.number)
  })

  it('un nombre de mes con marcado se muestra como texto', () => {
    montar(conReco({ target_month_name: '<img src=x onerror=alert(1)>' }))
    expect(objetivo().querySelector('img')).toBeNull()
    // El mes sale dos veces (título y párrafo): las dos como texto.
    expect(within(objetivo()).getAllByText(/<img src=x onerror=alert\(1\)>/)).toHaveLength(2)
  })
})

describe('ventaja de dígitos por posición', () => {
  const tabla = () => screen.getByRole('img', { name: 'Tabla de ventaja de dígitos por posición' })
  const celdasDe = (fila: number) => Array.from(tabla().querySelectorAll('tbody tr')[fila]!.querySelectorAll('td'))
  /** El fondo que el navegador deja para ese color, calculado con la misma fórmula que el código antiguo. */
  const fondo = (color: string) => {
    const sonda = document.createElement('td')
    sonda.style.background = color
    return sonda.style.background
  }

  it('la tarjeta lleva su título, su insignia y su explicación', () => {
    montar()
    expect(screen.getByText('Ventaja de Dígitos por Posición')).toBeInTheDocument()
    expect(screen.getByText('vs Promedio')).toHaveClass('badge-gold')
    expect(screen.getByText(/Diferencia porcentual de cada dígito/)).toBeInTheDocument()
  })

  it('pinta 4 filas (P1-P4) de 10 dígitos con su cabecera 0-9', () => {
    montar()
    expect(Array.from(tabla().querySelectorAll('thead th')).map((t) => t.textContent)).toEqual(['Pos', ...'0123456789'.split('')])
    expect(tabla().querySelectorAll('tbody tr')).toHaveLength(4)
    expect([0, 1, 2, 3].map((p) => celdasDe(p)[0]!.textContent)).toEqual(['P1', 'P2', 'P3', 'P4'])
    expect(celdasDe(0)).toHaveLength(11)
  })

  it('los positivos llevan «+» y fondo verde; los negativos, fondo rojo; el cero, transparente', () => {
    const fila = { '0': 1.3, '1': -5.2, '2': 0, '3': 12 }
    montar(conReco({ digit_advantage: [fila, fila, fila, fila] as never }))
    const [, c0, c1, c2, c3, c4] = celdasDe(0)
    expect(c0!.textContent).toBe('+1.3')
    expect(c1!.textContent).toBe('-5.2')
    expect(c2!.textContent).toBe('0')
    expect(c0!.style.background).toBe(fondo(`rgba(74,222,128,${Math.min(Math.abs(1.3) / 5, 1) * 0.7})`))
    expect(c1!.style.background).toBe(fondo(`rgba(248,113,113,${Math.min(Math.abs(-5.2) / 5, 1) * 0.7})`))
    expect(c2!.style.background).toBe(fondo('transparent'))
    expect(c3!.textContent).toBe('+12')
    expect(c3!.style.background).toBe(fondo('rgba(74,222,128,0.7)')) // tope: la intensidad no pasa de 0.7
    expect(c4!.textContent).toBe('0') // un dígito que no llega cuenta como 0
  })

  it('las celdas de valor llevan la fuente monoespaciada y el tamaño de antes', () => {
    montar()
    // Estilo en línea, no calculado: jsdom convierte `rem` a píxeles en `getComputedStyle`.
    const valor = celdasDe(0)[1]!
    expect(valor.style.textAlign).toBe('center')
    expect(valor.style.fontSize).toBe('0.8rem')
    expect(valor.style.fontFamily).toContain('JetBrains Mono')
    expect(celdasDe(0)[0]!.style.fontWeight).toBe('700')
  })

  it.each([0, 3, 5])('con %i filas en vez de 4 no se pinta la tabla (la tarjeta sí)', (n) => {
    montar(conReco({ digit_advantage: MR.digit_advantage.slice(0, n).concat(Array(Math.max(0, n - 4)).fill({})) }))
    expect(screen.queryByRole('img', { name: 'Tabla de ventaja de dígitos por posición' })?.querySelector('table') ?? null).toBeNull()
    expect(screen.getByText('Ventaja de Dígitos por Posición')).toBeInTheDocument()
  })
})

describe('gráfico del perfil de los 12 meses', () => {
  it('la tarjeta lleva su título y su insignia y el gráfico recibe su etiqueta accesible', () => {
    montar()
    expect(screen.getByText('Perfil de los 12 Meses')).toBeInTheDocument()
    expect(screen.getByText('Histórico')).toHaveClass('badge-purple')
    expect(ultimoGrafico().type).toBe('bar')
    expect(screen.getByRole('img', { name: 'Gráfico comparativo de perfil mensual' })).toBeInTheDocument()
  })

  it('las etiquetas son las tres primeras letras de cada mes', () => {
    montar()
    expect(ultimoGrafico().datos('dark').labels).toEqual(MR.monthly_profiles.map((p) => p.name.substring(0, 3)))
  })

  it('hay un conjunto de datos por dígito, con su color y la media de las 4 posiciones redondeada a un decimal', () => {
    montar()
    const d = ultimoGrafico().datos('dark')
    expect(d.datasets).toHaveLength(10)
    d.datasets.forEach((ds: any, dig: number) => {
      expect(ds.label).toBe(`Dígito ${dig}`)
      expect(ds.backgroundColor).toBe(`${DIGIT_COLORS[dig]}99`)
      expect(ds.borderColor).toBe(DIGIT_COLORS[dig])
      expect(ds.borderWidth).toBe(1)
      expect(ds.borderRadius).toBe(3)
      expect(ds.data).toEqual(
        MR.monthly_profiles.map((p) => Math.round(((p.position_freq.reduce((s, pf) => s + (pf[String(dig)] ?? 0), 0)) / 4) * 10) / 10),
      )
    })
  })

  it('un mes sin `position_freq` cuenta 0 en cada dígito', () => {
    const perfiles = MR.monthly_profiles.map((p, i) => (i === 0 ? { ...p, position_freq: [] } : p))
    montar(conReco({ monthly_profiles: perfiles }))
    ultimoGrafico().datos('dark').datasets.forEach((ds: any) => expect(ds.data[0]).toBe(0))
  })

  it('las barras van apiladas en los dos ejes y con leyenda; el resto es chartOptions del tema', () => {
    montar()
    for (const tema of ['dark', 'light'] as const) {
      const o = ultimoGrafico().opciones(tema)
      expect(o.scales.x.stacked).toBe(true)
      expect(o.scales.y.stacked).toBe(true)
      expect(o.plugins.legend.display).toBe(true)
      const base = chartOptions(tema) as any
      expect(o.scales.x.ticks).toEqual(base.scales.x.ticks)
      expect(o.scales.y.grid).toEqual(base.scales.y.grid)
      expect(o.plugins.tooltip).toEqual(base.plugins.tooltip)
    }
  })

  it('las opciones no comparten objeto entre llamadas (apilar un gráfico no toca a otro)', () => {
    montar()
    const a = ultimoGrafico().opciones('dark')
    const b = ultimoGrafico().opciones('dark')
    expect(a).not.toBe(b)
    expect((chartOptions('dark') as any).scales.x.stacked).toBeUndefined()
  })

  it('`datos` y `opciones` conservan su identidad entre repintados (si no, el gráfico se recrea cada vez)', () => {
    const { store, rerender } = montar()
    const pintadas = graficos.props.length
    const { datos, opciones } = ultimoGrafico()
    // Un elemento NUEVO cada vez: con el mismo elemento React no vuelve a pintar y la prueba no probaría nada.
    for (let i = 0; i < 2; i += 1) {
      rerender(
        <StoreProvider store={store}>
          <Componente />
        </StoreProvider>,
      )
    }
    expect(graficos.props.length, 'el repintado no llegó a ejecutar la isla').toBeGreaterThan(pintadas)
    expect(ultimoGrafico().datos).toBe(datos)
    expect(ultimoGrafico().opciones).toBe(opciones)
  })

  it('con 11 perfiles en vez de 12 no hay gráfico (la tarjeta sí)', () => {
    montar(conReco({ monthly_profiles: MR.monthly_profiles.slice(0, 11) }))
    expect(screen.getByText('Perfil de los 12 Meses')).toBeInTheDocument()
    expect(screen.queryByTestId('grafico')).not.toBeInTheDocument()
  })
})

describe('perfiles mensuales detallados', () => {
  it('hay una tarjeta por mes, con su nombre', () => {
    montar()
    expect(tarjetas()).toHaveLength(12)
    expect(tarjetas().map((t) => t.querySelector('.card-title')!.textContent)).toEqual(MR.monthly_profiles.map((p) => p.name))
  })

  it('el mes objetivo lleva borde dorado e insignia «Próximo»; los demás, ninguno', () => {
    montar()
    const marcadas = tarjetas().filter((t) => t.querySelector('.badge-gold'))
    expect(marcadas).toHaveLength(1)
    expect(marcadas[0]!.querySelector('.card-title')).toHaveTextContent(MR.target_month_name)
    expect(within(marcadas[0]!).getByText('Próximo')).toBeInTheDocument()
    expect(marcadas[0]!.style.border).toBe('2px solid var(--gold-400)')
    tarjetas().filter((t) => t !== marcadas[0]).forEach((t) => expect((t as HTMLElement).style.border).toBe(''))
  })

  it('cuenta sorteos y números, estos con separador de miles', () => {
    montar(conReco({ monthly_profiles: MR.monthly_profiles.map((p, i) => (i === 0 ? { ...p, draws: 52, numbers: 9296 } : p)) }))
    expect(within(tarjetas()[0]!).getByText(`52 sorteos · ${(9296).toLocaleString()} números`)).toBeInTheDocument()
  })

  it('lista como máximo 5 números calientes y 5 terminaciones, con su cuenta', () => {
    const hot = Array.from({ length: 7 }, (_, i) => ({ number: String(1000 + i), count: i + 1 }))
    const top_endings = Array.from({ length: 6 }, (_, i) => ({ ending: String(10 + i), count: i + 1 }))
    montar(conReco({ monthly_profiles: MR.monthly_profiles.map((p, i) => (i === 0 ? { ...p, hot, top_endings } : p)) }))
    const t = tarjetas()[0]!
    expect(within(t).getByText('Top números:')).toBeInTheDocument()
    expect(within(t).getByText('Top terminaciones:')).toBeInTheDocument()
    const grupos = Array.from(t.querySelectorAll(':scope > div')).filter((d) => d.querySelector('span'))
    const textos = grupos.map((g) => Array.from(g.querySelectorAll('span')).map((s) => s.textContent))
    expect(textos).toEqual([
      ['1000 (1)', '1001 (2)', '1002 (3)', '1003 (4)', '1004 (5)'],
      ['10 (1)', '11 (2)', '12 (3)', '13 (4)', '14 (5)'],
    ])
  })

  it('sin números calientes o sin terminaciones no aparece su bloque', () => {
    montar(conReco({ monthly_profiles: MR.monthly_profiles.map((p, i) => (i === 0 ? { ...p, hot: [], top_endings: [] } : p)) }))
    expect(within(tarjetas()[0]!).queryByText('Top números:')).not.toBeInTheDocument()
    expect(within(tarjetas()[0]!).queryByText('Top terminaciones:')).not.toBeInTheDocument()
    expect(within(tarjetas()[1]!).getByText('Top números:')).toBeInTheDocument()
  })

  it('sin perfiles la región existe y está vacía', () => {
    montar(conReco({ monthly_profiles: [] }))
    expect(detalle()).toBeEmptyDOMElement()
  })

  it('un nombre de mes con marcado se muestra como texto', () => {
    montar(conReco({ monthly_profiles: MR.monthly_profiles.map((p, i) => (i === 0 ? { ...p, name: '<b>Enero</b>' } : p)) }))
    expect(detalle().querySelector('b')).toBeNull()
    expect(within(detalle()).getByText('<b>Enero</b>')).toBeInTheDocument()
  })
})

describe('la pestaña vive con el Store', () => {
  it('cambiar de pestaña y volver no rompe nada ni recrea el gráfico', () => {
    const { store } = montar()
    const antes = graficos.props.length
    act(() => store.cambiar({ activeTab: 'gaps' }))
    act(() => store.cambiar({ activeTab: 'mensual' as never }))
    expect(graficos.props.length).toBe(antes)
    expect(screen.getByText('Perfil de los 12 Meses')).toBeInTheDocument()
  })

  it('cuando llegan los datos pasa del esqueleto a la pestaña', () => {
    const { store } = montar(null)
    expect(screen.getByRole('status', { name: 'Cargando recomendación mensual' })).toBeInTheDocument()
    act(() => store.cambiar({ stats: STATS }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(objetivo()).toBeInTheDocument()
  })
})
