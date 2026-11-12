import { readFileSync } from 'node:fs'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Backtesting } from '../api/types'
import { chartOptions } from '../lib/chartOptions'
import { StoreProvider } from '../store/StoreProvider'
import { crearStoreFalso } from '../store/storeFalso'
import { Componente, nombre } from './Precision'

const control = vi.hoisted(() => ({ getBacktesting: vi.fn() }))
vi.mock('../api/client', () => ({ getBacktesting: control.getBacktesting }))

// Chart.js no pinta en jsdom: el componente se sustituye por un doble que guarda las props que recibe.
const graficos = vi.hoisted(() => ({ props: [] as Array<Record<string, any>> }))
vi.mock('../components/Chart', () => ({
  Chart: (props: Record<string, unknown>) => {
    graficos.props.push(props)
    return <div data-testid="grafico" role="img" aria-label={String(props.etiqueta)} />
  },
}))

const leer = (f: string): Backtesting => JSON.parse(readFileSync(`fixtures/${f}.json`, 'utf-8'))
const NORMAL = leer('backtesting')
const POCOS = leer('backtesting_pocos_sorteos')
const SIN_MODELO = leer('backtesting_sin_modelo')
const ok = (data: Backtesting) => ({ ok: true as const, data })
const ml = NORMAL.ml as Extract<Backtesting['ml'], { per_position: unknown }>
const conMl = (parcial: Record<string, unknown>): Backtesting => ({ ...NORMAL, ml: { ...ml, ...parcial } as never })
function diferida<T>() {
  let resolver!: (v: T) => void
  const promesa = new Promise<T>((r) => (resolver = r))
  return { promesa, resolver }
}

type Tienda = ReturnType<typeof crearStoreFalso>
function montar({ activa = true, estricto = false } = {}) {
  const store = crearStoreFalso({ activeTab: activa ? ('precision' as never) : 'gaps' })
  const arbol = (
    <StoreProvider store={store}>
      <Componente />
    </StoreProvider>
  )
  const vista = render(estricto ? <StrictMode>{arbol}</StrictMode> : arbol)
  return { store, ...vista }
}
const activar = (store: Tienda) => act(() => store.cambiar({ activeTab: 'precision' as never }))
const desactivar = (store: Tienda) => act(() => store.cambiar({ activeTab: 'gaps' }))
const region = (nombreRegion: string) => screen.getByRole('region', { name: nombreRegion })
const valorDe = (rotulo: string) => screen.getByText(rotulo).previousElementSibling as HTMLElement
const tarjetaPos = (i: number) => within(region('Precisión por posición de dígito')).getAllByText(/\(pos \d\)/)[i]!.closest('.card') as HTMLElement
const tarjetaMetodo = (titulo: string) => screen.getByText(titulo).closest('.card') as HTMLElement
/** El ancho que el navegador deja para ese porcentaje: jsdom redondea `49.00000000000001%` a `49%`, como la hoja de estilos. */
const anchoNormalizado = (porcentaje: number) => {
  const sonda = document.createElement('div')
  sonda.style.width = `${porcentaje}%`
  return sonda.style.width
}

beforeEach(() => {
  control.getBacktesting.mockReset()
  control.getBacktesting.mockResolvedValue(ok(NORMAL))
  graficos.props.length = 0
})
afterEach(() => vi.restoreAllMocks())

describe('carga al activarse la pestaña', () => {
  it('se llama «precision» como el data-tab de la barra', () => {
    expect(nombre).toBe('precision')
  })

  it('no pide nada mientras la pestaña no es la activa', () => {
    montar({ activa: false })
    expect(control.getBacktesting).not.toHaveBeenCalled()
  })

  it('al pasar a ser la activa pide los últimos 500 sorteos, una vez', async () => {
    const { store } = montar({ activa: false })
    activar(store)
    await screen.findByText('ML Top-1 Precisión')
    expect(control.getBacktesting).toHaveBeenCalledTimes(1)
    expect(control.getBacktesting).toHaveBeenCalledWith(500)
  })

  it('con la pestaña ya activa al montar, también pide', async () => {
    montar()
    await screen.findByText('ML Top-1 Precisión')
    expect(control.getBacktesting).toHaveBeenCalledTimes(1)
  })

  it('no depende de `stats`: funciona con `stats` nulo', async () => {
    const { store } = montar()
    expect(store.getSnapshot().stats).toBeNull()
    await screen.findByText('ML Top-1 Precisión')
  })

  it('con datos ya cargados, volver a la pestaña no vuelve a pedir (como `backtestData` en app.js)', async () => {
    const { store } = montar()
    await screen.findByText('ML Top-1 Precisión')
    desactivar(store)
    activar(store)
    activar(store)
    expect(control.getBacktesting).toHaveBeenCalledTimes(1)
    expect(screen.getByText('ML Top-1 Precisión')).toBeInTheDocument()
  })

  it('tras un fallo, volver a la pestaña lo reintenta (como app.js, que no guardaba nada si fallaba)', async () => {
    control.getBacktesting.mockResolvedValueOnce({ ok: false, mensaje: 'Sin conexión.' }).mockResolvedValue(ok(NORMAL))
    const { store } = montar()
    await screen.findByRole('alert')
    desactivar(store)
    activar(store)
    await screen.findByText('ML Top-1 Precisión')
    expect(control.getBacktesting).toHaveBeenCalledTimes(2)
  })

  it('en modo estricto la activación pide una sola vez', async () => {
    montar({ estricto: true })
    await screen.findByText('ML Top-1 Precisión')
    expect(control.getBacktesting).toHaveBeenCalledTimes(1)
  })
})

describe('carga, error y reintento', () => {
  it('mientras calcula muestra el esqueleto «Calculando backtesting»', async () => {
    const d = diferida<ReturnType<typeof ok>>()
    control.getBacktesting.mockReturnValue(d.promesa)
    montar()
    expect(await screen.findByRole('status', { name: 'Calculando backtesting' })).toBeInTheDocument()
    await act(async () => d.resolver(ok(NORMAL)))
    expect(screen.queryByRole('status', { name: 'Calculando backtesting' })).not.toBeInTheDocument()
  })

  it('un error muestra el mensaje y «Reintentar»; no deja una página vacía como app.js', async () => {
    control.getBacktesting.mockResolvedValue({ ok: false, mensaje: 'No se pudo conectar.' })
    montar()
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('No se pudo cargar la precisión. No se pudo conectar.')
    expect(screen.queryByText('ML Top-1 Precisión')).not.toBeInTheDocument()
  })

  it('«Reintentar» vuelve a pedir y devuelve el foco a la región', async () => {
    control.getBacktesting.mockResolvedValueOnce({ ok: false, mensaje: 'Fallo.' }).mockResolvedValue(ok(NORMAL))
    montar()
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(screen.getByRole('region', { name: 'Precisión histórica' })).toHaveFocus()
    await screen.findByText('ML Top-1 Precisión')
    expect(control.getBacktesting).toHaveBeenCalledTimes(2)
  })

  it('una respuesta vieja que llega tarde no pisa a la más reciente', async () => {
    const lenta = diferida<ReturnType<typeof ok>>()
    control.getBacktesting.mockReturnValueOnce(lenta.promesa).mockResolvedValue(ok(conMl({ avg_top1_accuracy: 11.1 })))
    const { store } = montar({ activa: false })
    activar(store)
    desactivar(store)
    activar(store)
    await screen.findByText('11.1%')
    await act(async () => lenta.resolver(ok(conMl({ avg_top1_accuracy: 99.9 }))))
    expect(screen.getByText('11.1%')).toBeInTheDocument()
    expect(screen.queryByText('99.9%')).not.toBeInTheDocument()
  })
})

describe('resumen', () => {
  it('muestra las cuatro cifras con sus etiquetas', async () => {
    montar()
    await screen.findByText('ML Top-1 Precisión')
    expect(valorDe('ML Top-1 Precisión')).toHaveTextContent(`${ml.avg_top1_accuracy}%`)
    expect(valorDe('ML Top-3 Precisión')).toHaveTextContent(`${ml.avg_top3_accuracy}%`)
    expect(valorDe('ML Lift vs Azar')).toHaveTextContent(`${ml.avg_lift_top1}x`)
    expect(valorDe('Sorteos Evaluados')).toHaveTextContent(String(ml.total_evaluated))
    expect(region('Resumen de precisión').querySelectorAll('.stat-card')).toHaveLength(4)
  })

  it('cada cifra va en un solo nodo de texto (nodos partidos dan anchos distintos en Chromium)', async () => {
    montar()
    await screen.findByText('ML Top-1 Precisión')
    for (const rotulo of ['ML Top-1 Precisión', 'ML Top-3 Precisión', 'ML Lift vs Azar', 'Sorteos Evaluados']) {
      expect(valorDe(rotulo).childNodes).toHaveLength(1)
    }
  })

  it('un valor ausente o cero se muestra con raya, como `||` en app.js; los sorteos evaluados, con 0', async () => {
    control.getBacktesting.mockResolvedValue(ok(conMl({ avg_top1_accuracy: 0, avg_top3_accuracy: undefined, avg_lift_top1: 0, total_evaluated: undefined })))
    montar()
    await screen.findByText('ML Top-1 Precisión')
    expect(valorDe('ML Top-1 Precisión')).toHaveTextContent('—%')
    expect(valorDe('ML Top-3 Precisión')).toHaveTextContent('—%')
    expect(valorDe('ML Lift vs Azar')).toHaveTextContent('—x')
    expect(valorDe('Sorteos Evaluados')).toHaveTextContent('0')
  })
})

describe('precisión por posición', () => {
  it('hay una tarjeta por posición, con su nombre y su lift', async () => {
    montar()
    await screen.findByText('ML Top-1 Precisión')
    const nombres = ['Millares (pos 0)', 'Centenas (pos 1)', 'Decenas (pos 2)', 'Unidades (pos 3)']
    nombres.forEach((n, i) => {
      const t = tarjetaPos(i)
      expect(within(t).getByText(n)).toBeInTheDocument()
      expect(within(t).getByText(`${ml.per_position[i]!.lift_top1}x`)).toHaveClass('card-badge')
    })
  })

  it.each([
    [1.2, 'var(--accent-green)'],
    [1.5, 'var(--accent-green)'],
    [1.0, 'var(--gold-300)'],
    [1.19, 'var(--gold-300)'],
    [0.99, 'var(--accent-hot)'],
    [0, 'var(--accent-hot)'],
  ])('un lift de %s se pinta con %s', async (lift, color) => {
    const pos = ml.per_position.map((p, i) => (i === 0 ? { ...p, lift_top1: lift } : p))
    control.getBacktesting.mockResolvedValue(ok(conMl({ per_position: pos })))
    montar()
    await screen.findByText('ML Top-1 Precisión')
    expect(within(tarjetaPos(0)).getByText(`${lift}x`).style.color).toBe(color)
  })

  it('el fondo del distintivo no se escribe: en app.js era `var(--…)20`, CSS inválido que el navegador descartaba', async () => {
    montar()
    await screen.findByText('ML Top-1 Precisión')
    const insignia = within(tarjetaPos(0)).getByText(`${ml.per_position[0]!.lift_top1}x`)
    expect(insignia.style.background).toBe('')
    expect(insignia.getAttribute('style') ?? '').not.toMatch(/background/)
  })

  it('las barras Top-1 y Top-3 miden su valor sobre 25 y sobre 60, y no pasan del 100 %', async () => {
    const pos = ml.per_position.map((p, i) => (i === 0 ? { ...p, top1_accuracy: 12.5, top3_accuracy: 30 } : i === 1 ? { ...p, top1_accuracy: 80, top3_accuracy: 99 } : p))
    control.getBacktesting.mockResolvedValue(ok(conMl({ per_position: pos })))
    montar()
    await screen.findByText('ML Top-1 Precisión')
    const anchos = (i: number) => [within(tarjetaPos(i)).getAllByText(/^Top-[13]$/)].map(() => Array.from(tarjetaPos(i).querySelectorAll<HTMLElement>('.bar-fill')).map((b) => b.style.width))[0]
    expect(anchos(0)).toEqual(['50%', '50%'])
    expect(anchos(1)).toEqual(['100%', '100%'])
  })

  it('la marca del azar está en el 40 % de la barra Top-1 (10 sobre 25) y en el 50 % de la Top-3 (30 sobre 60)', async () => {
    montar()
    await screen.findByText('ML Top-1 Precisión')
    const t = tarjetaPos(0)
    const marca10 = t.querySelector<HTMLElement>('[title="Azar: 10%"]')!
    const marca30 = t.querySelector<HTMLElement>('[title="Azar: 30%"]')!
    expect(marca10.style.left).toBe('40%')
    expect(marca30.style.left).toBe('50%')
    expect(marca10.style.width).toBe('2px')
    expect(marca10.style.height).toBe('100%')
  })

  it('cada fila lleva su porcentaje y al final «Prob. prom. dígito real»', async () => {
    montar()
    await screen.findByText('ML Top-1 Precisión')
    const t = tarjetaPos(0)
    expect(within(t).getByText(`${ml.per_position[0]!.top1_accuracy}%`)).toBeInTheDocument()
    expect(within(t).getByText(`${ml.per_position[0]!.top3_accuracy}%`)).toBeInTheDocument()
    expect(t).toHaveTextContent(`Prob. prom. dígito real: ${ml.per_position[0]!.avg_prob_actual}%`)
  })

  it('sin `per_position` no hay tarjetas y la región existe', async () => {
    control.getBacktesting.mockResolvedValue(ok(conMl({ per_position: undefined })))
    montar()
    await screen.findByText('ML Top-1 Precisión')
    expect(region('Precisión por posición de dígito')).toBeEmptyDOMElement()
  })
})

describe('ML frente a Estadístico', () => {
  it('la tarjeta de ML tiene una barra por posición con su valor dentro y una de terminaciones', async () => {
    montar()
    await screen.findByText('ML Top-1 Precisión')
    const t = tarjetaMetodo('🤖 Machine Learning')
    const filas = Array.from(t.querySelectorAll('.bar-row'))
    expect(filas.map((f) => f.querySelector('.bar-label')!.textContent)).toEqual(['P0', 'P1', 'P2', 'P3', 'Term'])
    ml.per_position.forEach((p, i) => {
      const relleno = filas[i]!.querySelector<HTMLElement>('.bar-fill')!
      expect(relleno).toHaveClass('green')
      expect(relleno.textContent).toBe(`${p.top1_accuracy}%`)
      expect(relleno.style.width).toBe(anchoNormalizado(Math.min((p.top1_accuracy / 20) * 100, 100)))
    })
    const term = filas[4]!.querySelector<HTMLElement>('.bar-fill')!
    expect(term).toHaveClass('purple')
    expect(term.textContent).toBe(`${ml.ending_top10_hit_rate}%`)
    expect(term.style.width).toBe(anchoNormalizado(Math.min((ml.ending_top10_hit_rate / 20) * 100, 100)))
  })

  it('sin `ending_top10_hit_rate` no hay barra «Term»', async () => {
    control.getBacktesting.mockResolvedValue(ok(conMl({ ending_top10_hit_rate: undefined })))
    montar()
    await screen.findByText('ML Top-1 Precisión')
    expect(within(tarjetaMetodo('🤖 Machine Learning')).queryByText('Term')).not.toBeInTheDocument()
  })

  it('un 0 % de terminaciones sí se dibuja (undefined y 0 no son lo mismo)', async () => {
    control.getBacktesting.mockResolvedValue(ok(conMl({ ending_top10_hit_rate: 0 })))
    montar()
    await screen.findByText('ML Top-1 Precisión')
    expect(within(tarjetaMetodo('🤖 Machine Learning')).getByText('Term')).toBeInTheDocument()
  })

  it('la tarjeta Estadístico tiene una barra dorada por posición', async () => {
    montar()
    await screen.findByText('ML Top-1 Precisión')
    const t = tarjetaMetodo('📊 Estadístico')
    const st = (NORMAL.statistical as { per_position: Array<{ top1_accuracy: number }> }).per_position
    const rellenos = Array.from(t.querySelectorAll<HTMLElement>('.bar-fill'))
    expect(rellenos).toHaveLength(st.length)
    rellenos.forEach((r, i) => {
      expect(r).toHaveClass('gold')
      expect(r.textContent).toBe(`${st[i]!.top1_accuracy}%`)
      expect(r.style.width).toBe(anchoNormalizado(Math.min((st[i]!.top1_accuracy / 20) * 100, 100)))
    })
  })

  it('con las barras por encima del 20 % no se pasan del 100 %', async () => {
    const pos = ml.per_position.map((p) => ({ ...p, top1_accuracy: 55 }))
    control.getBacktesting.mockResolvedValue(ok(conMl({ per_position: pos })))
    montar()
    await screen.findByText('ML Top-1 Precisión')
    tarjetaMetodo('🤖 Machine Learning').querySelectorAll<HTMLElement>('.bar-fill.green').forEach((b) => expect(b.style.width).toBe('100%'))
  })

  it('si gana el Estadístico, «Mejor» va en su tarjeta y la de ML lleva raya', async () => {
    montar() // fixture: ml_better = false, hay datos de los dos
    await screen.findByText('ML Top-1 Precisión')
    expect(within(tarjetaMetodo('📊 Estadístico')).getByText('Mejor')).toHaveClass('badge-gold')
    expect(within(tarjetaMetodo('🤖 Machine Learning')).getByText('—')).toHaveClass('badge-green')
  })

  it('si gana ML, «Mejor» va en la tarjeta de ML', async () => {
    control.getBacktesting.mockResolvedValue(ok({ ...NORMAL, comparison: { ...NORMAL.comparison, ml_better: true } }))
    montar()
    await screen.findByText('ML Top-1 Precisión')
    expect(within(tarjetaMetodo('🤖 Machine Learning')).getByText('Mejor')).toHaveClass('badge-green')
    expect(within(tarjetaMetodo('📊 Estadístico')).getByText('—')).toHaveClass('badge-gold')
  })
})

describe('sin modelo y con pocos sorteos', () => {
  it('sin modelo la API dice `ml_better: true`, pero no se corona a ML: ninguna tarjeta lleva «Mejor»', async () => {
    expect(SIN_MODELO.comparison.ml_better, 'la fixture dejó de reproducir el caso').toBe(true)
    control.getBacktesting.mockResolvedValue(ok(SIN_MODELO))
    montar()
    await screen.findByText('ML Top-1 Precisión')
    expect(screen.queryByText('Mejor')).not.toBeInTheDocument()
  })

  it('sin modelo la tarjeta de ML lo dice y el resumen muestra rayas; el Estadístico sigue ahí', async () => {
    control.getBacktesting.mockResolvedValue(ok(SIN_MODELO))
    montar()
    await screen.findByText('ML Top-1 Precisión')
    expect(within(tarjetaMetodo('🤖 Machine Learning')).getByText('Sin modelo entrenado.')).toBeInTheDocument()
    expect(valorDe('ML Top-1 Precisión')).toHaveTextContent('—%')
    expect(valorDe('Sorteos Evaluados')).toHaveTextContent('0')
    expect(tarjetaMetodo('📊 Estadístico').querySelectorAll('.bar-fill')).toHaveLength(4)
    expect(screen.queryByTestId('grafico')).not.toBeInTheDocument()
  })

  it('con ML pero sin Estadístico (pocos primeros premios) la tarjeta Estadístico lo dice y nadie lleva «Mejor»', async () => {
    control.getBacktesting.mockResolvedValue(ok({ ...NORMAL, statistical: {} as never, comparison: { ...NORMAL.comparison, ml_better: false } }))
    montar()
    await screen.findByText('ML Top-1 Precisión')
    expect(within(tarjetaMetodo('📊 Estadístico')).getByText('Sin datos suficientes.')).toBeInTheDocument()
    expect(within(tarjetaMetodo('🤖 Machine Learning')).queryByText('Sin modelo entrenado.')).not.toBeInTheDocument()
    expect(screen.queryByText('Mejor')).not.toBeInTheDocument()
    expect(tarjetaMetodo('📊 Estadístico').querySelectorAll('.bar-fill')).toHaveLength(0)
  })

  it('con pocos sorteos (ML y Estadístico vacíos) dice que aún no hay datos y no pinta tarjetas vacías', async () => {
    control.getBacktesting.mockResolvedValue(ok(POCOS))
    montar()
    expect(await screen.findByText('Aún no hay suficientes sorteos para calcular la precisión.')).toBeInTheDocument()
    expect(screen.queryByText('ML Top-1 Precisión')).not.toBeInTheDocument()
    expect(screen.queryByText('🤖 Machine Learning')).not.toBeInTheDocument()
    expect(screen.getByText('¿Cómo interpretarlo?')).toBeInTheDocument()
  })

  it('una respuesta sin `ml` ni `statistical` ni `comparison` tampoco rompe la pantalla', async () => {
    control.getBacktesting.mockResolvedValue(ok({} as Backtesting))
    montar()
    expect(await screen.findByText('Aún no hay suficientes sorteos para calcular la precisión.')).toBeInTheDocument()
  })
})

describe('gráfico de tendencia mensual', () => {
  const ultimoGrafico = () => graficos.props.at(-1)!

  it('la tarjeta lleva su título y su insignia y el gráfico, su etiqueta accesible', async () => {
    montar()
    await screen.findByText('ML Top-1 Precisión')
    expect(screen.getByText('Precisión Mensual (Top-1 por Posición)')).toBeInTheDocument()
    expect(screen.getByText('Tendencia')).toHaveClass('badge-green')
    expect(ultimoGrafico().type).toBe('line')
    expect(screen.getByRole('img', { name: 'Gráfico de precisión mensual' })).toBeInTheDocument()
  })

  it('las etiquetas son los meses y hay dos series reales y dos líneas de azar', async () => {
    montar()
    await screen.findByText('ML Top-1 Precisión')
    const d = ultimoGrafico().datos('dark')
    expect(d.labels).toEqual(ml.rolling_accuracy.map((r) => r.month))
    expect(d.datasets.map((s: any) => s.label)).toEqual(['Top-1 Promedio', 'Top-3 Promedio', 'Azar Top-1 (10%)', 'Azar Top-3 (30%)'])
    expect(d.datasets[0].data).toEqual(ml.rolling_accuracy.map((r) => r.top1_avg))
    expect(d.datasets[1].data).toEqual(ml.rolling_accuracy.map((r) => r.top3_avg))
    expect(d.datasets[2].data).toEqual(ml.rolling_accuracy.map(() => 10))
    expect(d.datasets[3].data).toEqual(ml.rolling_accuracy.map(() => 30))
  })

  it('cada serie lleva los colores y el trazo de app.js', async () => {
    montar()
    await screen.findByText('ML Top-1 Precisión')
    const [t1, t3, a1, a3] = ultimoGrafico().datos('dark').datasets
    expect(t1).toMatchObject({ borderColor: '#ffd700', backgroundColor: 'rgba(255,215,0,0.1)', tension: 0.4, borderWidth: 2, pointRadius: 3, fill: true })
    expect(t3).toMatchObject({ borderColor: '#34d399', backgroundColor: 'rgba(52,211,153,0.1)', tension: 0.4, borderWidth: 2, pointRadius: 3, fill: true })
    expect(a1).toMatchObject({ borderColor: 'rgba(255,77,77,0.5)', borderDash: [6, 4], borderWidth: 1, pointRadius: 0, fill: false })
    expect(a3).toMatchObject({ borderColor: 'rgba(255,77,77,0.3)', borderDash: [6, 4], borderWidth: 1, pointRadius: 0, fill: false })
  })

  it('las opciones son las de `chartOptions` de cada tema', async () => {
    montar()
    await screen.findByText('ML Top-1 Precisión')
    for (const tema of ['dark', 'light'] as const) expect(ultimoGrafico().opciones(tema)).toEqual(chartOptions(tema))
  })

  it('`datos` y `opciones` conservan su identidad entre repintados (si no, el gráfico se recrea cada vez)', async () => {
    const { store, rerender } = montar()
    await screen.findByText('ML Top-1 Precisión')
    const pintadas = graficos.props.length
    const { datos, opciones } = ultimoGrafico()
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

  it('sin serie mensual no hay gráfico y el resto de la pantalla sigue', async () => {
    control.getBacktesting.mockResolvedValue(ok(conMl({ rolling_accuracy: [] })))
    montar()
    await screen.findByText('ML Top-1 Precisión')
    expect(screen.queryByTestId('grafico')).not.toBeInTheDocument()
    expect(screen.getByText('Precisión Mensual (Top-1 por Posición)')).toBeInTheDocument()
  })
})

describe('cómo interpretarlo', () => {
  it('lleva su título, su insignia, la explicación y la advertencia', async () => {
    montar()
    await screen.findByText('ML Top-1 Precisión')
    expect(screen.getByText('¿Cómo interpretarlo?')).toBeInTheDocument()
    expect(screen.getByText('Info')).toHaveClass('badge-gold')
    const tarjeta = screen.getByText('¿Cómo interpretarlo?').closest('.card')!
    expect(tarjeta).toHaveTextContent('El baseline aleatorio para cada posición es 10% (1 de 10 dígitos).')
    expect(tarjeta).toHaveTextContent('Top-1 = ¿el dígito más probable acertó?')
    expect(tarjeta).toHaveTextContent('Top-3 = ¿el dígito real estaba entre los 3 más probables?')
    expect(tarjeta).toHaveTextContent('⚠ Nota: Estas métricas son evaluaciones in-sample. La lotería es un juego de azar puro — ningún modelo puede predecir con certeza.')
    expect(Array.from(tarjeta.querySelectorAll('strong')).map((s) => s.textContent)).toEqual(['baseline aleatorio', 'Top-1', 'Top-3'])
  })

  it('los títulos de sección y las regiones son los de antes', async () => {
    montar()
    await screen.findByText('ML Top-1 Precisión')
    expect(screen.getByRole('heading', { name: 'Precisión por Posición' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'ML vs Estadístico' })).toBeInTheDocument()
    expect(region('Comparación ML vs Estadístico')).toBeInTheDocument()
  })
})
