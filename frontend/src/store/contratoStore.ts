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

const CAMPOS = ['sorteos', 'stats', 'useML', 'prize', 'statsPrize', 'theme', 'activeTab', 'ready', 'simulacion', 'errorSorteos'] as const satisfies readonly (keyof Snapshot)[]
const ACCIONES = ['setUseML', 'setPrize', 'setStatsPrize', 'toast', 'simularNumero', 'reload'] as const

/** Cómo llevar a un almacén concreto a un estado cargado y cómo hacer que falle su siguiente recarga. */
export interface ControlDeCarga {
  /** Deja `sorteos` y `stats` con datos y `ready` en `true`, como tras una carga correcta. */
  cargar(store: Store): Promise<void> | void
  /**
   * Hace que la siguiente llamada a `reload` encuentre un fallo de carga: una red caída o una respuesta de error
   * (p. ej. un 500 con un cuerpo JSON). El almacén debe tragarse el fallo y conservar los datos viejos; en
   * particular, un cuerpo de error no puede ocupar el lugar de `stats`.
   */
  fallarSiguienteRecarga(store: Store): void
}

type Comprobacion = (crear: () => Store, control: ControlDeCarga) => Promise<void> | void

/** El otro valor posible de un premio, para forzar un cambio. */
const otroPremio = (p: Snapshot['prize']): Snapshot['prize'] => (p === 'primero' ? 'segundo' : 'primero')

/**
 * Llama a `reload` y observa el estado en TODOS los avisos y en varios turnos de microtareas (un almacén puede vaciar
 * datos tras un `await` interno: una sola lectura síncrona no lo vería). Exige que se conserven los datos viejos, y
 * que la promesa no rechace; el rechazo se recoge al instante para que, si fallan antes las aserciones, no quede una
 * promesa rechazada sin manejar que oculte la causa. Devuelve la instantánea final.
 */
async function recargarObservando(store: Store, mensajeSiRechaza: (detalle: string) => string, momento: string): Promise<Snapshot> {
  const vistos: Snapshot[] = []
  const cancelar = store.subscribe(() => vistos.push(store.getSnapshot()))
  const resultado = store.actions.reload().then(
    () => null,
    (error: unknown) => error as Error,
  )
  vistos.push(store.getSnapshot())
  for (let turno = 0; turno < 10; turno += 1) {
    await Promise.resolve()
    vistos.push(store.getSnapshot())
  }
  const error = await resultado
  cancelar()
  vistos.push(store.getSnapshot())
  if (error) throw new Error(mensajeSiRechaza(error.message))
  vistos.forEach((v, i) => {
    expect(v.stats, `${momento} se vació \`stats\` (observación ${i}): deben conservarse los datos viejos`).not.toBeNull()
    expect(v.ready, `${momento} \`ready\` volvió a false (observación ${i}): deben conservarse los datos viejos`).toBe(true)
    expect(v.sorteos, `${momento} se vaciaron los sorteos (observación ${i})`).not.toHaveLength(0)
  })
  return store.getSnapshot()
}

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

  /**
   * `subscribe` avisa tras el cambio que hace CADA acción de escritura, y la escucha ya ve el estado nuevo
   * (si avisara antes de actualizar, `useSyncExternalStore` leería el valor viejo y no repintaría). Devuelve la
   * función que cancela.
   */
  suscripcion(crear) {
    const cambios: Array<[string, (s: Store) => void, keyof Snapshot, (a: Snapshot) => unknown]> = [
      ['setUseML', (s) => s.actions.setUseML(!s.getSnapshot().useML), 'useML', (a) => !a.useML],
      ['setPrize', (s) => s.actions.setPrize(otroPremio(s.getSnapshot().prize)), 'prize', (a) => otroPremio(a.prize)],
      ['setStatsPrize', (s) => s.actions.setStatsPrize(otroPremio(s.getSnapshot().statsPrize)), 'statsPrize', (a) => otroPremio(a.statsPrize)],
    ]
    for (const [nombre, ejecutar, campo, esperado] of cambios) {
      const store = crear()
      const antes = store.getSnapshot()
      const vistos: Snapshot[] = []
      const cancelar = store.subscribe(() => vistos.push(store.getSnapshot()))
      expect(typeof cancelar, 'subscribe debe devolver la función que cancela').toBe('function')
      ejecutar(store)
      expect(vistos.length, `«${nombre}» no avisó tras un cambio`).toBeGreaterThan(0)
      expect(vistos.at(-1)![campo], `«${nombre}» avisó antes de actualizar el estado: la escucha leyó el valor viejo`).toEqual(esperado(antes))
      cancelar()
      vistos.length = 0
      ejecutar(store)
      expect(vistos, `«${nombre}» siguió avisando tras cancelar la suscripción`).toHaveLength(0)
    }
  },

  /**
   * Los hooks pasan `subscribe` y las acciones sueltas (`useSyncExternalStore(store.subscribe, …)`,
   * `[valor, store.actions.setUseML]`): no pueden depender de `this`. `getSnapshot` sí se llama como método.
   */
  async sinDependerDeThis(crear) {
    const store = crear()
    const { subscribe } = store
    const { setUseML, setPrize, setStatsPrize, toast, simularNumero, reload } = store.actions
    const escucha = vi.fn()
    const cancelar = suelta('subscribe', () => subscribe(escucha))
    suelta('setUseML', () => setUseML(true))
    suelta('setPrize', () => setPrize('tercero'))
    suelta('setStatsPrize', () => setStatsPrize('segundo'))
    suelta('toast', () => toast('aviso', 100))
    suelta('simularNumero', () => simularNumero('0042'))
    const recarga = suelta('reload', () => reload())
    expect(recarga, 'reload debe devolver una promesa').toBeInstanceOf(Promise)
    await recarga
    const s = store.getSnapshot()
    expect([s.useML, s.prize, s.statsPrize]).toEqual([true, 'tercero', 'segundo'])
    expect(escucha).toHaveBeenCalled()
    cancelar()
  },

  /**
   * «Simular» de Mis Números (`tipos.ts`, `simulacion`): sin petición es `null`; tras `simularNumero(n)` el Simulador
   * queda activo y `simulacion` lleva ese número; pedir el MISMO número otra vez es otra petición (otro `id`, otra
   * referencia), porque la isla lanza una simulación por cada `id` nuevo; y la escucha de `subscribe` ya ve el
   * estado nuevo (si avisara antes, `useSyncExternalStore` leería la petición vieja).
   */
  async simulacion(crear, control) {
    await enEstados(crear, control, (store, momento) => {
      expect(store.getSnapshot().simulacion, `sin pedir nada, «simulacion» debe ser null (${momento})`).toBeNull()
      // `LegacyStore` solo tiene enganchadas las pestañas tras el arranque de app.js (`DOMContentLoaded`), y nadie
      // puede pulsar «Simular» antes de que lleguen los datos: lo demás se exige con el almacén ya cargado.
      if (momento === 'recién creado') return
      const vistos: Snapshot[] = []
      const cancelar = store.subscribe(() => vistos.push(store.getSnapshot()))
      store.actions.simularNumero('0042')
      const primera = store.getSnapshot()
      expect(primera.simulacion?.numero, `simularNumero('0042') no dejó el número en «simulacion» (${momento})`).toBe('0042')
      expect(primera.activeTab, `simularNumero no dejó el Simulador como pestaña activa (${momento})`).toBe('simulador')
      expect(vistos.at(-1)?.simulacion?.numero, `simularNumero avisó antes de actualizar «simulacion»: la escucha leyó la petición vieja (${momento})`).toBe('0042')
      store.actions.simularNumero('0042')
      const segunda = store.getSnapshot()
      expect(segunda.simulacion, `repetir el mismo número no es otra petición: «simulacion» conserva la referencia (${momento})`).not.toBe(primera.simulacion)
      expect(segunda.simulacion?.id, `repetir el mismo número no cambió el «id» de la petición (${momento})`).not.toBe(primera.simulacion?.id)
      store.actions.simularNumero('9614')
      expect(store.getSnapshot().simulacion?.numero, `un número distinto no reemplazó la petición (${momento})`).toBe('9614')
      cancelar()
    })
  },

  /**
   * `errorSorteos` (`tipos.ts`): un booleano que vale false mientras no haya fallado la carga de sorteos, vacío y cargado, y
   * que una recarga correcta no toca. (Que pase a true al fallar la primera carga, y a false al reintentar, depende de cómo
   * cargue cada implementación y se prueba contra ella: el puente de app.js lo hace en puente-error-sorteos.test.ts.)
   */
  async errorDeCargaDeSorteos(crear, control) {
    await enEstados(crear, control, (store, momento) => {
      expect(typeof store.getSnapshot().errorSorteos, `«errorSorteos» debe ser un booleano (${momento})`).toBe('boolean')
      expect(store.getSnapshot().errorSorteos, `sin ningún fallo de carga «errorSorteos» debe ser false (${momento})`).toBe(false)
    })
    const store = crear()
    await control.cargar(store)
    await store.actions.reload()
    expect(store.getSnapshot().errorSorteos, 'tras una recarga correcta «errorSorteos» sigue en false').toBe(false)
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

    // Recarga correcta: se observa el estado en cada aviso y en varios turnos de microtareas, no en un solo instante.
    const trasExito = await recargarObservando(store, (n) => `reload rechazó en una recarga correcta: no debe rechazar (${n})`, 'durante la recarga')
    expect(trasExito.stats, 'tras una recarga correcta `stats` quedó vacío').not.toBeNull()
    expect(trasExito.ready, 'tras una recarga correcta `ready` quedó en false').toBe(true)
    expect(trasExito.sorteos, 'tras una recarga correcta quedaron los sorteos vacíos').not.toHaveLength(0)

    // Recarga fallida: se traga el fallo y NO cambia nada (ningún campo), ni durante ni después.
    control.fallarSiguienteRecarga(store)
    const trasFallo = await recargarObservando(
      store,
      (n) => `reload rechazó cuando falló la carga: no debe rechazar, debe resolverse y conservar los datos (${n})`,
      'durante la recarga fallida',
    )
    for (const campo of CAMPOS) {
      expect(trasFallo[campo], `una recarga fallida cambió «${campo}»: debe dejar todo como estaba`).toBe(trasExito[campo])
    }
    expect(store.getSnapshot(), 'la instantánea no es estable tras la recarga').toBe(trasFallo)
  },
}

/** Registra la suite como pruebas de vitest para una implementación de `Store`. */
export function describirContratoDeStore(nombre: string, crear: () => Store, control: ControlDeCarga): void {
  describe(`contrato de Store: ${nombre}`, () => {
    it('devuelve las mismas referencias mientras no cambie el estado, vacío y cargado', () => comprobaciones.referenciaEstable!(crear, control))
    it('cambiar un campo no toca la referencia de los demás, vacío y cargado', () => comprobaciones.camposIndependientes!(crear, control))
    it('subscribe avisa tras un cambio y deja de avisar al cancelar', () => comprobaciones.suscripcion!(crear, control))
    it('simularNumero deja el Simulador activo y una petición nueva en `simulacion`, también al repetir el número', () => comprobaciones.simulacion!(crear, control))
    it('errorSorteos es un booleano que vale false sin fallos de carga, vacío y cargado', () => comprobaciones.errorDeCargaDeSorteos!(crear, control))
    it('subscribe y las acciones funcionan sueltas, sin depender de this', () => comprobaciones.sinDependerDeThis!(crear, control))
    it('las acciones y subscribe conservan su identidad, también tras cambios de estado', () => comprobaciones.identidadDeAcciones!(crear, control))
    it('reload conserva los datos viejos, se resuelve y nunca rechaza, ni aunque falle', () => comprobaciones.recarga!(crear, control))
  })
}
