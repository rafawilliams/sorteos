import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StoreProvider } from '../store/StoreProvider'
import { crearStoreFalso } from '../store/storeFalso'
import { BotonCopiar } from './BotonCopiar'

const portapapeles = (valor: unknown) => Object.defineProperty(navigator, 'clipboard', { value: valor, configurable: true })
let escribir: ReturnType<typeof vi.fn>

function montar(numero = '9541') {
  const store = crearStoreFalso()
  const vista = render(
    <StoreProvider store={store}>
      <BotonCopiar numero={numero} />
    </StoreProvider>,
  )
  return { store, ...vista }
}
const boton = () => screen.getByRole('button')
const clic = async () => act(async () => void fireEvent.click(boton()))
const avisos = (store: ReturnType<typeof crearStoreFalso>) => store.llamadas.filter((l) => l.accion === 'toast').map((l) => l.args)

beforeEach(() => {
  vi.useFakeTimers()
  escribir = vi.fn().mockResolvedValue(undefined)
  portapapeles({ writeText: escribir })
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('BotonCopiar', () => {
  it('es un botón «Copiar» con el número en `data-numero` (no en `data-num`, que usa el `copyNumber` antiguo) y un nombre accesible que lo distingue', () => {
    montar('9541')
    expect(boton()).toHaveTextContent('Copiar')
    expect(boton()).toHaveAttribute('type', 'button')
    expect(boton()).toHaveClass('copy-btn')
    expect(boton()).toHaveAttribute('data-numero', '9541')
    // `copyNumber` de app.js reescribe el texto de todo `.copy-btn[data-num="…"]`: este botón no debe entrar en ese selector.
    expect(boton()).not.toHaveAttribute('data-num')
    expect(document.querySelectorAll('.copy-btn[data-num="9541"]')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Copiar 9541' })).toBeInTheDocument()
  })

  it('al pulsarlo copia el número, avisa «Copiado: …» y se marca «OK»', async () => {
    const { store } = montar('9541')
    await clic()
    expect(escribir).toHaveBeenCalledWith('9541')
    expect(avisos(store)).toEqual([['Copiado: 9541', undefined]])
    expect(boton()).toHaveTextContent('OK')
    expect(boton()).toHaveClass('copied')
  })

  it('el nombre accesible acompaña al estado: «Copiado 9541» mientras dice «OK»', async () => {
    montar('9541')
    await clic()
    expect(screen.getByRole('button', { name: 'Copiado 9541' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copiar 9541' })).not.toBeInTheDocument()
  })

  it('vuelve a «Copiar» a los 1500 ms y no antes, con su nombre de antes', async () => {
    montar('9541')
    await clic()
    act(() => void vi.advanceTimersByTime(1499))
    expect(boton()).toHaveTextContent('OK')
    act(() => void vi.advanceTimersByTime(1))
    expect(boton()).toHaveTextContent('Copiar')
    expect(boton()).not.toHaveClass('copied')
    expect(screen.getByRole('button', { name: 'Copiar 9541' })).toBeInTheDocument()
  })

  it('un segundo clic dentro del plazo lo reinicia', async () => {
    montar()
    await clic()
    act(() => void vi.advanceTimersByTime(1000))
    await clic()
    act(() => void vi.advanceTimersByTime(1000))
    expect(boton()).toHaveTextContent('OK')
    act(() => void vi.advanceTimersByTime(500))
    expect(boton()).toHaveTextContent('Copiar')
  })

  it('si el portapapeles rechaza, avisa y el botón sigue siendo «Copiar»', async () => {
    escribir.mockRejectedValue(new Error('denegado'))
    const { store } = montar()
    await clic()
    expect(avisos(store)).toEqual([['No se pudo copiar', undefined]])
    expect(boton()).toHaveTextContent('Copiar')
    expect(boton()).not.toHaveClass('copied')
  })

  it('sin portapapeles en el navegador avisa en vez de lanzar', async () => {
    portapapeles(undefined)
    const { store } = montar()
    await clic()
    expect(avisos(store)).toEqual([['No se pudo copiar', undefined]])
  })

  it('si el botón desaparece antes de que responda el portapapeles, el aviso sale igual (la copia se hizo) pero no queda ningún temporizador', async () => {
    let responder!: () => void
    escribir.mockReturnValue(new Promise<void>((r) => (responder = r)))
    const { store, unmount } = montar('9541')
    act(() => void fireEvent.click(boton())) // la copia queda en vuelo
    unmount()
    await act(async () => responder())
    expect(avisos(store)).toEqual([['Copiado: 9541', undefined]])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('si el botón desaparece y el portapapeles rechaza, también se avisa del fallo (mismo trato que el éxito)', async () => {
    let rechazar!: (e: Error) => void
    escribir.mockReturnValue(new Promise<void>((_, r) => (rechazar = r)))
    const { store, unmount } = montar()
    act(() => void fireEvent.click(boton()))
    unmount()
    await act(async () => rechazar(new Error('denegado')))
    expect(avisos(store)).toEqual([['No se pudo copiar', undefined]])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('desmontar con el temporizador en marcha no deja nada pendiente', async () => {
    const { unmount } = montar()
    await clic()
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
