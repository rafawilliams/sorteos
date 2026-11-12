import { readFileSync } from 'node:fs'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Comparacion, ComparacionNumero } from '../api/types'
import { chartOptions } from '../lib/chartOptions'
import { StoreProvider } from '../store/StoreProvider'
import { crearStoreFalso } from '../store/storeFalso'
import { Componente, nombre } from './Comparador'

const control = vi.hoisted(() => ({ comparar: vi.fn() }))
vi.mock('../api/client', () => ({ comparar: control.comparar }))

// Chart.js no pinta en jsdom: el componente se sustituye por un doble que guarda las props que recibe.
const graficos = vi.hoisted(() => ({ props: [] as Array<Record<string, unknown>> }))
vi.mock('../components/Chart', () => ({
  Chart: (props: Record<string, unknown>) => {
    graficos.props.push(props)
    return <div data-testid="grafico" role="img" aria-label={String(props.etiqueta)} />
  },
}))

const FIXTURE: Comparacion = JSON.parse(readFileSync('fixtures/comparar.json', 'utf-8'))
const SIN_APARICIONES: Comparacion = JSON.parse(readFileSync('fixtures/comparar_sin_apariciones.json', 'utf-8'))
const ok = (data: Comparacion) => ({ ok: true as const, data })
const numeroDe = (number: string, extra: Partial<ComparacionNumero> = {}): ComparacionNumero => ({
  ...FIXTURE.numbers[0]!, number, ...extra,
})
const respuestaPara = (...numeros: string[]): Comparacion => ({ ...FIXTURE, numbers: numeros.map((n) => numeroDe(n)) })
function diferida<T>() {
  let resolver!: (v: T) => void
  const promesa = new Promise<T>((r) => (resolver = r))
  return { promesa, resolver }
}

function montar(estricto = false) {
  const store = crearStoreFalso({ activeTab: 'comparador' })
  const arbol = (
    <StoreProvider store={store}>
      <Componente />
    </StoreProvider>
  )
  return { store, ...render(estricto ? <StrictMode>{arbol}</StrictMode> : arbol) }
}

const entrada = () => screen.getByRole('textbox', { name: 'Agregar número a comparar' }) as HTMLInputElement
const agregar = (texto: string) => {
  fireEvent.change(entrada(), { target: { value: texto } })
  fireEvent.click(screen.getByRole('button', { name: '+ Agregar' }))
}
const avisos = (store: ReturnType<typeof crearStoreFalso>) => store.llamadas.filter((l) => l.accion === 'toast').map((l) => l.args)
const etiquetas = () => Array.from(document.querySelectorAll('[data-etiqueta]')).map((e) => e.getAttribute('data-etiqueta'))
const region = () => screen.getByRole('region', { name: 'Resultados de comparación' })
const COLORES = ['#ffd700', '#4ade80', '#c084fc', '#4dabff', '#ff9f43']
const filaDe = (rotulo: string) => screen.getByText(rotulo).closest('tr') as HTMLElement
const celdas = (fila: HTMLElement) => within(fila).getAllByRole('cell').map((c) => c.textContent)

beforeEach(() => {
  control.comparar.mockReset()
  control.comparar.mockImplementation(async (lista: string[]) => ok(respuestaPara(...lista)))
  graficos.props.length = 0
})
afterEach(() => vi.restoreAllMocks())

describe('contrato y formulario', () => {
  it('se llama «comparador» como el data-tab de la barra', () => {
    expect(nombre).toBe('comparador')
  })

  it('empieza sin etiquetas ni resultados, con su formulario', () => {
    montar()
    expect(screen.getByText('Máx 5')).toBeInTheDocument()
    expect(entrada()).toHaveAttribute('maxlength', '4')
    expect(entrada()).toHaveAttribute('placeholder', 'Número…')
    expect(screen.getByRole('button', { name: 'Limpiar' })).toBeInTheDocument()
    expect(etiquetas()).toEqual([])
    expect(region()).toHaveAttribute('aria-live', 'polite')
    expect(region()).toBeEmptyDOMElement()
    expect(control.comparar).not.toHaveBeenCalled()
  })
})

describe('agregar', () => {
  it('añade la etiqueta con el número rellenado, vacía el campo y compara', async () => {
    montar()
    agregar('42')
    expect(etiquetas()).toEqual(['0042'])
    expect(entrada().value).toBe('')
    expect(control.comparar).toHaveBeenCalledWith(['0042'])
    expect(await screen.findByText('Comparación')).toBeInTheDocument()
  })

  it('cada etiqueta lleva el color de su posición', () => {
    montar()
    ;['1111', '2222', '3333', '4444', '5555'].forEach(agregar)
    const e = Array.from(document.querySelectorAll<HTMLElement>('[data-etiqueta]'))
    expect(e.map((x) => x.style.color)).toEqual(COLORES.map((c) => hexARgb(c)))
    expect(e.map((x) => x.style.borderColor)).toEqual(COLORES.map((c) => hexARgb(c)))
  })

  it.each([[''], ['   '], ['abc'], ['12345'], ['12a4']])('«%s» no es válido: avisa y no compara ni vacía el campo', (texto) => {
    const { store } = montar()
    agregar(texto)
    expect(avisos(store)).toEqual([['Ingresa un número de 4 dígitos', 3000]])
    expect(control.comparar).not.toHaveBeenCalled()
    expect(entrada().value).toBe(texto)
    expect(etiquetas()).toEqual([])
  })

  it('un repetido (también escrito sin ceros) avisa y no vuelve a comparar', async () => {
    const { store } = montar()
    agregar('0042')
    await screen.findByText('Comparación')
    agregar('42')
    expect(avisos(store)).toEqual([['0042 ya está en la lista', 2000]])
    expect(etiquetas()).toEqual(['0042'])
    expect(control.comparar).toHaveBeenCalledTimes(1)
  })

  it('con 5 números no deja añadir el sexto', async () => {
    const { store } = montar()
    ;['1111', '2222', '3333', '4444', '5555'].forEach(agregar)
    agregar('6666')
    expect(avisos(store)).toEqual([['Máximo 5 números', 2000]])
    expect(etiquetas()).toHaveLength(5)
    expect(control.comparar).toHaveBeenCalledTimes(5)
  })

  it('con 5 números, repetir uno dice «ya está», no «máximo»', () => {
    const { store } = montar()
    ;['1111', '2222', '3333', '4444', '5555'].forEach(agregar)
    agregar('3333')
    expect(avisos(store)).toEqual([['3333 ya está en la lista', 2000]])
  })

  it('compara siempre con la lista completa en el orden en que se añadió', () => {
    montar()
    agregar('1111')
    agregar('2222')
    expect(control.comparar).toHaveBeenLastCalledWith(['1111', '2222'])
  })

  it('en StrictMode añade y compara una sola vez', () => {
    montar(true)
    agregar('42')
    expect(control.comparar).toHaveBeenCalledTimes(1)
    expect(etiquetas()).toEqual(['0042'])
  })
})

describe('cambiar de pestaña', () => {
  it('la lista y los resultados se conservan al ir a otra pestaña y volver (como compNumbers global)', async () => {
    const { store } = montar()
    agregar('1111')
    agregar('2222')
    await screen.findByText('2 números')
    act(() => store.cambiar({ activeTab: 'gaps' }))
    act(() => store.cambiar({ activeTab: 'comparador' }))
    expect(etiquetas()).toEqual(['1111', '2222'])
    expect(screen.getByText('2 números')).toBeInTheDocument()
    expect(control.comparar).toHaveBeenCalledTimes(2)
  })
})

describe('quitar y limpiar', () => {
  it('quitar uno con otros restantes vuelve a comparar con los que quedan', async () => {
    montar()
    agregar('1111')
    agregar('2222')
    await screen.findByText('Comparación')
    fireEvent.click(screen.getByRole('button', { name: 'Quitar 1111' }))
    expect(etiquetas()).toEqual(['2222'])
    expect(control.comparar).toHaveBeenLastCalledWith(['2222'])
  })

  it('quitar el último vacía los resultados y no compara', async () => {
    montar()
    agregar('1111')
    await screen.findByText('Comparación')
    control.comparar.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Quitar 1111' }))
    expect(etiquetas()).toEqual([])
    expect(region()).toBeEmptyDOMElement()
    expect(control.comparar).not.toHaveBeenCalled()
  })

  it('Limpiar quita todo y vacía los resultados', async () => {
    montar()
    agregar('1111')
    agregar('2222')
    await screen.findByText('Comparación')
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }))
    expect(etiquetas()).toEqual([])
    expect(region()).toBeEmptyDOMElement()
  })

  it('una respuesta que llega tras Limpiar no resucita los resultados', async () => {
    const d = diferida<ReturnType<typeof ok>>()
    control.comparar.mockReturnValueOnce(d.promesa)
    montar()
    agregar('1111')
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }))
    await act(async () => d.resolver(ok(respuestaPara('1111'))))
    expect(region()).toBeEmptyDOMElement()
  })

  it('una respuesta lenta de una comparación anterior no pisa a la más reciente', async () => {
    const lenta = diferida<ReturnType<typeof ok>>()
    control.comparar.mockReturnValueOnce(lenta.promesa)
    montar()
    agregar('1111')
    agregar('2222')
    expect(await screen.findAllByRole('columnheader')).toHaveLength(3) // Métrica + 2 números
    await act(async () => lenta.resolver(ok(respuestaPara('1111'))))
    expect(screen.getAllByRole('columnheader')).toHaveLength(3)
  })
})

describe('carga y error', () => {
  it('mientras compara muestra esqueletos anunciados como «Comparando...»', async () => {
    const d = diferida<ReturnType<typeof ok>>()
    control.comparar.mockReturnValueOnce(d.promesa)
    montar()
    agregar('1111')
    const estado = within(region()).getByRole('status', { name: 'Comparando...' })
    expect(estado.querySelectorAll('.skeleton').length).toBeGreaterThan(0)
    await act(async () => d.resolver(ok(respuestaPara('1111'))))
    expect(within(region()).queryByRole('status')).toBeNull()
  })

  it('si falla muestra el mensaje y un botón para reintentar con la misma lista; el foco pasa a la región', async () => {
    control.comparar.mockResolvedValueOnce({ ok: false, mensaje: 'Error del servidor' })
    montar()
    agregar('1111')
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('No se pudo comparar. Error del servidor')
    const boton = screen.getByRole('button', { name: 'Reintentar' })
    boton.focus()
    fireEvent.click(boton)
    expect(region()).toHaveFocus()
    expect(await screen.findByText('Comparación')).toBeInTheDocument()
    expect(control.comparar).toHaveBeenLastCalledWith(['1111'])
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('el aviso público del servidor (p. ej. un 400) se muestra tal cual', async () => {
    control.comparar.mockResolvedValueOnce({ ok: false, mensaje: 'Máximo 10 números' })
    montar()
    agregar('1111')
    expect(await screen.findByRole('alert')).toHaveTextContent('Máximo 10 números')
  })

  it('tras un error se puede seguir añadiendo números', async () => {
    control.comparar.mockResolvedValueOnce({ ok: false, mensaje: 'Error de conexión' })
    montar()
    agregar('1111')
    await screen.findByRole('alert')
    agregar('2222')
    expect(await screen.findByText('Comparación')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('resultados', () => {
  it('la tabla trae una columna por número, con el color de su posición, y las 9 métricas en orden', async () => {
    control.comparar.mockResolvedValue(ok(FIXTURE))
    montar()
    agregar('9614')
    agregar('4450')
    const tabla = await screen.findByRole('table')
    const cabeceras = within(tabla).getAllByRole('columnheader')
    expect(cabeceras.map((c) => c.textContent)).toEqual(['Métrica', '9614', '4450'])
    expect(cabeceras[1]!.style.color).toBe(hexARgb(COLORES[0]!))
    expect(cabeceras[2]!.style.color).toBe(hexARgb(COLORES[1]!))
    const rotulos = Array.from(tabla.querySelectorAll('tbody tr')).map((f) => f.querySelector('td')!.textContent)
    expect(rotulos).toEqual(['Aciertos Exactos', '1er Premio', '2do Premio', '3er Premio', 'Coincid. Terminación', 'Frecuencia %', 'Última Aparición', 'Gap (sorteos)', 'Mejor Mes'])
    expect(screen.getByText('2 números')).toHaveClass('card-badge')
  })

  it('los valores salen tal como llegan: cero se muestra como 0, el porcentaje lleva %, el mejor mes con su cuenta', async () => {
    control.comparar.mockResolvedValue(ok(FIXTURE))
    montar()
    agregar('9614')
    await screen.findByRole('table')
    const a = FIXTURE.numbers[0]!
    const b = FIXTURE.numbers[1]!
    expect(celdas(filaDe('Aciertos Exactos')).slice(1)).toEqual([String(a.total_exact), String(b.total_exact)])
    expect(celdas(filaDe('1er Premio')).slice(1)).toEqual([String(a.exact.primero), String(b.exact.primero)])
    expect(celdas(filaDe('2do Premio')).slice(1)).toEqual([String(a.exact.segundo), String(b.exact.segundo)])
    expect(celdas(filaDe('3er Premio')).slice(1)).toEqual([String(a.exact.tercero), String(b.exact.tercero)])
    expect(celdas(filaDe('Coincid. Terminación')).slice(1)).toEqual([String(a.ending_matches), String(b.ending_matches)])
    expect(celdas(filaDe('Frecuencia %')).slice(1)).toEqual([`${a.frequency_pct}%`, `${b.frequency_pct}%`])
    expect(celdas(filaDe('Última Aparición')).slice(1)).toEqual([a.last_appearance, b.last_appearance])
    expect(celdas(filaDe('Gap (sorteos)')).slice(1)).toEqual(['0', '1'])
    expect(celdas(filaDe('Mejor Mes')).slice(1)).toEqual([`${a.best_month} (${a.best_month_count})`, `${b.best_month} (${b.best_month_count})`])
  })

  it('un número que nunca salió: gap y última aparición con raya, cero aciertos', async () => {
    control.comparar.mockResolvedValue(ok(SIN_APARICIONES))
    montar()
    agregar('0')
    await screen.findByRole('table')
    expect(celdas(filaDe('Gap (sorteos)')).slice(1)).toEqual(['—'])
    expect(celdas(filaDe('Última Aparición')).slice(1)).toEqual(['—'])
    expect(celdas(filaDe('Aciertos Exactos')).slice(1)).toEqual(['0'])
  })

  it('una última aparición vacía se muestra como «Nunca»', async () => {
    control.comparar.mockResolvedValue(ok({ ...FIXTURE, numbers: [numeroDe('0000', { last_appearance: '' })] }))
    montar()
    agregar('0')
    await screen.findByRole('table')
    expect(celdas(filaDe('Última Aparición')).slice(1)).toEqual(['Nunca'])
  })

  it('las celdas de valores se ven como hoy: centradas y SIN fuente monoespaciada (el estilo antiguo estaba roto)', async () => {
    montar()
    agregar('1111')
    const tabla = await screen.findByRole('table')
    const celda = tabla.querySelector('tbody tr:first-child td:nth-child(2)') as HTMLElement
    expect(celda.style.textAlign).toBe('center')
    expect(celda.style.fontFamily).toBe('')
    // las cabeceras de número sí llevan la monoespaciada
    expect((within(tabla).getAllByRole('columnheader')[1] as HTMLElement).style.fontFamily).toContain('JetBrains Mono')
  })

  it('la tabla se puede desplazar en horizontal', async () => {
    montar()
    agregar('1111')
    expect((await screen.findByRole('table')).parentElement).toHaveStyle({ overflowX: 'auto' })
  })

  it('las tarjetas se hacen visibles (no se quedan en blanco)', async () => {
    montar()
    agregar('1111')
    const t = (await screen.findByRole('heading', { name: 'Comparación' })).closest('.card')
    expect(t).toHaveClass('reveal', 'visible')
  })
})

describe('gráfico de distribución mensual', () => {
  const ultimo = () => graficos.props.at(-1)!
  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

  it('es un gráfico de barras con su título, su insignia y su nombre accesible', async () => {
    montar()
    agregar('1111')
    expect(await screen.findByRole('heading', { name: 'Distribución Mensual' })).toBeInTheDocument()
    expect(screen.getByText('Por Mes')).toHaveClass('badge-green')
    expect(ultimo().type).toBe('bar')
    expect(screen.getByRole('img', { name: 'Distribución mensual comparativa' })).toBeInTheDocument()
  })

  it('una serie por número, con los 12 meses (los que faltan valen 0) y los colores de su posición', async () => {
    control.comparar.mockResolvedValue(
      ok({ ...FIXTURE, numbers: [numeroDe('1111', { monthly: { Oct: 3, Ene: 1 } }), numeroDe('2222', { monthly: {} })] }),
    )
    montar()
    agregar('1111')
    await screen.findByRole('table')
    const datos = (ultimo().datos as (t: string) => { labels: string[]; datasets: Array<Record<string, unknown>> })('dark')
    expect(datos.labels).toEqual(MESES)
    expect(datos.datasets.map((d) => d.label)).toEqual(['1111', '2222'])
    expect(datos.datasets[0]!.data).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0])
    expect(datos.datasets[1]!.data).toEqual(new Array(12).fill(0))
    expect(datos.datasets.map((d) => [d.backgroundColor, d.borderColor, d.borderWidth, d.borderRadius])).toEqual([
      ['#ffd70060', '#ffd700', 2, 4],
      ['#4ade8060', '#4ade80', 2, 4],
    ])
  })

  it('las opciones son las de tema de siempre', async () => {
    montar()
    agregar('1111')
    await screen.findByRole('table')
    expect((ultimo().opciones as (t: string) => unknown)('light')).toEqual(chartOptions('light'))
  })

  it('al repintar la isla sin cambiar los resultados no se pasan funciones nuevas (el gráfico no se recrearía)', async () => {
    montar()
    agregar('1111')
    await screen.findByRole('table')
    const antes = ultimo()
    fireEvent.change(entrada(), { target: { value: '2' } }) // repinta la isla entera
    expect(ultimo().datos).toBe(antes.datos)
    expect(ultimo().opciones).toBe(antes.opciones)
  })

  it('al añadir otro número los datos del gráfico incluyen las dos series (no se queda con las viejas)', async () => {
    montar()
    agregar('1111')
    await screen.findByRole('table')
    agregar('2222')
    await screen.findByText('2 números')
    const datos = (ultimo().datos as (t: string) => { datasets: Array<{ label: string }> })('dark')
    expect(datos.datasets.map((d) => d.label)).toEqual(['1111', '2222'])
  })
})

function hexARgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}
