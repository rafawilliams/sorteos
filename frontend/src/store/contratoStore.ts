/**
 * Suite de contrato de `Store` (spec frontend-react, T014): lo que toda implementación tiene que cumplir para que
 * los hooks y las islas funcionen con ella. La pasan el doble de pruebas, `LegacyStore` (T015) y `ReactStore` (T052).
 *
 * Cada comprobación es una función que lanza si el contrato se rompe, para poder probarla también contra almacenes
 * defectuosos (`contratoStore.test.ts`) y asegurar que no pasa en vacío. `describirContratoDeStore` las registra como
 * pruebas de vitest.
 */
import { describe, expect, it, vi } from 'vitest'
import type { Snapshot, Store } from './tipos'

const CAMPOS = ['sorteos', 'stats', 'useML', 'prize', 'statsPrize', 'theme', 'activeTab', 'ready'] as const satisfies readonly (keyof Snapshot)[]

type Comprobacion = (crear: () => Store) => void

/** El otro valor posible de un premio, para forzar un cambio. */
const otroPremio = (p: Snapshot['prize']): Snapshot['prize'] => (p === 'primero' ? 'segundo' : 'primero')

export const comprobaciones: Record<string, Comprobacion> = {
  /** `useSyncExternalStore` lee muchas veces: sin cambios debe dar SIEMPRE las mismas referencias, la instantánea y cada campo. */
  referenciaEstable(crear) {
    const store = crear()
    const a = store.getSnapshot()
    const b = store.getSnapshot()
    expect(b, 'la instantánea cambia de referencia sin que cambie el estado').toBe(a)
    for (const campo of CAMPOS) expect(b[campo], `el campo «${campo}» cambia de referencia en cada lectura`).toBe(a[campo])
  },

  /** Los hooks leen campos sueltos: cambiar uno no debe tocar la referencia de los demás. */
  camposIndependientes(crear) {
    const cambios: Array<[keyof Snapshot, (s: Store) => void, (a: Snapshot) => unknown]> = [
      ['useML', (s) => s.actions.setUseML(!s.getSnapshot().useML), (a) => !a.useML],
      ['prize', (s) => s.actions.setPrize(otroPremio(s.getSnapshot().prize)), (a) => otroPremio(a.prize)],
      ['statsPrize', (s) => s.actions.setStatsPrize(otroPremio(s.getSnapshot().statsPrize)), (a) => otroPremio(a.statsPrize)],
    ]
    for (const [campo, cambiar, esperado] of cambios) {
      const store = crear()
      const antes = store.getSnapshot()
      cambiar(store)
      const despues = store.getSnapshot()
      expect(despues, `tras cambiar «${campo}» la instantánea sigue siendo la misma`).not.toBe(antes)
      expect(despues[campo], `«${campo}» no tiene el valor nuevo`).toEqual(esperado(antes))
      for (const otro of CAMPOS.filter((c) => c !== campo)) {
        expect(despues[otro], `cambiar «${campo}» tocó la referencia de «${otro}»`).toBe(antes[otro])
      }
    }
  },

  /** `subscribe` avisa tras cada cambio y devuelve la función que cancela. */
  suscripcion(crear) {
    const store = crear()
    const escucha = vi.fn()
    const cancelar = store.subscribe(escucha)
    expect(typeof cancelar, 'subscribe debe devolver la función que cancela').toBe('function')
    store.actions.setUseML(!store.getSnapshot().useML)
    expect(escucha, 'no avisó tras un cambio').toHaveBeenCalled()
    cancelar()
    escucha.mockClear()
    store.actions.setUseML(!store.getSnapshot().useML)
    expect(escucha, 'siguió avisando tras cancelar la suscripción').not.toHaveBeenCalled()
  },

  /**
   * Los hooks pasan `subscribe` y las acciones sueltas (`useSyncExternalStore(store.subscribe, …)`,
   * `[valor, store.actions.setUseML]`): no pueden depender de `this`. `getSnapshot` sí se llama como método.
   */
  sinDependerDeThis(crear) {
    const store = crear()
    const { subscribe } = store
    const { setUseML, setPrize, setStatsPrize, toast, reload } = store.actions
    const escucha = vi.fn()
    const cancelar = subscribe(escucha)
    setUseML(true)
    setPrize('tercero')
    setStatsPrize('segundo')
    toast('aviso', 100)
    expect(reload(), 'reload debe devolver una promesa').toBeInstanceOf(Promise)
    const s = store.getSnapshot()
    expect([s.useML, s.prize, s.statsPrize]).toEqual([true, 'tercero', 'segundo'])
    expect(escucha).toHaveBeenCalled()
    cancelar()
  },

  /** Las acciones y `subscribe` se usan en dependencias de efectos: deben ser siempre la misma función. */
  identidadDeAcciones(crear) {
    const store = crear()
    expect(store.subscribe, 'subscribe cambia de identidad').toBe(store.subscribe)
    for (const nombre of ['setUseML', 'setPrize', 'setStatsPrize', 'toast', 'reload'] as const) {
      expect(store.actions[nombre], `la acción «${nombre}» cambia de identidad entre lecturas`).toBe(store.actions[nombre])
    }
  },
}

/** Registra la suite como pruebas de vitest para una implementación de `Store`. */
export function describirContratoDeStore(nombre: string, crear: () => Store): void {
  describe(`contrato de Store: ${nombre}`, () => {
    it('devuelve las mismas referencias mientras no cambie el estado (instantánea y campos)', () => comprobaciones.referenciaEstable!(crear))
    it('cambiar un campo no toca la referencia de los demás', () => comprobaciones.camposIndependientes!(crear))
    it('subscribe avisa tras un cambio y deja de avisar al cancelar', () => comprobaciones.suscripcion!(crear))
    it('subscribe y las acciones funcionan sueltas, sin depender de this', () => comprobaciones.sinDependerDeThis!(crear))
    it('las acciones y subscribe conservan su identidad', () => comprobaciones.identidadDeAcciones!(crear))
  })
}
