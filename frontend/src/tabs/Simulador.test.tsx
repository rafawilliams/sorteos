import { readFileSync } from 'node:fs'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Simulacion, Stats } from '../api/types'
import { StoreProvider } from '../store/StoreProvider'
import { crearStoreFalso } from '../store/storeFalso'
import { Componente, nombre } from './Simulador'

const control = vi.hoisted(() => ({ simular: vi.fn() }))
vi.mock('../api/client', () => ({ simular: control.simular }))

const FIXTURE: Simulacion = JSON.parse(readFileSync('fixtures/simulador.json', 'utf-8'))
const SIN_ACIERTOS: Simulacion = JSON.parse(readFileSync('fixtures/simulador_sin_aciertos.json', 'utf-8'))
const STATS: Stats = JSON.parse(readFileSync('fixtures/stats.json', 'utf-8'))
const ok = (data: Simulacion) => ({ ok: true as const, data })
const respuestaPara = (numero: string, extra: Partial<Simulacion> = {}): Simulacion => ({ ...FIXTURE, numero, terminacion: numero.slice(-2), ...extra })
function diferida<T>() {
  let resolver!: (v: T) => void
  const promesa = new Promise<T>((r) => (resolver = r))
  return { promesa, resolver }
}

function montar({ estricto = false, stats = STATS as Stats | null } = {}) {
  const store = crearStoreFalso({ activeTab: 'simulador', stats })
  const arbol = (
    <StoreProvider store={store}>
      <Componente />
    </StoreProvider>
  )
  return { store, ...render(estricto ? <StrictMode>{arbol}</StrictMode> : arbol) }
}

const campo = () => screen.getByRole('textbox', { name: 'Número a simular' }) as HTMLInputElement
const categoria = () => screen.getByRole('combobox', { name: 'Categoría para simulación' }) as HTMLSelectElement
const desde = () => screen.getByLabelText('Fecha desde') as HTMLInputElement
const hasta = () => screen.getByLabelText('Fecha hasta') as HTMLInputElement
const boton = () => screen.getByRole('button', { name: 'Ejecutar simulación' })
const region = () => screen.getByRole('region', { name: 'Resultados de simulación' })
const simular = (texto: string) => {
  fireEvent.change(campo(), { target: { value: texto } })
  fireEvent.click(boton())
}
const avisos = (store: ReturnType<typeof crearStoreFalso>) => store.llamadas.filter((l) => l.accion === 'toast').map((l) => l.args)
const tarjeta = (titulo: string) => screen.getByText(titulo).closest('.card') as HTMLElement

beforeEach(() => {
  control.simular.mockReset()
  control.simular.mockImplementation(async ({ numero }: { numero: string }) => ok(respuestaPara(numero)))
})
afterEach(() => vi.restoreAllMocks())

describe('contrato y formulario', () => {
  it('se llama «simulador» como el data-tab de la barra', () => {
    expect(nombre).toBe('simulador')
  })

  it('con `stats` nulo muestra su esqueleto y todavía no el formulario', () => {
    montar({ stats: null })
    expect(screen.getByRole('status', { name: 'Cargando simulador' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Número a simular' })).not.toBeInTheDocument()
  })

  it('con datos muestra el formulario con los mismos campos que antes', () => {
    montar()
    expect(screen.getByText('Buscar Número')).toBeInTheDocument()
    expect(screen.getByText('Histórico')).toBeInTheDocument()
    expect(campo()).toHaveAttribute('maxlength', '4')
    expect(campo()).toHaveAttribute('placeholder', '0042')
    expect(desde()).toHaveAttribute('type', 'date')
    expect(hasta()).toHaveAttribute('type', 'date')
    expect(boton()).toHaveTextContent('🔍 Simular')
    expect(region()).toHaveAttribute('aria-live', 'polite')
  })

  it('el selector ofrece «Todas» y las categorías de `stats.by_category` con su etiqueta', () => {
    montar()
    const opciones = Array.from(categoria().options).map((o) => [o.value, o.textContent])
    expect(opciones).toEqual([
      ['', 'Todas'],
      ...Object.keys(STATS.by_category).map((c) => [c, expect.any(String)]),
    ])
    expect(opciones).toContainEqual(['gordito', 'Gordito del Zodiaco'])
  })

  it('una categoría que llega con otro formato se muestra con su primera letra en mayúscula, sin romper el selector', () => {
    montar({ stats: { ...STATS, by_category: { ...STATS.by_category, rara: STATS.by_category.dominical! } as Stats['by_category'] } })
    expect(Array.from(categoria().options).map((o) => o.textContent)).toContain('Rara')
  })

  it('no pide nada hasta que se pulsa «Simular»', () => {
    montar()
    expect(control.simular).not.toHaveBeenCalled()
    expect(region()).toBeEmptyDOMElement()
  })
})

describe('validación del número', () => {
  it.each(['', '   ', 'abc', '12345', '12a4', '١٢٣٤'])('«%s» avisa y no pide nada', (texto) => {
    const { store } = montar()
    simular(texto)
    expect(avisos(store)).toEqual([['Ingresa un número de 4 dígitos', 3000]])
    expect(control.simular).not.toHaveBeenCalled()
  })

  it('un campo vacío no se rellena hasta «0000» (corrección de la deuda Q8)', () => {
    montar()
    simular('')
    expect(control.simular).not.toHaveBeenCalled()
  })

  it('lo que teclea la persona se completa con ceros: «74» pide «0074»', async () => {
    montar()
    simular('74')
    await screen.findByText('Número buscado')
    expect(control.simular).toHaveBeenCalledWith(expect.objectContaining({ numero: '0074' }))
  })

  it('«9614» con espacios alrededor se recorta', async () => {
    montar()
    simular(' 9614 ')
    await screen.findByText('Número buscado')
    expect(control.simular).toHaveBeenCalledWith(expect.objectContaining({ numero: '9614' }))
  })
})

describe('filtros', () => {
  it('pide el número con la categoría y el rango elegidos', async () => {
    montar()
    fireEvent.change(categoria(), { target: { value: 'gordito' } })
    fireEvent.change(desde(), { target: { value: '2015-01-01' } })
    fireEvent.change(hasta(), { target: { value: '2018-12-31' } })
    simular('9614')
    await screen.findByText('Número buscado')
    expect(control.simular).toHaveBeenCalledWith({ numero: '9614', cat: 'gordito', from: '2015-01-01', to: '2018-12-31' })
  })

  it('sin filtros los manda vacíos (el cliente los omite de la URL)', async () => {
    montar()
    simular('9614')
    await screen.findByText('Número buscado')
    expect(control.simular).toHaveBeenCalledWith({ numero: '9614', cat: '', from: '', to: '' })
  })
})

describe('resultados', () => {
  it('muestra las cuatro cifras de cabecera tal como llegan', async () => {
    montar()
    simular('9614')
    await screen.findByText('Número buscado')
    expect(screen.getByText('Número buscado').previousElementSibling).toHaveTextContent('9614')
    expect(screen.getByText('Sorteos analizados').previousElementSibling).toHaveTextContent(FIXTURE.total_sorteos.toLocaleString())
    expect(screen.getByText('Veces que salió (exacto)').previousElementSibling).toHaveTextContent(String(FIXTURE.exact.total))
    expect(screen.getByText(`Coincidencia terminación (${FIXTURE.terminacion})`).previousElementSibling).toHaveTextContent(String(FIXTURE.ending.total))
  })

  it('los sorteos analizados llevan separador de miles (la base real tiene 9.296, no 600)', async () => {
    expect((9296).toLocaleString(), 'el entorno de pruebas no separa miles: la prueba no distinguiría nada').not.toBe('9296')
    control.simular.mockResolvedValue(ok(respuestaPara('9614', { total_sorteos: 9296 })))
    montar()
    simular('9614')
    await screen.findByText('Número buscado')
    expect(screen.getByText('Sorteos analizados').previousElementSibling).toHaveTextContent((9296).toLocaleString())
  })

  it('el número que muestra es el de la respuesta, no el que se tecleó', async () => {
    control.simular.mockResolvedValue(ok(respuestaPara('0042')))
    montar()
    simular('42')
    await screen.findByText('Número buscado')
    expect(screen.getByText('Número buscado').previousElementSibling).toHaveTextContent('0042')
  })

  it('con aciertos: insignia «hot», los tres premios exactos y la frecuencia', async () => {
    control.simular.mockResolvedValue(ok(respuestaPara('9614', { exact: { ...FIXTURE.exact, total: 3, primero: 1, segundo: 2, tercero: 0, frequency_pct: 0.5 } })))
    montar()
    simular('9614')
    const exactos = (await screen.findByText('Aciertos Exactos')).closest('.card') as HTMLElement
    expect(within(exactos).getByText('3')).toHaveClass('badge-hot')
    expect(within(exactos).getByText('1er Premio').previousElementSibling).toHaveTextContent('1')
    expect(within(exactos).getByText('2do Premio').previousElementSibling).toHaveTextContent('2')
    expect(within(exactos).getByText('3er Premio').previousElementSibling).toHaveTextContent('0')
    expect(within(exactos).getByText('Frecuencia: 0.5% de sorteos')).toBeInTheDocument()
  })

  it('la tarjeta de la terminación lleva el número de la terminación y sus premios', async () => {
    montar()
    simular('9614')
    const ter = (await screen.findByText(`Terminación "${FIXTURE.terminacion}"`)).closest('.card') as HTMLElement
    expect(within(ter).getByText(String(FIXTURE.ending.total))).toHaveClass('badge-green')
    expect(within(ter).getByText('1er Premio').previousElementSibling).toHaveTextContent(String(FIXTURE.ending.primero))
    expect(within(ter).getByText(`Frecuencia: ${FIXTURE.ending.frequency_pct}% de sorteos`)).toBeInTheDocument()
  })

  it('última aparición con su fecha y los sorteos sin aparecer', async () => {
    control.simular.mockResolvedValue(ok(respuestaPara('9614', { exact: { ...FIXTURE.exact, last_appearance: '2019-10-02', gap_draws: 12 } })))
    montar()
    simular('9614')
    const ult = (await screen.findByText('Última Aparición')).closest('.card') as HTMLElement
    expect(within(ult).getByText('2019-10-02')).toBeInTheDocument()
    expect(within(ult).getByText('12')).toBeInTheDocument()
    expect(within(ult).getByText('sorteos sin aparecer')).toBeInTheDocument()
  })

  it('un gap de 0 sorteos se muestra (no se confunde con «sin registro»)', async () => {
    control.simular.mockResolvedValue(ok(respuestaPara('9614', { exact: { ...FIXTURE.exact, gap_draws: 0 } })))
    montar()
    simular('9614')
    const ult = (await screen.findByText('Última Aparición')).closest('.card') as HTMLElement
    expect(within(ult).getByText('0')).toBeInTheDocument()
    expect(within(ult).queryByText('Sin registro en el rango seleccionado')).not.toBeInTheDocument()
  })

  it('sin aciertos: insignia «cold», «Nunca ha salido», sin gap, sin categorías y sin historial', async () => {
    control.simular.mockResolvedValue(ok(SIN_ACIERTOS))
    montar()
    simular('0000')
    const exactos = (await screen.findByText('Aciertos Exactos')).closest('.card') as HTMLElement
    expect(within(exactos).getByText('0', { selector: '.card-badge' })).toHaveClass('badge-cold')
    const ult = screen.getByText('Última Aparición').closest('.card') as HTMLElement
    expect(within(ult).getByText('Nunca ha salido')).toBeInTheDocument()
    expect(within(ult).getByText('Sin registro en el rango seleccionado')).toBeInTheDocument()
    expect(screen.queryByText('Distribución por Categoría')).not.toBeInTheDocument()
    expect(screen.queryByText('Historial de Aciertos')).not.toBeInTheDocument()
  })

  it('la distribución por categoría ordena de mayor a menor, con la clave tal como llega y barras proporcionales', async () => {
    control.simular.mockResolvedValue(ok(respuestaPara('9614', { by_category: { dominical: 2, extraordinario: 8, gordito: 4 } })))
    montar()
    simular('9614')
    const tarj = (await screen.findByText('Distribución por Categoría')).closest('.card') as HTMLElement
    const filas = Array.from(tarj.querySelectorAll('.bar-row')).map((f) => [
      f.querySelector('.bar-label')!.textContent,
      f.querySelector('.bar-value')!.textContent,
      (f.querySelector('.bar-fill') as HTMLElement).style.width,
    ])
    expect(filas).toEqual([
      ['extraordinario', '8', '100%'],
      ['gordito', '4', '50%'],
      ['dominical', '2', '25%'],
    ])
  })

  it('el historial lista fecha y categoría de cada acierto, con el número de filas en la insignia', async () => {
    const matches = [
      { cat: 'extraordinario' as const, fecha: '2019-10-02', tipo: '' },
      { cat: 'gordito' as const, fecha: '2018-03-04', tipo: '' },
    ]
    control.simular.mockResolvedValue(ok(respuestaPara('9614', { exact: { ...FIXTURE.exact, matches } })))
    montar()
    simular('9614')
    const tarj = (await screen.findByText('Historial de Aciertos')).closest('.card') as HTMLElement
    expect(within(tarj).getByText('Últimos 2')).toBeInTheDocument()
    const filas = within(tarj).getAllByRole('row').slice(1).map((f) => within(f).getAllByRole('cell').map((c) => c.textContent))
    expect(filas).toEqual([
      ['2019-10-02', 'extraordinario'],
      ['2018-03-04', 'gordito'],
    ])
    expect(within(tarj).getByText('gordito')).toHaveClass('cat-badge')
  })

  it('un texto con marcado en la categoría o la fecha se muestra como texto, no se interpreta', async () => {
    const matches = [{ cat: '<img src=x onerror=alert(1)>' as never, fecha: '<b>hoy</b>', tipo: '' }]
    control.simular.mockResolvedValue(ok(respuestaPara('9614', { exact: { ...FIXTURE.exact, matches } })))
    montar()
    simular('9614')
    await screen.findByText('Historial de Aciertos')
    expect(region().querySelector('img, b')).toBeNull()
    expect(screen.getByText('<b>hoy</b>')).toBeInTheDocument()
  })

  it('una respuesta sin `by_category` ni `matches` no rompe la pantalla', async () => {
    const parcial = { ...respuestaPara('9614'), by_category: undefined, exact: { ...FIXTURE.exact, matches: undefined } } as unknown as Simulacion
    control.simular.mockResolvedValue(ok(parcial))
    montar()
    simular('9614')
    await screen.findByText('Número buscado')
    expect(screen.queryByText('Distribución por Categoría')).not.toBeInTheDocument()
    expect(screen.queryByText('Historial de Aciertos')).not.toBeInTheDocument()
  })
})

describe('carga, error y reintento', () => {
  it('mientras llega la respuesta muestra un esqueleto «Buscando...»', async () => {
    const d = diferida<ReturnType<typeof ok>>()
    control.simular.mockReturnValue(d.promesa)
    montar()
    simular('9614')
    expect(await screen.findByRole('status', { name: 'Buscando...' })).toBeInTheDocument()
    await act(async () => d.resolver(ok(FIXTURE)))
    expect(screen.queryByRole('status', { name: 'Buscando...' })).not.toBeInTheDocument()
    expect(screen.getByText('Número buscado')).toBeInTheDocument()
  })

  it('un error muestra el mensaje y «Reintentar», sin dejar el esqueleto para siempre', async () => {
    control.simular.mockResolvedValue({ ok: false, mensaje: 'No se pudo conectar.' })
    montar()
    simular('9614')
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('No se pudo simular. No se pudo conectar.')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('«Reintentar» repite la misma consulta, con sus filtros, y devuelve el foco a la región', async () => {
    control.simular.mockResolvedValueOnce({ ok: false, mensaje: 'Fallo.' }).mockResolvedValue(ok(FIXTURE))
    montar()
    fireEvent.change(categoria(), { target: { value: 'gordito' } })
    simular('9614')
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(region()).toHaveFocus()
    await screen.findByText('Número buscado')
    expect(control.simular).toHaveBeenCalledTimes(2)
    expect(control.simular).toHaveBeenLastCalledWith({ numero: '9614', cat: 'gordito', from: '', to: '' })
  })

  it('el reintento usa lo que se pidió, no lo que hay ahora en el formulario', async () => {
    control.simular.mockResolvedValueOnce({ ok: false, mensaje: 'Fallo.' }).mockResolvedValue(ok(FIXTURE))
    montar()
    simular('9614')
    await screen.findByRole('alert')
    fireEvent.change(campo(), { target: { value: '1111' } })
    fireEvent.change(categoria(), { target: { value: 'dominical' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await screen.findByText('Número buscado')
    expect(control.simular).toHaveBeenLastCalledWith({ numero: '9614', cat: '', from: '', to: '' })
  })

  it('una respuesta vieja que llega tarde no pisa a la más reciente', async () => {
    const lenta = diferida<ReturnType<typeof ok>>()
    control.simular.mockReturnValueOnce(lenta.promesa).mockImplementation(async ({ numero }: { numero: string }) => ok(respuestaPara(numero)))
    montar()
    simular('1111')
    simular('2222')
    await screen.findByText('Número buscado')
    expect(screen.getByText('Número buscado').previousElementSibling).toHaveTextContent('2222')
    await act(async () => lenta.resolver(ok(respuestaPara('1111'))))
    expect(screen.getByText('Número buscado').previousElementSibling).toHaveTextContent('2222')
  })

  it('un error viejo que llega tarde tampoco pisa a la respuesta buena', async () => {
    const lenta = diferida<{ ok: false; mensaje: string }>()
    control.simular.mockReturnValueOnce(lenta.promesa).mockImplementation(async ({ numero }: { numero: string }) => ok(respuestaPara(numero)))
    montar()
    simular('1111')
    simular('2222')
    await screen.findByText('Número buscado')
    await act(async () => lenta.resolver({ ok: false, mensaje: 'tarde' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('Número buscado').previousElementSibling).toHaveTextContent('2222')
  })
})

describe('petición desde Mis Números (`simulacion`)', () => {
  it('«Simular» rellena el campo y lanza la simulación con los filtros actuales', async () => {
    const { store } = montar()
    fireEvent.change(categoria(), { target: { value: 'gordito' } })
    act(() => store.actions.simularNumero('0042'))
    await screen.findByText('Número buscado')
    expect(campo()).toHaveValue('0042')
    expect(control.simular).toHaveBeenCalledTimes(1)
    expect(control.simular).toHaveBeenCalledWith({ numero: '0042', cat: 'gordito', from: '', to: '' })
  })

  it('pedir el mismo número otra vez lo simula otra vez', async () => {
    const { store } = montar()
    act(() => store.actions.simularNumero('0042'))
    await screen.findByText('Número buscado')
    act(() => store.actions.simularNumero('0042'))
    await vi.waitFor(() => expect(control.simular).toHaveBeenCalledTimes(2))
  })

  it('una petición anterior al montaje no lanza nada', () => {
    const store = crearStoreFalso({ activeTab: 'simulador', stats: STATS, simulacion: { numero: '0042', id: 7 } })
    render(
      <StoreProvider store={store}>
        <Componente />
      </StoreProvider>,
    )
    expect(control.simular).not.toHaveBeenCalled()
    expect(campo()).toHaveValue('')
  })

  it('cambiar de pestaña y volver no repite la simulación ni borra el resultado', async () => {
    const { store } = montar()
    simular('9614')
    await screen.findByText('Número buscado')
    act(() => store.cambiar({ activeTab: 'gaps' }))
    act(() => store.cambiar({ activeTab: 'simulador' }))
    expect(control.simular).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Número buscado')).toBeInTheDocument()
  })

  it('en modo estricto cada clic y cada petición simulan una sola vez', async () => {
    const { store } = montar({ estricto: true })
    simular('9614')
    await screen.findByText('Número buscado')
    expect(control.simular).toHaveBeenCalledTimes(1)
    act(() => store.actions.simularNumero('0042'))
    await vi.waitFor(() => expect(control.simular).toHaveBeenCalledTimes(2))
    expect(control.simular).toHaveBeenLastCalledWith(expect.objectContaining({ numero: '0042' }))
  })
})
