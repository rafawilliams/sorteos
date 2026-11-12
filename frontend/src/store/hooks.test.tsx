import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import type { Sorteo, Stats } from '../api/types'
import { useActiveTab, useErrorSorteos, useML, usePrize, useReady, useReload, useSorteos, useStats, useStatsPrize, useTheme, useToast } from './hooks'
import { StoreProvider } from './StoreProvider'
import { crearStoreFalso, type StoreFalso } from './storeFalso'

function montar<T>(hook: () => T, store: StoreFalso) {
  const wrapper = ({ children }: { children: ReactNode }) => <StoreProvider store={store}>{children}</StoreProvider>
  return renderHook(hook, { wrapper })
}

const SORTEO: Sorteo = {
  id: '1', fecha: '2019-10-02', cat: 'gordito', primero: '9614', segundo: '20', tercero: '72', letra: 'A', serie: '2', folio: '599',
}
const STATS = { total_sorteos: 1 } as unknown as Stats

describe('hooks de lectura', () => {
  it('devuelven el estado actual del almacén', () => {
    const store = crearStoreFalso({ sorteos: [SORTEO], stats: STATS, theme: 'light', activeTab: 'seguimiento', ready: true })
    expect(montar(() => useSorteos(), store).result.current).toEqual([SORTEO])
    expect(montar(() => useStats(), store).result.current).toBe(STATS)
    expect(montar(() => useTheme(), store).result.current).toBe('light')
    expect(montar(() => useActiveTab(), store).result.current).toBe('seguimiento')
    expect(montar(() => useReady(), store).result.current).toBe(true)
  })

  it('stats es null mientras no llegó (la isla debe mostrar su esqueleto)', () => {
    expect(montar(() => useStats(), crearStoreFalso()).result.current).toBeNull()
  })

  it('se actualizan cuando cambia el almacén', () => {
    const store = crearStoreFalso()
    const { result } = montar(() => useTheme(), store)
    expect(result.current).toBe('dark')
    act(() => store.cambiar({ theme: 'light' }))
    expect(result.current).toBe('light')
  })

  it('useErrorSorteos dice si la carga de sorteos falló y se actualiza al reintentar', () => {
    const store = crearStoreFalso({ errorSorteos: true })
    const { result } = montar(() => useErrorSorteos(), store)
    expect(result.current).toBe(true)
    act(() => store.cambiar({ errorSorteos: false }))
    expect(result.current).toBe(false)
  })

  it('useErrorSorteos vale false mientras no haya fallado nada', () => {
    expect(montar(() => useErrorSorteos(), crearStoreFalso()).result.current).toBe(false)
  })

  it('un componente no se vuelve a pintar por cambios de campos que no lee', () => {
    const store = crearStoreFalso()
    let pintados = 0
    montar(() => {
      pintados += 1
      return useStats()
    }, store)
    const antes = pintados
    act(() => store.cambiar({ theme: 'light' }))
    act(() => store.cambiar({ useML: true }))
    act(() => store.cambiar({ activeTab: 'gaps' }))
    expect(pintados).toBe(antes)
    act(() => store.cambiar({ stats: STATS }))
    expect(pintados).toBeGreaterThan(antes)
  })
})

describe('hooks con acción: devuelven [valor, cambiar]', () => {
  it('useML lee y escribe el modo de predicción', () => {
    const store = crearStoreFalso()
    const { result } = montar(() => useML(), store)
    expect(result.current[0]).toBe(false)
    act(() => result.current[1](true))
    expect(result.current[0]).toBe(true)
    expect(store.llamadas).toEqual([{ accion: 'setUseML', args: [true] }])
  })

  it('usePrize y useStatsPrize son independientes', () => {
    const store = crearStoreFalso()
    const premio = montar(() => usePrize(), store)
    const premioStats = montar(() => useStatsPrize(), store)
    act(() => premio.result.current[1]('segundo'))
    expect(premio.result.current[0]).toBe('segundo')
    expect(premioStats.result.current[0]).toBe('primero')
    act(() => premioStats.result.current[1]('tercero'))
    expect(premioStats.result.current[0]).toBe('tercero')
    expect(premio.result.current[0]).toBe('segundo')
  })

  it('la función de cambio no cambia de identidad entre pintados (se puede usar en dependencias)', () => {
    const store = crearStoreFalso()
    const { result, rerender } = montar(() => useML(), store)
    const antes = result.current[1]
    rerender()
    act(() => store.cambiar({ useML: true }))
    expect(result.current[1]).toBe(antes)
  })
})

describe('hooks de acción sin valor', () => {
  it('useToast avisa con el mensaje y la duración', () => {
    const store = crearStoreFalso()
    const { result } = montar(() => useToast(), store)
    result.current('Copiado: 0074', 3000)
    expect(store.llamadas).toEqual([{ accion: 'toast', args: ['Copiado: 0074', 3000] }])
  })

  it('useReload devuelve la promesa de la recarga', async () => {
    const store = crearStoreFalso()
    const { result } = montar(() => useReload(), store)
    await expect(result.current()).resolves.toBeUndefined()
    expect(store.llamadas).toEqual([{ accion: 'reload', args: [] }])
  })
})
