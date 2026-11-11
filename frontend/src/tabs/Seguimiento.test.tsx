import { readFileSync } from 'node:fs'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MetodoComparado, Seguimiento } from '../api/types'
import { formatDate } from '../lib/formato'
import { StoreProvider } from '../store/StoreProvider'
import { crearStoreFalso } from '../store/storeFalso'
import type { TabId } from '../store/tipos'
import { Componente, nombre } from './Seguimiento'

const control = vi.hoisted(() => ({ getSeguimiento: vi.fn() }))
vi.mock('../api/client', () => ({ getSeguimiento: control.getSeguimiento }))

const fixture = (n: string): Seguimiento => JSON.parse(readFileSync(`fixtures/${n}.json`, 'utf-8'))
const COMPLETO = fixture('seguimiento')
const VACIO = fixture('seguimiento_vacio')
const copia = (): Seguimiento => structuredClone(COMPLETO)

const ok = (data: Seguimiento) => ({ ok: true as const, data })
function diferida<T>() {
  let resolver!: (v: T) => void
  const promesa = new Promise<T>((r) => (resolver = r))
  return { promesa, resolver }
}

function montar(activeTab: TabId = 'seguimiento', estricto = false) {
  const store = crearStoreFalso({ activeTab })
  const arbol = (
    <StoreProvider store={store}>
      <Componente />
    </StoreProvider>
  )
  return { store, ...render(estricto ? <StrictMode>{arbol}</StrictMode> : arbol) }
}

const region = (nombreRegion: string) => screen.getByRole('region', { name: nombreRegion })
const valorDe = (etiqueta: string) => screen.getByText(etiqueta).previousElementSibling!.textContent
const tarjetaDe = (categoria: string) => screen.getByRole('heading', { name: categoria }).closest('.card') as HTMLElement
const filas = (tabla: HTMLElement) => Array.from(tabla.querySelectorAll('tbody tr'))
const metodo = (m: Partial<MetodoComparado> = {}): MetodoComparado => ({
  numeros: ['1111', '2222'],
  terminaciones: ['11', '22'],
  exactos: 0,
  numeros_acertados: [],
  terminacion_numeros: 0,
  digitos_media: 0.5,
  terminaciones_aciertos: 0,
  terminaciones_acertadas: [],
  alguna_terminacion: false,
  ...m,
})

beforeEach(() => control.getSeguimiento.mockReset())
afterEach(() => vi.restoreAllMocks())

describe('contrato y carga', () => {
  it('se llama «seguimiento» como el data-tab de la barra', () => {
    expect(nombre).toBe('seguimiento')
  })

  it('con otra pestaña activa no pide nada ni pinta contenido', () => {
    control.getSeguimiento.mockResolvedValue(ok(COMPLETO))
    montar('gaps')
    expect(control.getSeguimiento).not.toHaveBeenCalled()
    expect(screen.queryByText('Sorteos comparados')).toBeNull()
  })

  it('pide los datos CADA VEZ que la pestaña pasa a ser la activa (como app.js: pueden haber cambiado)', async () => {
    control.getSeguimiento.mockResolvedValue(ok(COMPLETO))
    const { store } = montar('gaps')
    await act(async () => store.cambiar({ activeTab: 'seguimiento' }))
    await screen.findByText('Sorteos comparados')
    await act(async () => store.cambiar({ activeTab: 'gaps' }))
    await act(async () => store.cambiar({ activeTab: 'seguimiento' }))
    expect(control.getSeguimiento).toHaveBeenCalledTimes(2)
  })

  it('en StrictMode pide una sola vez por activación', async () => {
    control.getSeguimiento.mockResolvedValue(ok(COMPLETO))
    montar('seguimiento', true)
    await screen.findByText('Sorteos comparados')
    expect(control.getSeguimiento).toHaveBeenCalledTimes(1)
  })

  it('mientras carga muestra esqueletos anunciados como «Cargando seguimiento» y oculta el contenido viejo', async () => {
    control.getSeguimiento.mockResolvedValueOnce(ok(COMPLETO))
    const d = diferida<ReturnType<typeof ok>>()
    control.getSeguimiento.mockReturnValueOnce(d.promesa)
    const { store } = montar('seguimiento')
    await screen.findByText('Sorteos comparados')
    await act(async () => store.cambiar({ activeTab: 'gaps' }))
    await act(async () => store.cambiar({ activeTab: 'seguimiento' }))
    const estado = screen.getByRole('status', { name: 'Cargando seguimiento' })
    expect(estado.querySelectorAll('.skeleton').length).toBeGreaterThan(0)
    expect(screen.queryByText('Sorteos comparados')).toBeNull()
    await act(async () => d.resolver(ok(COMPLETO)))
    expect(screen.getByText('Sorteos comparados')).toBeInTheDocument()
  })

  it('una respuesta lenta de una activación anterior no pisa a la más reciente', async () => {
    const lenta = diferida<ReturnType<typeof ok>>()
    const nueva = copia()
    nueva.pendientes = []
    control.getSeguimiento.mockReturnValueOnce(lenta.promesa)
    control.getSeguimiento.mockResolvedValueOnce(ok(nueva))
    const { store } = montar('seguimiento')
    await act(async () => store.cambiar({ activeTab: 'gaps' }))
    await act(async () => store.cambiar({ activeTab: 'seguimiento' }))
    expect(await screen.findByText(/Aún no hay recomendaciones congeladas/)).toBeInTheDocument()
    await act(async () => lenta.resolver(ok(COMPLETO))) // llega tarde, con 4 pendientes
    expect(screen.getByText(/Aún no hay recomendaciones congeladas/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Dominical' })).toBeNull()
  })
})

describe('resumen', () => {
  beforeEach(() => control.getSeguimiento.mockResolvedValue(ok(COMPLETO)))

  it('con pocos sorteos comparados explica el 50/50', async () => {
    montar()
    await screen.findByText('Sorteos comparados')
    expect(valorDe('Peso Combinada: ML / Estadístico')).toBe('50% / 50%')
    expect(region('Resumen del seguimiento')).toHaveTextContent('50/50 hasta tener 10 sorteos comparados (van 4)')
    expect(valorDe('Sorteos comparados')).toBe(String(COMPLETO.comparados.length))
    expect(valorDe('Esperando resultado')).toBe(String(COMPLETO.pendientes.length))
    expect(valorDe('Sorteos sin registro')).toBe(String(COMPLETO.sin_registro.length))
  })

  it('con suficientes sorteos usa el peso calculado y lo dice', async () => {
    const d = copia()
    d.peso_ml = 0.7
    d.comparados_para_peso = 20
    control.getSeguimiento.mockResolvedValue(ok(d))
    montar()
    await screen.findByText('Sorteos comparados')
    expect(valorDe('Peso Combinada: ML / Estadístico')).toBe('70% / 30%')
    expect(region('Resumen del seguimiento')).toHaveTextContent('según los últimos 20 sorteos comparados')
  })

  it('con exactamente el mínimo de sorteos ya usa el peso calculado (no el 50/50)', async () => {
    const d = copia()
    d.comparados_para_peso = d.minimo_peso
    control.getSeguimiento.mockResolvedValue(ok(d))
    montar()
    await screen.findByText('Sorteos comparados')
    expect(region('Resumen del seguimiento')).toHaveTextContent(`según los últimos ${d.minimo_peso} sorteos comparados`)
    expect(region('Resumen del seguimiento')).not.toHaveTextContent('50/50 hasta tener')
  })

  it('sin peso (null o ausente) cae a 50 / 50', async () => {
    const d = copia() as unknown as Record<string, unknown>
    delete d.peso_ml
    control.getSeguimiento.mockResolvedValue(ok(d as unknown as Seguimiento))
    montar()
    await screen.findByText('Sorteos comparados')
    expect(valorDe('Peso Combinada: ML / Estadístico')).toBe('50% / 50%')
  })
})

describe('recomendaciones congeladas', () => {
  it('una tarjeta por categoría con fecha de registro, objetivo, métodos y terminaciones', async () => {
    control.getSeguimiento.mockResolvedValue(ok(COMPLETO))
    montar()
    await screen.findByText('Sorteos comparados')
    const p = COMPLETO.pendientes.find((x) => x.categoria === 'dominical')!
    const tarjeta = tarjetaDe('Dominical')
    expect(tarjeta).toHaveAttribute('aria-label', 'Recomendación congelada para Dominical')
    expect(tarjeta).toHaveTextContent(`Registrada ${p.registrado_en.replace('T', ' ')}`)
    expect(tarjeta).toHaveTextContent(`Para el próximo sorteo de Dominical después del ${formatDate(p.ultima_fecha)}.`)
    expect(tarjeta).toHaveTextContent('🤖 ML')
    expect(tarjeta).toHaveTextContent('📊 Estadístico')
    expect(tarjeta).toHaveTextContent('⚖️ Combinada')
    expect(tarjeta).toHaveTextContent(p.metodos.ml!.numeros.join(' · '))
    expect(tarjeta).toHaveTextContent(`Terminaciones: ${p.metodos.ml!.terminaciones.join(' ')}`)
    expect(tarjeta).toHaveTextContent('Peso ML de la combinada: 50%')
    expect(tarjeta).toHaveClass('reveal', 'visible')
  })

  it('el extraordinario avisa de los meses en que se juega', async () => {
    control.getSeguimiento.mockResolvedValue(ok(COMPLETO))
    montar()
    expect(await screen.findByText(/se juega en abril, agosto y diciembre/)).toBeInTheDocument()
    expect(tarjetaDe('Dominical')).not.toHaveTextContent('se juega en abril')
  })

  it('sin ML la combinada no se repite y se explica que es igual al estadístico', async () => {
    const d = copia()
    const p = d.pendientes.find((x) => x.categoria === 'gordito')!
    delete p.metodos.ml
    p.peso_ml = null
    control.getSeguimiento.mockResolvedValue(ok(d))
    montar()
    await screen.findByText('Sorteos comparados')
    const tarjeta = tarjetaDe('Gordito del Zodiaco')
    expect(tarjeta).not.toHaveTextContent('🤖 ML')
    expect(tarjeta).not.toHaveTextContent('⚖️ Combinada')
    expect(tarjeta).toHaveTextContent('📊 Estadístico')
    expect(tarjeta).toHaveTextContent('Sin ML para esta categoría: la combinada es igual al estadístico.')
    expect(tarjeta).not.toHaveTextContent('Peso ML de la combinada')
  })

  it('con ML pero sin peso congelado no inventa una nota de peso', async () => {
    const d = copia()
    d.pendientes.find((x) => x.categoria === 'dominical')!.peso_ml = null
    control.getSeguimiento.mockResolvedValue(ok(d))
    montar()
    await screen.findByText('Sorteos comparados')
    expect(tarjetaDe('Dominical')).not.toHaveTextContent('Peso ML de la combinada')
    expect(tarjetaDe('Dominical')).not.toHaveTextContent('Sin ML para esta categoría')
  })

  it('sin ML y sin combinada no se explica nada de la combinada', async () => {
    const d = copia()
    const p = d.pendientes.find((x) => x.categoria === 'gordito')!
    delete p.metodos.ml
    delete p.metodos.combinada
    control.getSeguimiento.mockResolvedValue(ok(d))
    montar()
    await screen.findByText('Sorteos comparados')
    expect(tarjetaDe('Gordito del Zodiaco')).not.toHaveTextContent('Sin ML para esta categoría')
    expect(tarjetaDe('Gordito del Zodiaco')).toHaveTextContent('📊 Estadístico')
  })

  it('una categoría sin premios de 4 cifras no muestra números sino el aviso', async () => {
    const d = copia()
    const p = d.pendientes.find((x) => x.categoria === 'extraordinario')!
    p.numeros_aplican = false
    control.getSeguimiento.mockResolvedValue(ok(d))
    montar()
    await screen.findByText('Sorteos comparados')
    const tarjeta = tarjetaDe('Extraordinario')
    expect(within(tarjeta).getAllByText('sin números (premios de 5 cifras)').length).toBeGreaterThan(0)
    expect(tarjeta).toHaveTextContent('Terminaciones:')
  })

  it('un método sin números lo dice igual', async () => {
    const d = copia()
    d.pendientes.find((x) => x.categoria === 'dominical')!.metodos.ml!.numeros = []
    control.getSeguimiento.mockResolvedValue(ok(d))
    montar()
    await screen.findByText('Sorteos comparados')
    expect(within(tarjetaDe('Dominical')).getAllByText('sin números (premios de 5 cifras)')).toHaveLength(1)
  })

  it('sin pendientes explica cuándo se registran', async () => {
    control.getSeguimiento.mockResolvedValue(ok(VACIO))
    montar()
    expect(await screen.findByText('Aún no hay recomendaciones congeladas. Se registran al calcular las estadísticas.')).toBeInTheDocument()
  })

  it('un cuerpo sin las listas (comparados, pendientes, sin_registro) se trata como vacío, sin romper', async () => {
    const d = copia() as unknown as Record<string, unknown>
    delete d.comparados
    delete d.pendientes
    delete d.sin_registro
    control.getSeguimiento.mockResolvedValue(ok(d as unknown as Seguimiento))
    montar()
    expect(await screen.findByText(/Aún no hay recomendaciones congeladas/)).toBeInTheDocument()
    expect(screen.getByText('Todavía no hay sorteos comparados.')).toBeInTheDocument()
    expect(valorDe('Sorteos comparados')).toBe('0')
  })
})

describe('marcador frente al azar', () => {
  const tabla = () => screen.getByRole('table', { name: 'Marcador acumulado por método' })

  it('tres filas en el orden ML, Estadístico, Combinada con sus cifras y su referencia de azar', async () => {
    const d = copia()
    d.marcador.ml = {
      sorteos: 12, sorteos_numeros: 9, exactos: 2, exactos_azar: 0.0012, terminacion_numeros: 5, terminacion_numeros_azar: 4.5,
      digitos_media: 0.4567, digitos_media_azar: 0.4, terminaciones_media: 1.234, terminaciones_media_azar: 1.1,
      alguna_terminacion_pct: 66.6, alguna_terminacion_pct_azar: 63.2,
    }
    control.getSeguimiento.mockResolvedValue(ok(d))
    montar()
    await screen.findByText('Sorteos comparados')
    const f = filas(tabla())
    expect(f).toHaveLength(3)
    expect(Array.from(f).map((r) => r.querySelector('td')!.textContent)).toEqual(['🤖 ML', '📊 Estadístico', '⚖️ Combinada'])
    const celdas = within(f[0] as HTMLElement).getAllByRole('cell').map((c) => c.textContent)
    expect(celdas).toEqual([
      '🤖 ML',
      '12',
      '2 (azar 0.001)',
      '5 (azar 4.5)',
      '0.457 (azar 0.400)',
      '1.23 (azar 1.10)',
      '67% (azar 63%)',
    ])
  })

  it('un método sin sorteos comparados lo indica en una sola celda', async () => {
    control.getSeguimiento.mockResolvedValue(ok(VACIO))
    montar()
    await screen.findByText('Sorteos comparados')
    const f = filas(tabla())
    expect(f).toHaveLength(3)
    const celdas = within(f[0] as HTMLElement).getAllByRole('cell')
    expect(celdas.map((c) => c.textContent)).toEqual(['🤖 ML', '0', 'Sin sorteos comparados todavía'])
    expect(celdas[2]).toHaveAttribute('colspan', '5')
  })

  it('sin sorteos con números (extraordinario) los datos de números van con raya, no con ceros', async () => {
    const d = copia()
    d.marcador.estadistico = { ...d.marcador.estadistico, sorteos: 3, sorteos_numeros: 0, alguna_terminacion_pct: null, alguna_terminacion_pct_azar: null, terminaciones_media: null, terminaciones_media_azar: null, digitos_media: null }
    control.getSeguimiento.mockResolvedValue(ok(d))
    montar()
    await screen.findByText('Sorteos comparados')
    const celdas = within(filas(tabla())[1] as HTMLElement).getAllByRole('cell').map((c) => c.textContent)
    expect(celdas).toEqual(['📊 Estadístico', '3', '—', '—', '— (azar 0.400)', '— (azar —)', '— (azar —)'])
  })

  it('sin marcador de un método (objeto ausente) cuenta como sin sorteos', async () => {
    const d = copia() as unknown as { marcador: Record<string, unknown> }
    delete d.marcador.combinada
    control.getSeguimiento.mockResolvedValue(ok(d as unknown as Seguimiento))
    montar()
    await screen.findByText('Sorteos comparados')
    expect(within(filas(tabla())[2] as HTMLElement).getByText('Sin sorteos comparados todavía')).toBeInTheDocument()
  })
})

describe('historial sorteo a sorteo', () => {
  const tabla = () => screen.getByRole('table', { name: 'Recomendado frente a resultado por sorteo' })

  it('mezcla comparados y sin registro, del más reciente al más antiguo', async () => {
    control.getSeguimiento.mockResolvedValue(ok(COMPLETO))
    montar()
    await screen.findByText('Sorteos comparados')
    const esperadas = [...COMPLETO.comparados.map((c) => c.sorteo.fecha), ...COMPLETO.sin_registro.map((s) => s.fecha)].sort((a, b) => b.localeCompare(a))
    expect(filas(tabla()).map((r) => r.querySelector('td')!.firstChild!.textContent)).toEqual(esperadas.map((f) => formatDate(f)))
  })

  it('una fila comparada trae fecha y categoría, premios tal como llegan y las tres celdas de métodos', async () => {
    const d = copia()
    d.sin_registro = []
    d.comparados = [d.comparados[0]!]
    const c = d.comparados[0]!
    c.sorteo = { ...c.sorteo, primero: '0074', segundo: '98', tercero: '' }
    control.getSeguimiento.mockResolvedValue(ok(d))
    montar()
    await screen.findByText('Sorteos comparados')
    const celdas = within(filas(tabla())[0] as HTMLElement).getAllByRole('cell')
    expect(celdas[0]).toHaveTextContent(formatDate(c.sorteo.fecha))
    expect(celdas[1]!.textContent).toBe('0074 · 98')
    expect(celdas).toHaveLength(5)
    const m = c.metodos.ml!
    expect(celdas[2]).toHaveTextContent(m.numeros.join(' · '))
    expect(celdas[2]).toHaveTextContent(`${m.exactos} exactos · dígitos ${Number(m.digitos_media).toFixed(2)} · term. ${m.terminaciones_aciertos}/10`)
  })

  it('los números acertados se marcan y las terminaciones acertadas se listan', async () => {
    const d = copia()
    d.sin_registro = []
    d.comparados = [d.comparados[0]!]
    d.comparados[0]!.metodos.ml = metodo({ numeros: ['1111', '2222'], numeros_acertados: ['2222'], exactos: 1, terminaciones_aciertos: 2, terminaciones_acertadas: ['22', '33'] })
    control.getSeguimiento.mockResolvedValue(ok(d))
    montar()
    await screen.findByText('Sorteos comparados')
    const celda = within(filas(tabla())[0] as HTMLElement).getAllByRole('cell')[2]!
    const marcas = celda.querySelectorAll('mark')
    expect(Array.from(marcas).map((m) => m.textContent)).toEqual(['2222'])
    expect(marcas[0]).toHaveAttribute('title', 'Acierto exacto')
    expect(marcas[0]).toHaveStyle({ background: '#4ade80' })
    expect(celda).toHaveTextContent('1 exactos · dígitos 0.50 · term. 2/10 (22 33)')
  })

  it('sin premio de 4 cifras los números «no aplican» y no se inventa nada', async () => {
    const d = copia()
    d.sin_registro = []
    d.comparados = [d.comparados[0]!]
    d.comparados[0]!.metodos.ml = metodo({ numeros: [], exactos: null, digitos_media: null, terminacion_numeros: null })
    control.getSeguimiento.mockResolvedValue(ok(d))
    montar()
    await screen.findByText('Sorteos comparados')
    const celda = within(filas(tabla())[0] as HTMLElement).getAllByRole('cell')[2]!
    expect(celda).toHaveTextContent('números: no aplica · term. 0/10')
    expect(celda.querySelector('.num-cell')!.textContent).toBe('—')
  })

  it('un método ausente (sin ML) deja una raya en su celda', async () => {
    const d = copia()
    d.sin_registro = []
    d.comparados = [d.comparados[0]!]
    delete d.comparados[0]!.metodos.ml
    control.getSeguimiento.mockResolvedValue(ok(d))
    montar()
    await screen.findByText('Sorteos comparados')
    expect(within(filas(tabla())[0] as HTMLElement).getAllByRole('cell')[2]!.textContent).toBe('—')
  })

  it('un sorteo sin registro va atenuado y dice por qué', async () => {
    const d = copia()
    d.comparados = []
    d.sin_registro = [d.sin_registro[0]!]
    control.getSeguimiento.mockResolvedValue(ok(d))
    montar()
    await screen.findByText('Sorteos comparados')
    const fila = filas(tabla())[0] as HTMLElement
    expect(fila).toHaveStyle({ opacity: '0.55' })
    expect(within(fila).getByText('Sin registro: nadie abrió la web entre sorteos').closest('td')).toHaveAttribute('colspan', '3')
  })

  it('sin sorteos lo dice', async () => {
    control.getSeguimiento.mockResolvedValue(ok(VACIO))
    montar()
    expect(await screen.findByText('Todavía no hay sorteos comparados.')).toHaveAttribute('colspan', '5')
  })

  it('las regiones desplazables son enfocables con el teclado', async () => {
    control.getSeguimiento.mockResolvedValue(ok(COMPLETO))
    montar()
    await screen.findByText('Sorteos comparados')
    expect(region('Marcador por método')).toHaveAttribute('tabindex', '0')
    expect(region('Historial del seguimiento')).toHaveAttribute('tabindex', '0')
  })
})

describe('error', () => {
  it('muestra el mensaje genérico, no deja contenido y reintenta con el botón', async () => {
    control.getSeguimiento.mockResolvedValueOnce({ ok: false, mensaje: 'Error del servidor' })
    control.getSeguimiento.mockResolvedValueOnce(ok(COMPLETO))
    montar()
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('No se pudo cargar el seguimiento.')
    expect(alerta).toHaveTextContent('Error del servidor')
    expect(screen.queryByText('Sorteos comparados')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Sorteos comparados')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(control.getSeguimiento).toHaveBeenCalledTimes(2)
  })

  it('al reintentar el foco pasa a la región y no se pierde', async () => {
    control.getSeguimiento.mockResolvedValueOnce({ ok: false, mensaje: 'Error de conexión' })
    control.getSeguimiento.mockResolvedValueOnce(ok(COMPLETO))
    montar()
    const boton = await screen.findByRole('button', { name: 'Reintentar' })
    boton.focus()
    fireEvent.click(boton)
    expect(screen.getByRole('region', { name: 'Seguimiento de recomendaciones' })).toHaveFocus()
    await screen.findByText('Sorteos comparados')
  })

  it('volver a la pestaña tras un error vuelve a intentarlo', async () => {
    control.getSeguimiento.mockResolvedValueOnce({ ok: false, mensaje: 'Error de conexión' })
    control.getSeguimiento.mockResolvedValueOnce(ok(COMPLETO))
    const { store } = montar()
    await screen.findByRole('alert')
    await act(async () => store.cambiar({ activeTab: 'gaps' }))
    await act(async () => store.cambiar({ activeTab: 'seguimiento' }))
    expect(await screen.findByText('Sorteos comparados')).toBeInTheDocument()
  })
})
