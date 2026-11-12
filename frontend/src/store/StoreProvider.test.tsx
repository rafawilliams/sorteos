import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { StoreProvider, useStore } from './StoreProvider'
import { crearStoreFalso } from './storeFalso'

describe('StoreProvider y useStore', () => {
  it('useStore devuelve el almacén que se pasó al proveedor', () => {
    const store = crearStoreFalso()
    const wrapper = ({ children }: { children: ReactNode }) => <StoreProvider store={store}>{children}</StoreProvider>
    const { result } = renderHook(() => useStore(), { wrapper })
    expect(result.current).toBe(store)
  })

  it('con proveedores anidados gana el más cercano', () => {
    const exterior = crearStoreFalso()
    const interior = crearStoreFalso()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StoreProvider store={exterior}>
        <StoreProvider store={interior}>{children}</StoreProvider>
      </StoreProvider>
    )
    const { result } = renderHook(() => useStore(), { wrapper })
    expect(result.current).toBe(interior)
  })

  it('fuera de un proveedor falla con un mensaje que dice qué falta', () => {
    expect(() => renderHook(() => useStore())).toThrow(/StoreProvider/)
  })

  it('el proveedor pinta a sus hijos', () => {
    const store = crearStoreFalso()
    const { result } = renderHook(() => 'hijo', {
      wrapper: ({ children }: { children: ReactNode }) => <StoreProvider store={store}>{children}</StoreProvider>,
    })
    expect(result.current).toBe('hijo')
  })
})
