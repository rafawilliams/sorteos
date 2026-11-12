import { readFileSync } from 'node:fs'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { RecomendacionNumero, Sorteo, Stats } from '../api/types'
import { fmtLift, liftBar } from '../lib/formato'
import { StoreProvider } from '../store/StoreProvider'
import { crearStoreFalso } from '../store/storeFalso'
import type { Snapshot } from '../store/tipos'
import { Componente, nombre } from './Predicciones'

const STATS: Stats = JSON.parse(readFileSync('fixtures/stats.json', 'utf-8'))
const SORTEOS: Sorteo[] = JSON.parse(readFileSync('fixtures/sorteos.json', 'utf-8')).data

const rec = (number: string, confidence = 1.5): RecomendacionNumero => ({ number, confidence, lift: confidence, score: 1 }) as RecomendacionNumero
const lista = (...numeros: string[]) => numeros.map((n, i) => rec(n, 2 - i * 0.1))

function montar(estado: Partial<Snapshot> = {}) {
  const store = crearStoreFalso({ activeTab: 'predicciones' as never, stats: STATS, sorteos: SORTEOS, ready: true, ...estado })
  const vista = render(
    <StoreProvider store={store}>
      <Componente />
    </StoreProvider>,
  )
  return { store, ...vista }
}
const texto = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
const region = () => screen.getByRole('region', { name: 'Números recomendados' })
const tarjetas = () => Array.from(region().querySelectorAll('.reco-card')) as HTMLElement[]
const numeros = () => tarjetas().map((t) => t.querySelector('.lotto-balls')?.getAttribute('aria-label'))
const premio = (nombre: string) => screen.getByRole('tab', { name: nombre })
const categoria = (nombre: string) => screen.getByRole('tab', { name: nombre })
const conStats = (parcial: Partial<Stats>): Stats => ({ ...STATS, ...parcial })

describe('isla Predicciones: estructura', () => {
  it('se llama «predicciones», como el data-tab de su pestaña', () => {
    expect(nombre).toBe('predicciones')
  })

  it('los selectores y el interruptor se ven aunque aún no haya estadísticas, y las recomendaciones enseñan el esqueleto', () => {
    montar({ stats: null })
    expect(screen.getByRole('tablist', { name: 'Seleccionar premio' })).toBeTruthy()
    expect(screen.getByRole('tablist', { name: 'Filtrar por categoría' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Alternar entre modelo ML y Estadístico' })).toBeTruthy()
    expect(screen.getByRole('status', { name: 'Cargando recomendaciones' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Números recomendados' })).toBeNull()
  })

  it('el selector de premio tiene 1er, 2do y 3er Premio con las clases de siempre', () => {
    const { container } = montar()
    const lista = screen.getByRole('tablist', { name: 'Seleccionar premio' })
    expect(lista.className).toBe('prize-tabs')
    expect(within(lista).getAllByRole('tab').map((t) => t.textContent)).toEqual(['1er Premio', '2do Premio', '3er Premio'])
    expect(container.querySelectorAll('.prize-tab')).toHaveLength(3)
    expect(lista.style.marginBottom).toBe('0px')
  })

  it('el premio elegido sale del Store', () => {
    montar({ prize: 'tercero' })
    expect(premio('3er Premio').getAttribute('aria-selected')).toBe('true')
    expect(premio('1er Premio').getAttribute('aria-selected')).toBe('false')
  })

  it('el selector de categoría tiene «Todos» y las categorías de los sorteos, en orden de aparición', () => {
    montar()
    const lista = screen.getByRole('tablist', { name: 'Filtrar por categoría' })
    expect(within(lista).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Todos', 'Extraordinario', 'Gordito del Zodiaco', 'Miercolito', 'Dominical'])
    expect(categoria('Todos').getAttribute('aria-selected')).toBe('true')
  })

  it('sin sorteos cargados solo está «Todos»', () => {
    montar({ sorteos: [], ready: false })
    expect(within(screen.getByRole('tablist', { name: 'Filtrar por categoría' })).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Todos'])
  })

  it('los dos selectores controlan la región de recomendaciones', () => {
    montar()
    const id = region().id
    expect(id).not.toBe('')
    expect(screen.getAllByRole('tab').every((t) => t.getAttribute('aria-controls') === id)).toBe(true)
  })

  it('la región de recomendaciones es una región viva', () => {
    montar()
    expect(region().getAttribute('aria-live')).toBe('polite')
  })
})

describe('isla Predicciones: qué recomendaciones enseña', () => {
  it('«Todos» y estadístico: las del premio elegido', () => {
    const stats = conStats({ prizes: { primero: { ...STATS.prizes.primero, recommendations: lista('1111', '2222') } as never, segundo: { ...STATS.prizes.segundo, recommendations: lista('3333') } as never, tercero: {} } })
    montar({ stats, prize: 'segundo' })
    expect(numeros()).toEqual(['3333'])
  })

  it('cambiar de premio en el Store cambia las recomendaciones', () => {
    const stats = conStats({ prizes: { primero: { ...STATS.prizes.primero, recommendations: lista('1111') } as never, segundo: { ...STATS.prizes.segundo, recommendations: lista('3333') } as never, tercero: {} } })
    const { store } = montar({ stats, prize: 'primero' })
    expect(numeros()).toEqual(['1111'])
    act(() => store.cambiar({ prize: 'segundo' }))
    expect(numeros()).toEqual(['3333'])
  })

  it('si el premio no tiene recomendaciones propias usa las generales', () => {
    const stats = conStats({ prizes: { primero: {}, segundo: {}, tercero: {} }, recommendations: lista('7777') })
    montar({ stats, prize: 'tercero' })
    expect(numeros()).toEqual(['7777'])
  })

  it('«Todos» y ML: las ML del premio; si faltan, las ML generales', () => {
    const stats = conStats({ ml_prizes: { primero: [rec('4444')] as never }, ml_recommendations: [rec('5555')] as never })
    const { store } = montar({ stats, useML: true, prize: 'primero' })
    expect(numeros()).toEqual(['4444'])
    act(() => store.cambiar({ prize: 'segundo' }))
    expect(numeros()).toEqual(['5555'])
  })

  it('con ML y una lista vacía para el premio, no vuelve a las generales (una lista vacía cuenta como lista)', () => {
    const stats = conStats({ ml_prizes: { primero: [] }, ml_recommendations: [rec('5555')] as never })
    montar({ stats, useML: true, prize: 'primero' })
    expect(numeros()).toEqual([])
    expect(texto(region())).toContain('No hay suficientes datos para esta combinación.')
  })

  it('una categoría y estadístico: by_category[cat].recommendations', async () => {
    montar()
    await userEvent.click(categoria('Dominical'))
    expect(numeros()).toEqual(STATS.by_category.dominical!.recommendations.map((r) => r.number))
  })

  it('una categoría y ML: by_category[cat].ml_recommendations', async () => {
    montar({ useML: true })
    await userEvent.click(categoria('Miercolito'))
    expect(numeros()).toEqual(STATS.by_category.miercolito!.ml_recommendations.map((r) => r.number))
  })

  it('una categoría sin entrada en by_category (el extraordinario sin premios de 4 cifras) enseña el aviso de pocos datos', async () => {
    montar({ stats: conStats({ by_category: {} }) })
    await userEvent.click(categoria('Extraordinario'))
    expect(tarjetas()).toHaveLength(0)
    expect(texto(region())).toContain('No hay suficientes datos para esta combinación.')
  })

  it('el premio elegido no cambia las recomendaciones de una categoría', async () => {
    const { store } = montar()
    await userEvent.click(categoria('Dominical'))
    const antes = numeros()
    act(() => store.cambiar({ prize: 'tercero' }))
    expect(numeros()).toEqual(antes)
  })

  it('si al recargar desaparece la categoría elegida, vuelve a «Todos»', async () => {
    const { store } = montar()
    await userEvent.click(categoria('Gordito del Zodiaco'))
    act(() => store.cambiar({ sorteos: SORTEOS.filter((s) => s.cat !== 'gordito') }))
    expect(categoria('Todos').getAttribute('aria-selected')).toBe('true')
    expect(numeros()).toEqual(STATS.prizes.primero.recommendations!.map((r) => r.number))
  })
})

describe('isla Predicciones: tarjetas', () => {
  it('la cabecera dice el premio y el modo', () => {
    montar({ prize: 'segundo' })
    expect(texto(region().firstElementChild)).toBe('Recomendaciones para 2do Premio — 📊 Estadístico')
  })

  it('con una categoría la cabecera dice «cualquier premio de 4 cifras»', async () => {
    montar()
    await userEvent.click(categoria('Dominical'))
    expect(texto(region().firstElementChild)).toBe('Recomendaciones para cualquier premio de 4 cifras — 📊 Estadístico')
  })

  it('con ML la cabecera dice «🤖 Machine Learning»', () => {
    montar({ useML: true, prize: 'tercero' })
    expect(texto(region().firstElementChild)).toBe('Recomendaciones para 3er Premio — 🤖 Machine Learning')
  })

  it('rótulos de posición: 1ro a 5to y después «6to»', () => {
    montar({ stats: conStats({ prizes: { primero: { ...STATS.prizes.primero, recommendations: lista('1000', '2000', '3000', '4000', '5000', '6000') } as never, segundo: {}, tercero: {} } }) })
    expect(tarjetas().map((t) => texto(t.querySelector('.reco-rank')))).toEqual(['1ro Recomendado', '2do Recomendado', '3ro Recomendado', '4to Recomendado', '5to Recomendado', '6to Recomendado'])
  })

  it('estadístico: esferas doradas grandes, sin la marca reco-ml', () => {
    montar()
    const t = tarjetas()[0]!
    expect(t.classList.contains('reco-ml')).toBe(false)
    expect(t.querySelector('.lotto-balls')!.classList.contains('lotto-balls-lg')).toBe(true)
    expect(t.querySelector('.ball-gold')).toBeTruthy()
  })

  it('ML: esferas verdes y la marca reco-ml', () => {
    montar({ useML: true })
    expect(tarjetas().length).toBeGreaterThan(0)
    expect(tarjetas().every((t) => t.classList.contains('reco-ml') && t.querySelector('.ball-green'))).toBe(true)
  })

  it('la confianza se enseña como «×N azar», con su ayuda y su barra', () => {
    montar({ stats: conStats({ prizes: { primero: { ...STATS.prizes.primero, recommendations: [rec('1234', 1.68)] } as never, segundo: {}, tercero: {} } }) })
    const t = tarjetas()[0]!
    expect(texto(t.querySelector('.reco-confidence'))).toBe(fmtLift(1.68))
    expect(t.querySelector('.reco-confidence')?.getAttribute('title')).toBe('Veces más probable que un número al azar (×1.00 = azar)')
    expect((t.querySelector('.conf-bar-fill') as HTMLElement).style.width).toBe(`${liftBar(1.68)}%`)
  })

  it('en ML la barra de confianza lleva el degradado verde y en estadístico no', () => {
    const { unmount } = montar({ useML: true })
    expect((tarjetas()[0]!.querySelector('.conf-bar-fill') as HTMLElement).style.background).toContain('linear-gradient')
    unmount()
    montar()
    expect((tarjetas()[0]!.querySelector('.conf-bar-fill') as HTMLElement).style.background).not.toContain('linear-gradient')
  })

  it('cada número tiene su botón para copiarlo, con el número en el nombre', () => {
    montar({ stats: conStats({ prizes: { primero: { ...STATS.prizes.primero, recommendations: [rec('0074')] } as never, segundo: {}, tercero: {} } }) })
    expect(within(tarjetas()[0]!).getByRole('button', { name: 'Copiar 0074' })).toBeTruthy()
  })

  it('el número se enseña tal como llega, sin rellenar con ceros', () => {
    montar({ stats: conStats({ prizes: { primero: { ...STATS.prizes.primero, recommendations: [rec('74')] } as never, segundo: {}, tercero: {} } }) })
    expect(numeros()).toEqual(['74'])
  })

  it('sin ninguna recomendación enseña el aviso y no la cabecera', () => {
    montar({ stats: conStats({ prizes: { primero: {}, segundo: {}, tercero: {} }, recommendations: [] }) })
    expect(texto(region())).toBe('No hay suficientes datos para esta combinación.')
  })
})

describe('isla Predicciones: interacción', () => {
  it('un clic en un premio lo manda al Store', async () => {
    const { store } = montar()
    await userEvent.click(premio('2do Premio'))
    expect(store.llamadas).toEqual([{ accion: 'setPrize', args: ['segundo'] }])
    expect(premio('2do Premio').getAttribute('aria-selected')).toBe('true')
  })

  it('con las flechas pasa de premio y lo manda al Store', async () => {
    const { store } = montar()
    premio('1er Premio').focus()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    expect(store.llamadas.map((l) => l.args[0])).toEqual(['segundo', 'tercero'])
    expect(document.activeElement).toBe(premio('3er Premio'))
  })

  it('con las flechas pasa de categoría', async () => {
    montar()
    categoria('Todos').focus()
    await userEvent.keyboard('{End}')
    expect(document.activeElement).toBe(categoria('Dominical'))
    expect(categoria('Dominical').getAttribute('aria-selected')).toBe('true')
  })

  it('el interruptor cambia el modo en el Store y las recomendaciones', async () => {
    const { store } = montar()
    await userEvent.click(screen.getByRole('button', { name: 'Alternar entre modelo ML y Estadístico' }))
    expect(store.llamadas.at(-1)).toEqual({ accion: 'setUseML', args: [true] })
    expect(tarjetas().every((t) => t.classList.contains('reco-ml'))).toBe(true)
  })

  it('elegir categoría no cambia el premio del Store', async () => {
    const { store } = montar()
    await userEvent.click(categoria('Dominical'))
    expect(store.llamadas).toEqual([])
  })
})
