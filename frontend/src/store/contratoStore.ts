/**
 * Suite de contrato de `Store` (spec frontend-react, T014): lo que toda implementación tiene que cumplir para que
 * los hooks y las islas funcionen con ella. La pasan el doble de pruebas, `LegacyStore` (T015) y `ReactStore` (T052).
 *
 * Cada comprobación es una función que lanza si el contrato se rompe, para poder probarla también contra almacenes
 * defectuosos (`contratoStore.test.ts`) y asegurar que no pasa en vacío. `describirContratoDeStore` las registra como
 * pruebas de vitest.
 *
 * Se ejercita el almacén en dos estados, recién creado y ya cargado: un defecto como devolver `{ ...stats }` solo
 * aparece cuando hay datos. Por eso cada implementación tiene que decir cómo se la carga (`ControlDeCarga`).
 */
import { describe, expect, it, vi } from 'vitest'
import type { Snapshot, Store } from './tipos'

const CAMPOS = ['sorteos', 'stats', 'useML', 'prize', 'statsPrize', 'theme', 'activeTab', 'ready'] as const satisfies readonly (keyof Snapshot)[]
const ACCIONES = ['setUseML', 'setPrize', 'setStatsPrize', 'toast', 'reload'] as const

/** Cómo llevar a un almacén concreto a un estado cargado y cómo hacer que falle su siguiente recarga. */
export interface ControlDeCarga {
  /** Deja `sorteos` y `stats` con datos y `ready` en `true`, como tras una carga correcta. */
  cargar(store: Store): Promise<void> | void
  /** Hace que la siguiente llamada a `reload` encuentre un fallo de carga (p. ej. una red caída). */
  fallarSiguienteRecarga(store: Store): void
}

type Comprobacion = (crear: () => Store, control: ControlDeCarga) => Promise<void> | void

/** El otro valor posible de un premio, para forzar un cambio. */
const otroPremio = (p: Snapshot['prize']): Snapshot['prize'] => (p === 'primero' ? 'segundo' : 'primero')

/** Ejecuta `fn` y, si falla, dice qué pieza falló al usarse suelta: la causa típica es que dependa de `this`. */
function suelta<T>(nombre: string, fn: () => T): T {
  try {
    return fn()
  } catch (error) {
    throw new Error(`«${nombre}» falla al usarse suelto, sin su almacén (¿usa this?): ${(error as Error).message}`)
  }
}

async function enEstados(crear: () => Store, control: ControlDeCarga, comprobar: (store: Store, momento: string) => void) {
  const vacio = crear()
  comprobar(vacio, 'recién creado')
  const cargado = crear()
  await control.cargar(cargado)
  comprobar(cargado, 'ya cargado')
}

export const comprobaciones: Record<string, Comprobacion> = {
  /** `useSyncExternalStore` lee muchas veces: sin cambios debe dar SIEMPRE las mismas referencias, la instantánea y cada campo. */
  async referenciaEstable(crear, control) {
    await enEstados(crear, control, (store, momento) => {
      const a = store.getSnapshot()
      const b = store.getSnapshot()
      expect(b, `la instantánea cambia de referencia sin que cambie el estado (${momento})`).toBe(a)
      for (const campo of CAMPOS) expect(b[campo], `el campo «${campo}» cambia de referencia en cada lectura (${momento})`).toBe(a[campo])
    })
  },

  /** Los hooks leen campos sueltos: cambiar uno no debe tocar la referencia de los demás, ni con datos cargados. */
  async camposIndependientes(crear, control) {
    const cambios: Array<[keyof Snapshot, (s: Store) => void, (a: Snapshot) => unknown]> = [
      ['useML', (s) => s.actions.setUseML(!s.getSnapshot().useML), (a) => !a.useML],
      ['prize', (s) => s.actions.setPrize(otroPremio(s.getSnapshot().prize)), (a) => otroPremio(a.prize)],
      ['statsPrize', (s) => s.actions.setStatsPrize(otroPremio(s.getSnapshot().statsPrize)), (a) => otroPremio(a.statsPrize)],
    ]
    for (const [campo, cambiar, esperado] of cambios) {
      await enEstados(crear, control, (store, momento) => {
        const antes = store.getSnapshot()
        cambiar(store)
        const despues = store.getSnapshot()
        expect(despues, `tras cambiar «${campo}» la instantánea sigue siendo la misma (${momento})`).not.toBe(antes)
        expect(despues[campo], `«${campo}» no tiene el valor nuevo (${momento})`).toEqual(esperado(antes))
        for (const otro of CAMPOS.filter((c) => c !== campo)) {
          expect(despues[otro], `cambiar «${campo}» tocó la referencia de «${otro}» (${momento})`).toBe(antes[otro])
        }
      })
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
  async sinDependerDeThis(crear) {
    const store = crear()
    const { subscribe } = store
    const { setUseML, setPrize, setStatsPrize, toast, reload } = store.actions
    const escucha = vi.fn()
    const cancelar = suelta('subscribe', () => subscribe(escucha))
    suelta('setUseML', () => setUseML(true))
    suelta('setPrize', () => setPrize('tercero'))
    suelta('setStatsPrize', () => setStatsPrize('segundo'))
    suelta('toast', () => toast('aviso', 100))
    const recarga = suelta('reload', () => reload())
    expect(recarga, 'reload debe devolver una promesa').toBeInstanceOf(Promise)
    await recarga
    const s = store.getSnapshot()
    expect([s.useML, s.prize, s.statsPrize]).toEqual([true, 'tercero', 'segundo'])
    expect(escucha).toHaveBeenCalled()
    cancelar()
  },

  /** Las acciones y `subscribe` van en dependencias de efectos: deben ser la misma función siempre, también tras cambios. */
  async identidadDeAcciones(crear, control) {
    const store = crear()
    expect(store.subscribe, 'subscribe cambia de identidad entre lecturas').toBe(store.subscribe)
    for (const nombre of ACCIONES) {
      expect(store.actions[nombre], `la acción «${nombre}» cambia de identidad entre lecturas`).toBe(store.actions[nombre])
    }
    const subscribe = store.subscribe
    const acciones = ACCIONES.map((nombre) => store.actions[nombre])
    store.actions.setUseML(!store.getSnapshot().useML)
    await control.cargar(store)
    await store.actions.reload()
    expect(store.subscribe, 'subscribe cambia de identidad tras un cambio de estado').toBe(subscribe)
    ACCIONES.forEach((nombre, i) => {
      expect(store.actions[nombre], `la acción «${nombre}» cambia de identidad tras un cambio de estado`).toBe(acciones[i])
    })
    expect(store.getSnapshot(), 'la instantánea no es estable tras los cambios').toBe(store.getSnapshot())
  },

  /**
   * Semántica de `reload` (`tipos.ts`): mientras dura se conservan los datos viejos, la promesa se resuelve cuando la
   * carga termina y NUNCA rechaza, ni siquiera si la carga falla; y los datos viejos siguen ahí después.
   */
  async recarga(crear, control) {
    const store = crear()
    await control.cargar(store)
    const cargado = store.getSnapshot()
    expect(cargado.stats, 'el control de carga no dejó `stats` con datos: la prueba no probaría nada').not.toBeNull()
    expect(cargado.ready, 'el control de carga no dejó `ready` en true').toBe(true)

    const enCurso = store.actions.reload()
    const durante = store.getSnapshot()
    expect(durante.stats, 'durante la recarga se vació `stats`: deben conservarse los datos viejos').not.toBeNull()
    expect(durante.ready, 'durante la recarga `ready` volvió a false: deben conservarse los datos viejos').toBe(true)
    expect(durante.sorteos, 'durante la recarga se vaciaron los sorteos').not.toHaveLength(0)
    await enCurso.catch((error: unknown) => {
      throw new Error(`reload rechazó en una recarga correcta: no debe rechazar (${(error as Error).message})`)
    })

    control.fallarSiguienteRecarga(store)
    await store.actions.reload().catch((error: unknown) => {
      throw new Error(`reload rechazó cuando falló la carga: no debe rechazar, debe resolverse y conservar los datos (${(error as Error).message})`)
    })
    const trasFallo = store.getSnapshot()
    expect(trasFallo.stats, 'tras una recarga fallida se perdieron los datos de `stats`').not.toBeNull()
    expect(trasFallo.ready, 'tras una recarga fallida `ready` volvió a false').toBe(true)
    expect(store.getSnapshot(), 'la instantánea no es estable tras la recarga').toBe(trasFallo)
  },
}

/** Registra la suite como pruebas de vitest para una implementación de `Store`. */
export function describirContratoDeStore(nombre: string, crear: () => Store, control: ControlDeCarga): void {
  describe(`contrato de Store: ${nombre}`, () => {
    it('devuelve las mismas referencias mientras no cambie el estado, vacío y cargado', () => comprobaciones.referenciaEstable!(crear, control))
    it('cambiar un campo no toca la referencia de los demás, vacío y cargado', () => comprobaciones.camposIndependientes!(crear, control))
    it('subscribe avisa tras un cambio y deja de avisar al cancelar', () => comprobaciones.suscripcion!(crear, control))
    it('subscribe y las acciones funcionan sueltas, sin depender de this', () => comprobaciones.sinDependerDeThis!(crear, control))
    it('las acciones y subscribe conservan su identidad, también tras cambios de estado', () => comprobaciones.identidadDeAcciones!(crear, control))
    it('reload conserva los datos viejos, se resuelve y nunca rechaza, ni aunque falle', () => comprobaciones.recarga!(crear, control))
  })
}
