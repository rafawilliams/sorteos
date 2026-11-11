import { readFileSync } from 'node:fs'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Gaps } from '../api/types'
import { StoreProvider } from '../store/StoreProvider'
import { crearStoreFalso } from '../store/storeFalso'
import { Componente, nombre } from './Gaps'

const control = vi.hoisted(() => ({ getGaps: vi.fn() }))
vi.mock('../api/client', () => ({ getGaps: control.getGaps }))

const fixture = (n: string): Gaps => JSON.parse(readFileSync(`fixtures/${n}.json`, 'utf-8'))
const CON_NUMEROS = fixture('gaps_con_numeros')
const SIN_NUMEROS = fixture('gaps')

/** Una promesa que el test resuelve a mano, para ver el estado «cargando». */
function diferida<T>() {
  let resolver!: (v: T) => void
  const promesa = new Promise<T>((r) => (resolver = r))
  return { promesa, resolver }
}

const ok = (data: Gaps) => ({ ok: true as const, data })

function montar(activeTab: 'gaps' | 'predicciones' = 'gaps', estricto = false) {
  const store = crearStoreFalso({ activeTab })
  const arbol = (
    <StoreProvider store={store}>
      <Componente />
    </StoreProvider>
  )
  const vista = render(estricto ? <StrictMode>{arbol}</StrictMode> : arbol)
  return { store, ...vista }
}

const region = () => screen.getByRole('region', { name: 'Análisis de gaps' })

beforeEach(() => {
  control.getGaps.mockReset()
})
afterEach(() => vi.restoreAllMocks())

describe('contrato de la isla', () => {
  it('se llama «gaps» como el data-tab de la barra', () => {
    expect(nombre).toBe('gaps')
  })
})

describe('carga la primera vez que la pestaña es la activa', () => {
  it('con otra pestaña activa no pide nada y no pinta contenido', () => {
    control.getGaps.mockResolvedValue(ok(CON_NUMEROS))
    montar('predicciones')
    expect(control.getGaps).not.toHaveBeenCalled()
    expect(screen.queryByText('Sorteos Analizados')).toBeNull()
  })

  it('al activarse pide los datos una sola vez, aunque se desactive y se vuelva a activar', async () => {
    control.getGaps.mockResolvedValue(ok(CON_NUMEROS))
    const { store } = montar('predicciones')
    await act(async () => store.cambiar({ activeTab: 'gaps' }))
    expect(await screen.findByText('Sorteos Analizados')).toBeInTheDocument()
    await act(async () => store.cambiar({ activeTab: 'decenas' }))
    await act(async () => store.cambiar({ activeTab: 'gaps' }))
    expect(control.getGaps).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Sorteos Analizados')).toBeInTheDocument()
  })

  it('en StrictMode (como en producción) tampoco duplica la petición', async () => {
    control.getGaps.mockResolvedValue(ok(CON_NUMEROS))
    montar('gaps', true)
    expect(await screen.findByText('Sorteos Analizados')).toBeInTheDocument()
    expect(control.getGaps).toHaveBeenCalledTimes(1)
  })

  it('mientras carga muestra «Calculando gaps...» y marca la región como ocupada', async () => {
    const d = diferida<ReturnType<typeof ok>>()
    control.getGaps.mockReturnValue(d.promesa)
    montar()
    expect(screen.getByRole('status')).toHaveTextContent('Calculando gaps...')
    expect(region()).toHaveAttribute('aria-busy', 'true')
    await act(async () => d.resolver(ok(CON_NUMEROS)))
    expect(screen.queryByRole('status')).toBeNull()
    expect(region()).toHaveAttribute('aria-busy', 'false')
  })

  it('si se desmonta mientras carga no avisa en consola', async () => {
    const d = diferida<ReturnType<typeof ok>>()
    control.getGaps.mockReturnValue(d.promesa)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = montar()
    unmount()
    await act(async () => d.resolver(ok(CON_NUMEROS)))
    expect(error).not.toHaveBeenCalled()
  })
})

describe('con datos', () => {
  beforeEach(() => control.getGaps.mockResolvedValue(ok(CON_NUMEROS)))

  it('muestra los dos contadores: sorteos analizados y números vencidos', async () => {
    montar()
    const analizados = (await screen.findByText('Sorteos Analizados')).previousElementSibling!
    expect(analizados.textContent).toBe(CON_NUMEROS.total_sorteos.toLocaleString())
    const vencidos = screen.getByText('Números "Vencidos"').previousElementSibling!
    expect(vencidos.textContent).toBe(String(CON_NUMEROS.overdue_numbers.length))
  })

  it('el contador de vencidos cuenta los vencidos, no los recientes', async () => {
    const num = (n: string) => ({ number: n, gap: 1, avg_gap: 1, ratio: 1.2, count: 5 })
    control.getGaps.mockResolvedValue(ok({ ...CON_NUMEROS, overdue_numbers: [num('1111'), num('2222')], ontime_numbers: [num('3333'), num('4444'), num('5555')] }))
    montar()
    const vencidos = (await screen.findByText('Números "Vencidos"')).previousElementSibling!
    expect(vencidos.textContent).toBe('2')
  })

  it('la tabla de números vencidos trae número, gaps, ratio, total y barra', async () => {
    montar()
    const tabla = (await screen.findByRole('table', { name: /números vencidos/i })) as HTMLElement
    const g = CON_NUMEROS.overdue_numbers[0]!
    const fila = within(tabla).getByText(g.number).closest('tr')!
    const celdas = within(fila).getAllByRole('cell').map((c) => c.textContent)
    expect(celdas.slice(0, 5)).toEqual([g.number, String(g.gap), String(g.avg_gap), `${g.ratio}x`, String(g.count)])
    const barra = fila.querySelector('td:last-child > div > div') as HTMLElement
    expect(barra.style.width).toBe('100%') // ratio 5.05 / 3 pasa del tope
  })

  it('los números se muestran tal como llegan, sin rellenar', async () => {
    control.getGaps.mockResolvedValue(ok({ ...CON_NUMEROS, overdue_numbers: [{ number: '0074', gap: 3, avg_gap: 2, ratio: 1.5, count: 9 }] }))
    montar()
    expect(await screen.findByText('0074')).toBeInTheDocument()
  })

  it.each([
    [1.0001, '#eab308', 33.34],
    [1.49, '#eab308', 49.67],
    [1.5, '#f97316', 50],
    [1.99, '#f97316', 66.33],
    [2, '#ef4444', 66.67],
    [9, '#ef4444', 100],
  ])('ratio %f → color %s y barra al %f %%', async (ratio, color, ancho) => {
    control.getGaps.mockResolvedValue(ok({ ...CON_NUMEROS, overdue_numbers: [{ number: '1111', gap: 1, avg_gap: 1, ratio, count: 5 }] }))
    montar()
    const insignia = await screen.findByText(`${ratio}x`)
    expect(insignia).toHaveStyle({ color })
    const barra = insignia.closest('tr')!.querySelector('td:last-child > div > div') as HTMLElement
    expect(parseFloat(barra.style.width)).toBeCloseTo(ancho, 1)
    expect(barra).toHaveStyle({ background: color })
  })

  it('lista TODAS las terminaciones vencidas con su gap y su ratio', async () => {
    montar()
    const titulo = await screen.findByRole('heading', { name: 'Terminaciones Vencidas' })
    const tarjeta = titulo.closest('.card') as HTMLElement
    for (const e of CON_NUMEROS.overdue_endings) {
      expect(within(tarjeta).getAllByText(e.ending).length).toBeGreaterThan(0)
    }
    expect(within(tarjeta).getAllByText(/^Gap: /)).toHaveLength(CON_NUMEROS.overdue_endings.length)
    const primera = CON_NUMEROS.overdue_endings[0]!
    expect(within(tarjeta).getAllByText(`${primera.ratio}x`).length).toBeGreaterThan(0)
  })

  it('«Números Recientes» muestra como mucho los 20 primeros', async () => {
    const muchos = Array.from({ length: 25 }, (_, i) => ({ number: String(1000 + i), gap: i, avg_gap: 5, ratio: 0.5, count: 7 }))
    control.getGaps.mockResolvedValue(ok({ ...CON_NUMEROS, ontime_numbers: muchos }))
    montar()
    const titulo = await screen.findByRole('heading', { name: 'Números Recientes' })
    const tarjeta = titulo.closest('.card') as HTMLElement
    expect(within(tarjeta).getAllByText(/gap:/)).toHaveLength(20)
    expect(within(tarjeta).queryByText(/1020/)).toBeNull()
    expect(within(tarjeta).getByText(/1019/)).toBeInTheDocument()
  })

  it('cada tarjeta lleva su insignia de ratio', async () => {
    montar()
    await screen.findByRole('heading', { name: 'Números Recientes' })
    expect(screen.getAllByText('Ratio > 1')).toHaveLength(2)
    expect(screen.getAllByText('Ratio ≤ 1')).toHaveLength(1)
  })

  it('las tarjetas se hacen visibles (no se quedan en blanco)', async () => {
    montar()
    const titulo = await screen.findByRole('heading', { name: 'Números Vencidos' })
    expect(titulo.closest('.card')).toHaveClass('reveal', 'visible')
  })
})

describe('vacío', () => {
  beforeEach(() => control.getGaps.mockResolvedValue(ok(SIN_NUMEROS)))

  it('sin números vencidos conserva la tabla con su cabecera y avisa que no hay', async () => {
    montar()
    const tabla = await screen.findByRole('table', { name: /números vencidos/i })
    expect(within(tabla).getAllByRole('columnheader')).toHaveLength(6)
    expect(within(tabla).getByText('Sin números vencidos')).toBeInTheDocument()
    const vencidos = screen.getByText('Números "Vencidos"').previousElementSibling!
    expect(vencidos.textContent).toBe('0')
  })

  it('sin números recientes lo dice', async () => {
    montar()
    expect(await screen.findByText('Sin números recientes')).toBeInTheDocument()
  })

  it('sin terminaciones vencidas lo dice', async () => {
    control.getGaps.mockResolvedValue(ok({ ...SIN_NUMEROS, overdue_endings: [] }))
    montar()
    expect(await screen.findByText('Sin terminaciones vencidas')).toBeInTheDocument()
  })
})

describe('error', () => {
  it('muestra el mensaje genérico, sin cargar nada, y reintenta con el botón', async () => {
    control.getGaps.mockResolvedValueOnce({ ok: false, mensaje: 'Error del servidor' })
    control.getGaps.mockResolvedValueOnce(ok(CON_NUMEROS))
    montar()
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('Error cargando gaps')
    expect(alerta).toHaveTextContent('Error del servidor')
    expect(region()).toHaveAttribute('aria-busy', 'false')
    expect(screen.queryByText('Sorteos Analizados')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Sorteos Analizados')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(control.getGaps).toHaveBeenCalledTimes(2)
  })

  it('un segundo fallo vuelve a mostrar el error y el botón', async () => {
    control.getGaps.mockResolvedValue({ ok: false, mensaje: 'Error de conexión' })
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Error de conexión')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('durante el reintento se ve el estado de carga', async () => {
    control.getGaps.mockResolvedValueOnce({ ok: false, mensaje: 'Error del servidor' })
    const d = diferida<ReturnType<typeof ok>>()
    control.getGaps.mockReturnValueOnce(d.promesa)
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(screen.getByRole('status')).toHaveTextContent('Calculando gaps...')
    expect(screen.queryByRole('alert')).toBeNull()
    await act(async () => d.resolver(ok(CON_NUMEROS)))
  })
})
