import { readFileSync } from 'node:fs'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { DecenaCategoria, Stats } from '../api/types'
import { fmtLift, formatDate } from '../lib/formato'
import { StoreProvider } from '../store/StoreProvider'
import { crearStoreFalso } from '../store/storeFalso'
import { Componente, nombre } from './Decenas'

const STATS: Stats = JSON.parse(readFileSync('fixtures/stats.json', 'utf-8'))
const BASE = STATS.decena_recomendada.dominical!
const BACKTEST = { acierto_pct: 31.5, acierto_pct_azar: 29.2, aciertos: 63, sorteos: 200 }

const decena = (extra: Partial<DecenaCategoria> = {}): DecenaCategoria => ({ ...BASE, ...extra })
const conDecenas = (d: Stats['decena_recomendada']): Stats => ({ ...STATS, decena_recomendada: d })

function montar(stats: Stats | null = STATS) {
  const store = crearStoreFalso({ activeTab: 'decenas' as never, stats })
  return render(
    <StoreProvider store={store}>
      <Componente />
    </StoreProvider>,
  )
}
const region = () => screen.getByRole('region', { name: 'Decenas recomendadas' })
const tarjetas = () => Array.from(region().querySelectorAll('.decena-card')) as HTMLElement[]
const texto = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()

describe('isla Decenas', () => {
  it('se llama «decenas», como el data-tab de su pestaña', () => {
    expect(nombre).toBe('decenas')
  })

  it('sin estadísticas enseña el esqueleto de carga', () => {
    montar(null)
    expect(screen.getByRole('status', { name: 'Cargando decenas' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Decenas recomendadas' })).toBeNull()
  })

  it('sin ninguna categoría dice que faltan datos', () => {
    montar(conDecenas({}))
    expect(texto(region())).toBe('No hay suficientes datos para análisis de decenas.')
  })

  it('con decena_recomendada ausente tampoco falla', () => {
    montar({ ...STATS, decena_recomendada: undefined as never })
    expect(texto(region())).toBe('No hay suficientes datos para análisis de decenas.')
  })

  it('pinta una tarjeta por categoría, en el orden que llegan, con su nombre', () => {
    montar()
    expect(tarjetas().map((t) => texto(t.querySelector('.card-title')))).toEqual(['Dominical', 'Extraordinario', 'Gordito del Zodiaco', 'Miercolito'])
    expect(tarjetas().every((t) => t.classList.contains('reveal') && t.classList.contains('card'))).toBe(true)
  })

  it('el rótulo del método traduce triple, pair y frecuencia y deja pasar uno desconocido', () => {
    const d = decena()
    montar(conDecenas({ dominical: { ...d, method: 'triple' }, miercolito: { ...d, method: 'pair' }, gordito: { ...d, method: 'frecuencia' }, extraordinario: { ...d, method: 'fallback' as never } }))
    expect(tarjetas().map((t) => texto(t.querySelector('.card-badge')))).toEqual(['Patrón de 3 sorteos', 'Patrón de 2 sorteos', 'Frecuencia general', 'Frecuencia general'])
  })

  it('un método desconocido se enseña tal cual (y «toString» no es un método)', () => {
    montar(conDecenas({ dominical: decena({ method: 'raro' as never }), gordito: decena({ method: 'toString' as never }) }))
    expect(tarjetas().map((t) => texto(t.querySelector('.card-badge')))).toEqual(['raro', 'toString'])
  })

  it('el triángulo lleva los 3 últimos en sus esquinas y la recomendada en el centro', () => {
    montar(conDecenas({ dominical: decena({ last_3: ['3', '8', '0'], recommended: '5' }) }))
    const textos = Array.from(tarjetas()[0]!.querySelectorAll('svg text')).map((t) => ({ x: t.getAttribute('x'), y: t.getAttribute('y'), v: t.textContent }))
    expect(textos).toEqual([
      { x: '100', y: '16', v: '0' }, // arriba: el más reciente (last_3[2])
      { x: '15', y: '181', v: '3' }, // izquierda: el más antiguo (last_3[0])
      { x: '185', y: '181', v: '8' }, // derecha: el del medio (last_3[1])
      { x: '100', y: '128', v: '5' }, // centro: la recomendada
    ])
    expect(texto(tarjetas()[0]!.querySelector('.triangle-label'))).toBe('DECENAS')
  })

  it('enseña la decena recomendada y la confianza como «×N azar»', () => {
    montar(conDecenas({ dominical: decena({ recommended: '7', confidence: 1.24 }) }))
    const t = tarjetas()[0]!
    expect(texto(t.querySelector('.decena-rec-label'))).toBe('Decena recomendada')
    expect(texto(t.querySelector('.decena-rec-number'))).toBe('7')
    expect(t.querySelector('.decena-confidence')?.getAttribute('title')).toBe('Veces más probable que una decena al azar (×1.00 = azar)')
    expect(texto(t.querySelector('.decena-confidence'))).toContain(fmtLift(1.24))
  })

  it('con patrón (triple o pair) cuenta los sorteos coincidentes', () => {
    montar(conDecenas({ dominical: decena({ method: 'triple', match_count: 37, muestras: 111, confidence: 1.5 }) }))
    expect(texto(tarjetas()[0]!.querySelector('.decena-confidence'))).toBe(`${fmtLift(1.5)} · 37 sorteos coincidentes · 111 decenas`)
  })

  it('con frecuencia general explica que ningún patrón llega al mínimo', () => {
    montar(conDecenas({ dominical: decena({ method: 'frecuencia', match_count: 12, minimo: 25, muestras: 450, confidence: 1.1 }) }))
    expect(texto(tarjetas()[0]!.querySelector('.decena-confidence'))).toBe(`${fmtLift(1.1)} · 12 sorteos (ningún patrón llega a 25 coincidencias) · 450 decenas`)
  })

  it('el método «fallback» también cuenta como frecuencia general', () => {
    montar(conDecenas({ dominical: decena({ method: 'fallback' as never, match_count: 8, minimo: 20, muestras: 300, confidence: 1.1 }) }))
    expect(texto(tarjetas()[0]!.querySelector('.decena-confidence'))).toBe(`${fmtLift(1.1)} · 8 sorteos (ningún patrón llega a 20 coincidencias) · 300 decenas`)
  })

  it('sin mínimo usa 20 y sin muestras enseña «—»', () => {
    montar(conDecenas({ dominical: decena({ method: 'frecuencia', minimo: undefined as never, muestras: undefined as never, match_count: 3 }) }))
    const linea = texto(tarjetas()[0]!.querySelector('.decena-confidence'))
    expect(linea).toContain('(ningún patrón llega a 20 coincidencias)')
    expect(linea.endsWith('· — decenas')).toBe(true)
  })

  it('con backtest enseña la prueba frente al azar', () => {
    montar(conDecenas({ dominical: decena({ backtest: BACKTEST }) }))
    expect(texto(tarjetas()[0]!.querySelectorAll('.decena-confidence')[1] ?? null)).toBe(
      'ℹ Prueba con los últimos 200 sorteos: la decena recomendada salió en algún premio el 31.5% de las veces, frente al 29.2% del azar.',
    )
  })

  it('sin backtest dice que hay muy pocos sorteos', () => {
    montar(conDecenas({ dominical: decena({ backtest: null }) }))
    expect(texto(tarjetas()[0]!.querySelectorAll('.decena-confidence')[1] ?? null)).toBe('ℹ Muy pocos sorteos desde 1995 para comprobarlo.')
  })

  it('lista los últimos 3 sorteos con su fecha formateada', () => {
    montar(conDecenas({ dominical: decena({ last_3: ['3', '8', '0'], last_3_fechas: ['2019-08-25', '2019-09-08', '2019-09-22'] }) }))
    const filas = Array.from(tarjetas()[0]!.querySelectorAll('.decena-last3-row')).map((f) => [texto(f.querySelector('.decena-fecha')), texto(f.querySelector('.decena-val'))])
    expect(filas).toEqual([
      [formatDate('2019-08-25'), '3'],
      [formatDate('2019-09-08'), '8'],
      [formatDate('2019-09-22'), '0'],
    ])
  })

  it('la distribución dibuja una barra por dígito con su ancho relativo al máximo', () => {
    montar(conDecenas({ dominical: decena({ recommended: '1', follower_distribution: { '0': 10, '1': 20, '2': 5, '3': 0 } }) }))
    const barras = Array.from(tarjetas()[0]!.querySelectorAll('.decena-dist .bar-row')).map((r) => ({
      digito: texto(r.querySelector('.bar-label')),
      ancho: (r.querySelector('.bar-fill') as HTMLElement).style.width,
      conteo: texto(r.querySelector('.bar-fill')),
      clase: r.querySelector('.bar-fill')!.className,
    }))
    expect(barras).toEqual([
      { digito: '0', ancho: '50%', conteo: '10', clase: 'bar-fill green' },
      { digito: '1', ancho: '100%', conteo: '20', clase: 'bar-fill gold' },
      { digito: '2', ancho: '25%', conteo: '5', clase: 'bar-fill green' },
      { digito: '3', ancho: '0%', conteo: '', clase: 'bar-fill green' },
    ])
  })

  it('con una distribución vacía o toda en cero no divide por cero', () => {
    montar(conDecenas({ dominical: decena({ follower_distribution: {} }), gordito: decena({ follower_distribution: { '0': 0, '1': 0 } }) }))
    expect(tarjetas()[0]!.querySelectorAll('.decena-dist .bar-row')).toHaveLength(0)
    const anchos = Array.from(tarjetas()[1]!.querySelectorAll('.decena-dist .bar-fill')).map((b) => (b as HTMLElement).style.width)
    expect(anchos).toEqual(['0%', '0%'])
  })

  it('con last_3 incompleto no falla', () => {
    montar(conDecenas({ dominical: decena({ last_3: ['4'], last_3_fechas: ['2019-08-25'] }) }))
    expect(within(tarjetas()[0]!).getByText('DECENAS')).toBeTruthy()
    expect(tarjetas()[0]!.querySelectorAll('.decena-last3-row')).toHaveLength(1)
  })

  it('no inventa texto en HTML: un método con marcado se enseña como texto', () => {
    montar(conDecenas({ dominical: decena({ method: '<img src=x onerror=alert(1)>' as never }) }))
    expect(region().querySelector('img')).toBeNull()
    expect(texto(tarjetas()[0]!.querySelector('.card-badge'))).toBe('<img src=x onerror=alert(1)>')
  })
})
