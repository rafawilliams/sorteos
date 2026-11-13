import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FronteraDeSeccion } from './FronteraDeSeccion'

function Rota(): never {
  throw new Error('fallo interno con detalles secretos')
}

let errores: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  errores = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('FronteraDeSeccion', () => {
  it('sin fallo deja pasar a sus hijos tal cual', () => {
    render(
      <FronteraDeSeccion nombre="gaps">
        <p>hola gaps</p>
      </FronteraDeSeccion>,
    )
    expect(screen.getByText('hola gaps')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('si un hijo falla muestra un aviso genérico, sin detalles', () => {
    render(
      <FronteraDeSeccion nombre="decenas">
        <Rota />
      </FronteraDeSeccion>,
    )
    const aviso = screen.getByRole('alert')
    expect(aviso.textContent).toBe('No se pudo mostrar esta sección. Recarga la página para intentarlo de nuevo.')
    expect(aviso.textContent).not.toContain('secretos')
    expect(document.body.textContent).not.toContain('secretos')
  })

  it('el detalle va a la consola con el nombre de la sección', () => {
    render(
      <FronteraDeSeccion nombre="decenas">
        <Rota />
      </FronteraDeSeccion>,
    )
    expect(errores).toHaveBeenCalledWith('La sección «decenas» falló', expect.any(Error))
  })

  it('una sección que falla no rompe a su vecina', () => {
    render(
      <>
        <FronteraDeSeccion nombre="a">
          <Rota />
        </FronteraDeSeccion>
        <FronteraDeSeccion nombre="b">
          <p>sigo viva</p>
        </FronteraDeSeccion>
      </>,
    )
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByText('sigo viva')).toBeInTheDocument()
  })
})
