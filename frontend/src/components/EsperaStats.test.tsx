import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { StoreProvider } from '../store/StoreProvider'
import { crearStoreFalso, type StoreFalso } from '../store/storeFalso'
import { EsperaStats } from './EsperaStats'

function montar(store: StoreFalso, hijos?: React.ReactNode, extra: { id?: string } = {}) {
  return render(
    <StoreProvider store={store}>
      <EsperaStats etiqueta="Cargando prueba" {...extra}>
        {hijos}
      </EsperaStats>
    </StoreProvider>,
  )
}

describe('EsperaStats', () => {
  it('mientras cargan las estadísticas pinta el esqueleto en una región «status» con su etiqueta', () => {
    const { container } = montar(crearStoreFalso())
    expect(screen.getByRole('status', { name: 'Cargando prueba' })).toBeInTheDocument()
    expect(container.querySelectorAll('.skel-line')).toHaveLength(4)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('pinta como esqueleto lo que se le pasa y no el de por defecto', () => {
    const { container } = montar(crearStoreFalso(), <p>mi esqueleto</p>)
    expect(screen.getByText('mi esqueleto')).toBeInTheDocument()
    expect(container.querySelectorAll('.skel-line')).toHaveLength(0)
  })

  it('con `errorStats` dice que no se pudieron cargar las estadísticas y no deja el esqueleto', () => {
    const { container } = montar(crearStoreFalso({ errorStats: true }), <p>mi esqueleto</p>)
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar las estadísticas.')
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByText('mi esqueleto')).toBeNull()
    expect(container.querySelectorAll('.skel-line')).toHaveLength(0)
  })

  it('«Reintentar» pide una recarga y pasa el foco al contenedor, no a <body>', async () => {
    const store = crearStoreFalso({ errorStats: true })
    montar(store)
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(store.llamadas.filter((l) => l.accion === 'reload')).toHaveLength(1)
    expect(document.activeElement).not.toBe(document.body)
    expect(document.activeElement?.contains(screen.getByRole('alert'))).toBe(true)
  })

  it('vuelve al esqueleto cuando `errorStats` baja a false y al aviso cuando sube', () => {
    const store = crearStoreFalso({ errorStats: true })
    montar(store)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    act(() => store.cambiar({ errorStats: false }))
    expect(screen.getByRole('status', { name: 'Cargando prueba' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    act(() => store.cambiar({ errorStats: true }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('conserva el `id` en los dos estados, porque `aria-controls` apunta a él', () => {
    const store = crearStoreFalso()
    const { container } = montar(store, undefined, { id: 'region-x' })
    expect(container.querySelector('#region-x')).not.toBeNull()
    act(() => store.cambiar({ errorStats: true }))
    expect(container.querySelector('#region-x')).not.toBeNull()
  })
})
