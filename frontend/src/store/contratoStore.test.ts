import { describe, expect, it } from 'vitest'
import type { Sorteo, Stats } from '../api/types'
import { comprobaciones, describirContratoDeStore, type ControlDeCarga } from './contratoStore'
import { crearStoreFalso, type StoreFalso } from './storeFalso'
import type { Snapshot, Store } from './tipos'

const SORTEO = { id: '1', fecha: '2019-10-02', cat: 'gordito', primero: '9614', segundo: '20', tercero: '72', letra: 'A', serie: '2', folio: '5' } as Sorteo
const STATS = { total_sorteos: 1 } as unknown as Stats

/** Cómo llevar al doble (y a los almacenes derivados de él) a un estado cargado y hacer que falle la recarga. */
const control: ControlDeCarga = {
  cargar: (s) => (s as StoreFalso).cambiar({ sorteos: [SORTEO], stats: STATS, ready: true }),
  fallarSiguienteRecarga: (s) => (s as StoreFalso).fallarSiguienteRecarga(),
}

// La suite de contrato es lo que toda implementación de `Store` (el doble, `LegacyStore`, `ReactStore`) tiene que pasar.
describirContratoDeStore('doble de pruebas (crearStoreFalso)', () => crearStoreFalso(), control)

// ---------------------------------------------------------------------------
// Almacenes correctos y rotos a propósito, cada uno con UN solo defecto: la suite tiene que rechazarlos
// por esa causa (se comprueba el mensaje), no por casualidad.
// ---------------------------------------------------------------------------

/** Almacén correcto escrito como clase: usa `this`, pero con flechas, así que sus piezas funcionan sueltas. */
class StoreClaseConFlechas implements Store {
  private snapshot: Snapshot = crearStoreFalso().getSnapshot()
  private escuchas = new Set<() => void>()
  private fallaLaRecarga = false
  private peticiones = 0
  getSnapshot() {
    return this.snapshot // se llama siempre como método del almacén
  }
  subscribe = (escucha: () => void) => {
    this.escuchas.add(escucha)
    return () => {
      this.escuchas.delete(escucha)
    }
  }
  private poner(parcial: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...parcial }
    this.escuchas.forEach((e) => e())
  }
  cargar() {
    this.poner({ sorteos: [SORTEO], stats: STATS, ready: true })
  }
  fallarSiguienteRecarga() {
    this.fallaLaRecarga = true
  }
  actions = {
    setUseML: (v: boolean) => this.poner({ useML: v }),
    setPrize: (p: Snapshot['prize']) => this.poner({ prize: p }),
    setStatsPrize: (p: Snapshot['statsPrize']) => this.poner({ statsPrize: p }),
    toast: () => {},
    simularNumero: (n: string) => {
      this.peticiones += 1
      this.poner({ activeTab: 'simulador', simulacion: { numero: n, id: this.peticiones } })
    },
    reload: async () => {
      this.fallaLaRecarga = false // un fallo se registra y se traga; los datos viejos se quedan
    },
  }
}

const controlDeClase: ControlDeCarga = {
  cargar: (s) => (s as StoreClaseConFlechas).cargar(),
  fallarSiguienteRecarga: (s) => (s as StoreClaseConFlechas).fallarSiguienteRecarga(),
}

function conSubscribeConThis(): Store {
  const base = new StoreClaseConFlechas()
  class Roto {
    private escuchas = new Set<() => void>()
    subscribe(escucha: () => void) {
      this.escuchas.add(escucha)
      base.subscribe(escucha)
      return () => {
        this.escuchas.delete(escucha)
      }
    }
  }
  const roto = new Roto()
  return Object.assign(Object.create(base), { subscribe: roto.subscribe }) as Store
}

/** Defecto único: `setUseML` es un método que usa `this` (`subscribe` y el resto están bien). */
function conAccionConThis(): Store {
  const base = new StoreClaseConFlechas()
  const roto = {
    escalar: 1,
    setUseML(this: { escalar: number }, v: boolean) {
      base.actions.setUseML(v && this.escalar === 1) // `this` indefinido si se usa suelta
    },
  }
  return Object.assign(Object.create(base), { actions: { ...base.actions, setUseML: roto.setUseML } }) as Store
}

/** Almacén escrito a mano, correcto por defecto, con interruptores para introducir UN defecto de notificación. */
class StoreManual implements Store {
  private snapshot: Snapshot = crearStoreFalso().getSnapshot()
  private escuchas = new Set<() => void>()
  fallosTragados = 0
  private fallosPendientes = 0
  private peticiones = 0
  constructor(private opciones: { sinAvisarEn?: string[]; avisarAntes?: boolean; vaciaStatsSinAvisarEnReload?: boolean } = {}) {}
  getSnapshot() {
    return this.snapshot
  }
  subscribe = (escucha: () => void) => {
    this.escuchas.add(escucha)
    return () => {
      this.escuchas.delete(escucha)
    }
  }
  private poner(accion: string, parcial: Partial<Snapshot>) {
    const avisar = () => {
      if (!this.opciones.sinAvisarEn?.includes(accion)) this.escuchas.forEach((e) => e())
    }
    if (this.opciones.avisarAntes) avisar() // defecto: la escucha lee el estado viejo
    this.snapshot = { ...this.snapshot, ...parcial }
    if (!this.opciones.avisarAntes) avisar()
  }
  cargar() {
    this.poner('cargar', { sorteos: [SORTEO], stats: STATS, ready: true })
  }
  fallarSiguienteRecarga() {
    this.fallosPendientes += 1
  }
  actions = {
    setUseML: (v: boolean) => this.poner('setUseML', { useML: v }),
    setPrize: (p: Snapshot['prize']) => this.poner('setPrize', { prize: p }),
    setStatsPrize: (p: Snapshot['statsPrize']) => this.poner('setStatsPrize', { statsPrize: p }),
    toast: () => {},
    simularNumero: (n: string) => {
      this.peticiones += 1
      this.poner('simularNumero', { activeTab: 'simulador', simulacion: { numero: n, id: this.peticiones } })
    },
    reload: async () => {
      if (this.opciones.vaciaStatsSinAvisarEnReload) {
        // defecto: vacía `stats` un momento SIN avisar a nadie (solo se ve leyendo el estado a intervalos)
        const viejo = this.snapshot
        await Promise.resolve()
        this.snapshot = { ...this.snapshot, stats: null }
        await Promise.resolve()
        this.snapshot = viejo
      }
      if (this.fallosPendientes > 0) {
        this.fallosPendientes -= 1
        this.fallosTragados += 1 // el fallo se registraría y se traga; los datos viejos se quedan
      }
    },
  }
}

const controlManual: ControlDeCarga = {
  cargar: (s) => (s as StoreManual).cargar(),
  fallarSiguienteRecarga: (s) => (s as StoreManual).fallarSiguienteRecarga(),
}

/** Defecto único: la instantánea es estable pero `sorteos` devuelve un array nuevo en cada lectura. */
function conCampoInestableDesdeElPrincipio(): Store {
  const base = crearStoreFalso()
  const instantanea = { ...base.getSnapshot() }
  Object.defineProperty(instantanea, 'sorteos', { enumerable: true, get: () => [] as Snapshot['sorteos'] })
  return { ...base, getSnapshot: () => instantanea } as Store
}

/** Defecto único: con el estado vacío es estable, pero tras cargar `stats` es una copia nueva en cada lectura. */
function conStatsInestableTrasCargar(): Store {
  const base = crearStoreFalso()
  const porInstantanea = new WeakMap<Snapshot, Snapshot>()
  return {
    ...base,
    getSnapshot() {
      const real = base.getSnapshot()
      if (real.stats === null) return real
      let derivada = porInstantanea.get(real)
      if (!derivada) {
        derivada = { ...real }
        Object.defineProperty(derivada, 'stats', { enumerable: true, get: () => ({ ...real.stats }) })
        porInstantanea.set(real, derivada)
      }
      return derivada
    },
  } as Store
}

function conSnapshotNuevoEnCadaLectura(): Store {
  const base = crearStoreFalso()
  return { ...base, getSnapshot: () => ({ ...base.getSnapshot() }) } as Store
}

/** Copia de las acciones con funciones NUEVAS (no las mismas referencias): cambian de identidad de verdad. */
function accionesRenovadas(actions: Store['actions']): Store['actions'] {
  return Object.fromEntries(
    Object.entries(actions).map(([nombre, funcion]) => [nombre, (...args: unknown[]) => (funcion as (...a: unknown[]) => unknown)(...args)]),
  ) as unknown as Store['actions']
}

/** Defecto único: las acciones se reconstruyen cada vez que cambia el estado (como un `useMemo` sobre el snapshot). */
function conAccionesQueCambianTrasUnCambio(): Store {
  const base = crearStoreFalso()
  let para: Snapshot | null = null
  let actions = base.actions
  return {
    ...base,
    get actions() {
      const ahora = base.getSnapshot()
      if (para !== ahora) {
        para = ahora
        actions = accionesRenovadas(base.actions)
      }
      return actions
    },
  } as Store
}

/** Defecto único: `subscribe` es otra función después del primer cambio de estado. */
function conSubscribeInestableTrasUnCambio(): Store {
  const base = crearStoreFalso()
  let version = 0
  let subscribe = (escucha: () => void) => base.subscribe(escucha)
  base.subscribe(() => {
    version += 1
    subscribe = (escucha: () => void) => base.subscribe(escucha)
    void version
  })
  return {
    ...base,
    get subscribe() {
      return subscribe
    },
  } as Store
}

/** Defecto único: las acciones se renuevan solo al terminar una recarga. */
function conAccionesQueCambianTrasUnReload(): Store {
  const base = crearStoreFalso()
  let actions: Store['actions'] = {
    ...base.actions,
    reload: async () => {
      await base.actions.reload()
      actions = accionesRenovadas(actions)
    },
  }
  return {
    ...base,
    get actions() {
      return actions
    },
  } as Store
}

function conAccionesNuevasEnCadaLectura(): Store {
  const base = crearStoreFalso()
  return {
    ...base,
    get actions() {
      return accionesRenovadas(base.actions)
    },
  } as Store
}

function sinCancelarSuscripcion(): Store {
  const base = crearStoreFalso()
  return {
    ...base,
    subscribe: (escucha: () => void) => {
      base.subscribe(escucha)
      return () => {}
    },
  } as Store
}

function sinAvisarTrasUnCambio(): Store {
  const base = crearStoreFalso()
  return { ...base, subscribe: () => () => {} } as Store
}

/** Defecto único: «simular» abre la pestaña pero no deja ninguna petición en `simulacion`. */
function queNoFijaLaSimulacion(): Store {
  const base = crearStoreFalso()
  return { ...base, actions: { ...base.actions, simularNumero: () => base.cambiar({ activeTab: 'simulador' }) } } as Store
}

/** Defecto único: la petición queda, pero la pestaña activa no cambia al Simulador. */
function queNoActivaElSimulador(): Store {
  const base = crearStoreFalso()
  let id = 0
  return { ...base, actions: { ...base.actions, simularNumero: (numero: string) => base.cambiar({ simulacion: { numero, id: (id += 1) } }) } } as Store
}

/** Defecto único: pedir el MISMO número otra vez reutiliza la petición (misma referencia y mismo `id`). */
function queIgnoraElNumeroRepetido(): Store {
  const base = crearStoreFalso()
  let id = 0
  return {
    ...base,
    actions: {
      ...base.actions,
      simularNumero: (numero: string) => {
        if (base.getSnapshot().simulacion?.numero === numero) return
        base.cambiar({ activeTab: 'simulador', simulacion: { numero, id: (id += 1) } })
      },
    },
  } as Store
}

/** Defecto único: el número repetido es una petición nueva (otra referencia) pero conserva el mismo `id`. */
function queRepiteElIdDeLaPeticion(): Store {
  const base = crearStoreFalso()
  return {
    ...base,
    actions: { ...base.actions, simularNumero: (numero: string) => base.cambiar({ activeTab: 'simulador', simulacion: { numero, id: 1 } }) },
  } as Store
}

/** Defecto único: avisa a los suscriptores ANTES de actualizar el estado: la escucha leería la petición vieja. */
function queAvisaAntesDeLaSimulacion(): Store {
  const base = crearStoreFalso()
  const escuchas = new Set<() => void>()
  return {
    ...base,
    subscribe: (escucha: () => void) => {
      escuchas.add(escucha)
      return () => escuchas.delete(escucha)
    },
    actions: {
      ...base.actions,
      simularNumero: (numero: string) => {
        escuchas.forEach((e) => e()) // aviso con el estado todavía viejo
        base.actions.simularNumero(numero)
      },
    },
  } as Store
}

/** Defecto único: el almacén no tiene el campo `errorSorteos`. */
function sinErrorSorteos(): Store {
  const base = crearStoreFalso()
  const derivadas = new WeakMap<Snapshot, Snapshot>()
  return {
    ...base,
    getSnapshot() {
      const real = base.getSnapshot()
      let derivada = derivadas.get(real)
      if (!derivada) {
        const { errorSorteos: _omitido, ...resto } = real
        derivada = resto as Snapshot
        derivadas.set(real, derivada)
      }
      return derivada
    },
  } as Store
}

/** Defecto único: `errorSorteos` está en true aunque no haya fallado nada. */
function conErrorSorteosSinFallo(): Store {
  return crearStoreFalso({ errorSorteos: true })
}

/** Defecto único: una recarga correcta deja `errorSorteos` en true. */
function queMarcaErrorTrasRecargar(): Store {
  const base = crearStoreFalso()
  return {
    ...base,
    actions: {
      ...base.actions,
      reload: async () => {
        await base.actions.reload()
        base.cambiar({ errorSorteos: true })
      },
    },
  } as Store
}

function queCambiaOtrosCamposSinMotivo(): Store {
  const base = crearStoreFalso()
  return {
    ...base,
    actions: {
      ...base.actions,
      setUseML: (v: boolean) => {
        base.actions.setUseML(v)
        base.cambiar({ sorteos: [...base.getSnapshot().sorteos], theme: 'light' })
      },
    },
  } as Store
}

/** Defecto único: la recarga rechaza cuando falla la carga, en vez de tragarse el fallo. */
function conReloadQueRechaza(): Store {
  const base = crearStoreFalso()
  let falla = false
  return {
    ...base,
    fallarSiguienteRecarga: () => {
      falla = true
    },
    actions: {
      ...base.actions,
      reload: async () => {
        if (falla) {
          falla = false
          throw new Error('fallo de red')
        }
      },
    },
  } as Store
}

/** Defecto único: durante la recarga se vacían `stats` y `ready` (no se conservan los datos viejos). */
function conReloadQuePierdeLosDatos(): Store {
  const base = crearStoreFalso()
  return {
    ...base,
    actions: {
      ...base.actions,
      reload: async () => {
        const viejo = base.getSnapshot()
        base.cambiar({ stats: null, ready: false })
        await Promise.resolve()
        base.cambiar({ stats: viejo.stats, ready: viejo.ready })
      },
    },
  } as Store
}

/** Defecto único: durante la recarga se vacía solo `stats` (`ready` y `sorteos` se conservan). */
function conReloadQueVaciaSoloStats(): Store {
  const base = crearStoreFalso()
  return {
    ...base,
    actions: {
      ...base.actions,
      reload: async () => {
        const viejo = base.getSnapshot().stats
        base.cambiar({ stats: null })
        await Promise.resolve()
        base.cambiar({ stats: viejo })
      },
    },
  } as Store
}

/** Defecto único: la recarga correcta conserva los datos, pero una recarga FALLIDA los pierde. */
function conReloadFallidoQuePierdeLosDatos(): Store {
  const base = crearStoreFalso()
  let falla = false
  return {
    ...base,
    fallarSiguienteRecarga: () => {
      falla = true
    },
    actions: {
      ...base.actions,
      reload: async () => {
        if (falla) {
          falla = false
          base.cambiar({ stats: null, ready: false })
        }
      },
    },
  } as Store
}

/** Defecto único: tras un `await` interno, `stats` se vacía un momento y luego se restaura (parpadeo de esqueleto). */
function conReloadQueVaciaStatsTrasUnAwait(): Store {
  const base = crearStoreFalso()
  return {
    ...base,
    actions: {
      ...base.actions,
      reload: async () => {
        const viejo = base.getSnapshot().stats
        await Promise.resolve()
        base.cambiar({ stats: null })
        await Promise.resolve()
        base.cambiar({ stats: viejo })
      },
    },
  } as Store
}

/** Defecto único: `stats` se vacía un momento pasado un `setTimeout` (mucho después de las microtareas inmediatas). */
function conReloadQueVaciaStatsTrasUnTimeout(): Store {
  const base = crearStoreFalso()
  const esperar = () => new Promise<void>((r) => setTimeout(r, 5))
  return {
    ...base,
    actions: {
      ...base.actions,
      reload: async () => {
        const viejo = base.getSnapshot().stats
        await esperar()
        base.cambiar({ stats: null })
        await esperar()
        base.cambiar({ stats: viejo })
      },
    },
  } as Store
}

/** Defecto único: una recarga fallida deja los sorteos vacíos (pero conserva `stats` y `ready`). */
function conReloadFallidoQueVaciaLosSorteos(): Store {
  const base = crearStoreFalso()
  let falla = false
  return {
    ...base,
    fallarSiguienteRecarga: () => {
      falla = true
    },
    actions: {
      ...base.actions,
      reload: async () => {
        if (falla) {
          falla = false
          base.cambiar({ sorteos: [] })
        }
      },
    },
  } as Store
}

/** Defecto único: una recarga fallida sustituye `stats` por una copia igual (los datos están, la referencia cambió). */
function conReloadFallidoQueReemplazaStatsPorUnaCopia(): Store {
  const base = crearStoreFalso()
  let falla = false
  return {
    ...base,
    fallarSiguienteRecarga: () => {
      falla = true
    },
    actions: {
      ...base.actions,
      reload: async () => {
        if (falla) {
          falla = false
          base.cambiar({ stats: { ...base.getSnapshot().stats } as Snapshot['stats'] })
        }
      },
    },
  } as Store
}

/** Defecto único: una recarga fallida cambia un campo que no tiene nada que ver (el modo de predicción). */
function conReloadFallidoQueCambiaUnCampoAjeno(): Store {
  const base = crearStoreFalso()
  let falla = false
  return {
    ...base,
    fallarSiguienteRecarga: () => {
      falla = true
    },
    actions: {
      ...base.actions,
      reload: async () => {
        if (falla) {
          falla = false
          base.cambiar({ useML: !base.getSnapshot().useML })
        }
      },
    },
  } as Store
}

const rechaza = async (comprobar: () => Promise<void> | void, mensaje: RegExp) => {
  await expect(Promise.resolve().then(comprobar)).rejects.toThrow(mensaje)
}

describirContratoDeStore('almacén escrito a mano (StoreManual)', () => new StoreManual(), controlManual)

describe('el almacén manual se traga de verdad el fallo de la recarga', () => {
  it('cuenta el fallo tragado y conserva los datos', async () => {
    const store = new StoreManual()
    store.cargar()
    store.fallarSiguienteRecarga()
    await store.actions.reload()
    expect(store.fallosTragados).toBe(1)
    expect(store.getSnapshot().stats).toBe(STATS)
  })
})

describe('la suite de contrato acepta un almacén correcto escrito como clase con flechas', () => {
  for (const [nombre, comprobar] of Object.entries(comprobaciones)) {
    it(`pasa «${nombre}»`, async () => {
      await comprobar(() => new StoreClaseConFlechas(), controlDeClase)
    })
  }
})

describe('la suite de contrato detecta cada defecto por su causa', () => {
  it('subscribe que depende de this: lo dice por su nombre', async () => {
    await rechaza(() => comprobaciones.sinDependerDeThis!(conSubscribeConThis, controlDeClase), /subscribe.*suelt/i)
  })

  it('una acción que depende de this: lo dice por su nombre', async () => {
    await rechaza(() => comprobaciones.sinDependerDeThis!(conAccionConThis, controlDeClase), /setUseML.*suelt/i)
  })

  it('una instantánea que cambia de referencia en cada lectura', async () => {
    await rechaza(() => comprobaciones.referenciaEstable!(conSnapshotNuevoEnCadaLectura, control), /misma referencia|cambia de referencia/i)
  })

  it('un campo (sorteos) inestable aunque la instantánea sea estable', async () => {
    await rechaza(() => comprobaciones.referenciaEstable!(conCampoInestableDesdeElPrincipio, control), /sorteos/)
  })

  it('un campo (stats) que solo es inestable cuando ya hay datos cargados', async () => {
    await rechaza(() => comprobaciones.referenciaEstable!(conStatsInestableTrasCargar, control), /stats.*cargad|cargad.*stats/i)
  })

  it('un almacén que cambia otros campos cuando cambia solo uno', async () => {
    await rechaza(() => comprobaciones.camposIndependientes!(queCambiaOtrosCamposSinMotivo, control), /tocó la referencia/)
  })

  it('una suscripción que no se puede cancelar', async () => {
    await rechaza(() => comprobaciones.suscripcion!(sinCancelarSuscripcion, control), /siguió avisando/)
  })

  it('un almacén que no avisa tras un cambio', async () => {
    await rechaza(() => comprobaciones.suscripcion!(sinAvisarTrasUnCambio, control), /no avisó/)
  })

  it('simularNumero que no deja la petición en `simulacion`', async () => {
    await rechaza(() => comprobaciones.simulacion!(queNoFijaLaSimulacion, control), /no dejó el número en «simulacion»/)
  })

  it('simularNumero que no deja el Simulador como pestaña activa', async () => {
    await rechaza(() => comprobaciones.simulacion!(queNoActivaElSimulador, control), /pestaña activa/)
  })

  it('simularNumero que ignora un número repetido: no es otra petición', async () => {
    await rechaza(() => comprobaciones.simulacion!(queIgnoraElNumeroRepetido, control), /conserva la referencia/)
  })

  it('simularNumero que repite el `id` de la petición aunque cambie la referencia', async () => {
    await rechaza(() => comprobaciones.simulacion!(queRepiteElIdDeLaPeticion, control), /no cambió el «id»/)
  })

  it('simularNumero que avisa antes de actualizar `simulacion`', async () => {
    await rechaza(() => comprobaciones.simulacion!(queAvisaAntesDeLaSimulacion, control), /avisó antes de actualizar/)
  })

  it('un almacén sin el campo `errorSorteos`', async () => {
    await rechaza(() => comprobaciones.errorDeCargaDeSorteos!(sinErrorSorteos, control), /debe ser un booleano/)
  })

  it('un almacén con `errorSorteos` en true sin que haya fallado nada', async () => {
    await rechaza(() => comprobaciones.errorDeCargaDeSorteos!(conErrorSorteosSinFallo, control), /debe ser false/)
  })

  it('una recarga correcta que deja `errorSorteos` en true', async () => {
    await rechaza(() => comprobaciones.errorDeCargaDeSorteos!(queMarcaErrorTrasRecargar, control), /tras una recarga correcta/)
  })

  it('acciones que cambian de identidad entre lecturas', async () => {
    await rechaza(() => comprobaciones.identidadDeAcciones!(conAccionesNuevasEnCadaLectura, control), /cambia de identidad/)
  })

  it('acciones que solo cambian de identidad después de un cambio de estado', async () => {
    await rechaza(() => comprobaciones.identidadDeAcciones!(conAccionesQueCambianTrasUnCambio, control), /tras (un cambio|cambiar)/i)
  })

  it('acciones que solo cambian de identidad después de una recarga', async () => {
    await rechaza(() => comprobaciones.identidadDeAcciones!(conAccionesQueCambianTrasUnReload, control), /cambia de identidad tras un cambio de estado/)
  })

  it('subscribe que cambia de identidad después de un cambio de estado', async () => {
    await rechaza(() => comprobaciones.identidadDeAcciones!(conSubscribeInestableTrasUnCambio, control), /subscribe.*tras un cambio/i)
  })

  it('una recarga que vacía solo `stats` mientras dura', async () => {
    await rechaza(() => comprobaciones.recarga!(conReloadQueVaciaSoloStats, control), /durante la recarga se vació `stats`/)
  })

  it('una recarga fallida que pierde los datos', async () => {
    await rechaza(() => comprobaciones.recarga!(conReloadFallidoQuePierdeLosDatos, control), /recarga fallida se vació `stats`/)
  })

  it('un setter que actualiza el estado pero no avisa: nombra la acción', async () => {
    await rechaza(() => comprobaciones.suscripcion!(() => new StoreManual({ sinAvisarEn: ['setPrize'] }), controlManual), /setPrize.*no avisó/)
    await rechaza(() => comprobaciones.suscripcion!(() => new StoreManual({ sinAvisarEn: ['setStatsPrize'] }), controlManual), /setStatsPrize.*no avisó/)
  })

  it('un almacén que avisa antes de actualizar el estado: la escucha leería el valor viejo', async () => {
    await rechaza(() => comprobaciones.suscripcion!(() => new StoreManual({ avisarAntes: true }), controlManual), /avisó antes de actualizar/)
  })

  it('una recarga que vacía `stats` un momento tras un await interno (parpadeo)', async () => {
    await rechaza(() => comprobaciones.recarga!(conReloadQueVaciaStatsTrasUnAwait, control), /durante la recarga se vació `stats`/)
  })

  it('una recarga que vacía `stats` pasado un setTimeout: solo lo ve la escucha de avisos', async () => {
    await rechaza(() => comprobaciones.recarga!(conReloadQueVaciaStatsTrasUnTimeout, control), /durante la recarga se vació `stats`/)
  })

  it('una recarga que vacía `stats` sin avisar a nadie: solo lo ven las lecturas a intervalos', async () => {
    await rechaza(() => comprobaciones.recarga!(() => new StoreManual({ vaciaStatsSinAvisarEnReload: true }), controlManual), /durante la recarga se vació `stats`/)
  })

  it('una recarga fallida que vacía los sorteos', async () => {
    await rechaza(() => comprobaciones.recarga!(conReloadFallidoQueVaciaLosSorteos, control), /recarga fallida se vaciaron los sorteos/)
  })

  it('una recarga fallida que sustituye `stats` por una copia igual: la referencia debe conservarse', async () => {
    await rechaza(() => comprobaciones.recarga!(conReloadFallidoQueReemplazaStatsPorUnaCopia, control), /recarga fallida cambió «stats»/)
  })

  it('una recarga fallida que cambia un campo ajeno', async () => {
    await rechaza(() => comprobaciones.recarga!(conReloadFallidoQueCambiaUnCampoAjeno, control), /recarga fallida cambió «useML»/)
  })

  it('una recarga que rechaza cuando falla la carga', async () => {
    await rechaza(() => comprobaciones.recarga!(conReloadQueRechaza, control), /reload rechaz|no debe rechazar/i)
  })

  it('una recarga que vacía los datos mientras dura', async () => {
    await rechaza(() => comprobaciones.recarga!(conReloadQuePierdeLosDatos, control), /durante la recarga/i)
  })
})
