import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { StoreProvider } from '../store/StoreProvider'
import { crearStoreFalso } from '../store/storeFalso'
import type { Snapshot } from '../store/tipos'
import { InterruptorML } from './InterruptorML'

function montar(estado: Partial<Snapshot> = {}) {
  const store = crearStoreFalso(estado)
  render(
    <StoreProvider store={store}>
      <InterruptorML />
    </StoreProvider>,
  )
  return store
}
const boton = () => screen.getByRole('button', { name: 'Alternar entre modelo ML y Estadístico' })

describe('InterruptorML', () => {
  it('en modo estadístico dice «📊 Estadístico», no está pulsado y no lleva la clase active', () => {
    montar()
    expect(boton().textContent).toBe('📊 Estadístico')
    expect(boton().getAttribute('aria-pressed')).toBe('false')
    expect(boton().classList.contains('ml-toggle')).toBe(true)
    expect(boton().classList.contains('active')).toBe(false)
  })

  it('en modo ML dice «🤖 ML Activo», está pulsado y lleva la clase active', () => {
    montar({ useML: true })
    expect(boton().textContent).toBe('🤖 ML Activo')
    expect(boton().getAttribute('aria-pressed')).toBe('true')
    expect(boton().classList.contains('active')).toBe(true)
  })

  it('un clic cambia el modo en el Store y el botón lo refleja', async () => {
    const store = montar()
    await userEvent.click(boton())
    expect(store.llamadas).toEqual([{ accion: 'setUseML', args: [true] }])
    expect(boton().textContent).toBe('🤖 ML Activo')
    await userEvent.click(boton())
    expect(store.llamadas.at(-1)).toEqual({ accion: 'setUseML', args: [false] })
    expect(boton().textContent).toBe('📊 Estadístico')
  })

  it('Intro y Espacio también lo cambian', async () => {
    const store = montar()
    boton().focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    expect(store.llamadas.map((l) => l.args[0])).toEqual([true, false])
  })

  it('sigue al Store si el modo cambia desde fuera (otra pestaña, el puente)', () => {
    const store = montar()
    act(() => store.cambiar({ useML: true }))
    expect(boton().textContent).toBe('🤖 ML Activo')
  })

  it('se marca como gestionado por React: el código antiguo no debe tocarlo', () => {
    montar()
    expect(boton().hasAttribute('data-isla')).toBe(true)
  })

  it('es un botón de tipo button', () => {
    montar()
    expect(boton().getAttribute('type')).toBe('button')
  })
})
