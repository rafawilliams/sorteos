import { describe, expect, it } from 'vitest'
import { comprobaciones, describirContratoDeStore } from './contratoStore'
import { crearStoreFalso } from './storeFalso'
import type { Snapshot, Store } from './tipos'

// La suite de contrato es lo que toda implementación de `Store` (el doble, `LegacyStore`, `ReactStore`) tiene que pasar.
describirContratoDeStore('doble de pruebas (crearStoreFalso)', () => crearStoreFalso())

// ---------------------------------------------------------------------------
// Almacenes correctos y rotos a propósito: demuestran que la suite DETECTA cada defecto (no pasa en vacío).
// ---------------------------------------------------------------------------

/** Almacén correcto escrito como clase: usa `this`, pero con flechas, así que sus piezas funcionan sueltas. */
class StoreClaseConFlechas implements Store {
  private snapshot: Snapshot = crearStoreFalso().getSnapshot()
  private escuchas = new Set<() => void>()
  getSnapshot() {
    return this.snapshot // se llama siempre como método del almacén: no hace falta que sea una flecha
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
  actions = {
    setUseML: (v: boolean) => this.poner({ useML: v }),
    setPrize: (p: Snapshot['prize']) => this.poner({ prize: p }),
    setStatsPrize: (p: Snapshot['statsPrize']) => this.poner({ statsPrize: p }),
    toast: () => {},
    reload: async () => {},
  }
}

/** Defecto: `subscribe` y una acción son métodos normales que usan `this`, y lo pierden al usarse sueltos. */
class StoreClaseConMetodos implements Store {
  private snapshot: Snapshot = crearStoreFalso().getSnapshot()
  private escuchas = new Set<() => void>()
  getSnapshot() {
    return this.snapshot
  }
  subscribe(escucha: () => void) {
    this.escuchas.add(escucha)
    return () => {
      this.escuchas.delete(escucha)
    }
  }
  actions = {
    setUseML: (v: boolean) => {
      this.snapshot = { ...this.snapshot, useML: v }
      this.escuchas.forEach((e) => e())
    },
    setPrize: () => {},
    setStatsPrize: () => {},
    toast: () => {},
    reload: async () => {},
  }
}

/** Defecto: la instantánea es estable pero el campo `sorteos` devuelve un array nuevo en cada lectura. */
function conCampoInestable(): Store {
  const base = crearStoreFalso()
  const instantanea = { ...base.getSnapshot() }
  Object.defineProperty(instantanea, 'sorteos', { enumerable: true, get: () => [] as Snapshot['sorteos'] })
  return { ...base, getSnapshot: () => instantanea }
}

function conSnapshotNuevoEnCadaLectura(): Store {
  const base = crearStoreFalso()
  return { ...base, getSnapshot: () => ({ ...base.getSnapshot() }) }
}

function conAccionesNuevasEnCadaLectura(): Store {
  const base = crearStoreFalso()
  return {
    getSnapshot: base.getSnapshot,
    subscribe: base.subscribe,
    get actions() {
      return { ...base.actions, setUseML: (v: boolean) => base.actions.setUseML(v) }
    },
  }
}

function sinCancelarSuscripcion(): Store {
  const base = crearStoreFalso()
  return {
    ...base,
    subscribe: (escucha) => {
      base.subscribe(escucha)
      return () => {}
    },
  }
}

function queCambiaOtrosCamposSinMotivo(): Store {
  const base = crearStoreFalso()
  return {
    ...base,
    actions: {
      ...base.actions,
      setUseML: (v) => {
        base.actions.setUseML(v)
        base.cambiar({ sorteos: [...base.getSnapshot().sorteos], theme: 'light' })
      },
    },
  }
}

function sinAvisarTrasUnCambio(): Store {
  const base = crearStoreFalso()
  return { ...base, subscribe: () => () => {} }
}

describe('la suite de contrato detecta los almacenes defectuosos', () => {
  it('acepta un almacén correcto escrito como clase con flechas', () => {
    for (const comprobar of Object.values(comprobaciones)) expect(() => comprobar(() => new StoreClaseConFlechas())).not.toThrow()
  })

  it('rechaza un almacén cuyos métodos pierden `this` al usarse sueltos', () => {
    expect(() => comprobaciones.sinDependerDeThis!(() => new StoreClaseConMetodos())).toThrow()
  })

  it('rechaza una instantánea que cambia de referencia en cada lectura', () => {
    expect(() => comprobaciones.referenciaEstable!(conSnapshotNuevoEnCadaLectura)).toThrow()
  })

  it('rechaza un campo (sorteos) que cambia de referencia en cada lectura aunque la instantánea sea estable', () => {
    expect(() => comprobaciones.referenciaEstable!(conCampoInestable)).toThrow()
  })

  it('rechaza un almacén que cambia otros campos cuando cambia solo uno', () => {
    expect(() => comprobaciones.camposIndependientes!(queCambiaOtrosCamposSinMotivo)).toThrow()
  })

  it('rechaza una suscripción que no se puede cancelar', () => {
    expect(() => comprobaciones.suscripcion!(sinCancelarSuscripcion)).toThrow()
  })

  it('rechaza un almacén que no avisa tras un cambio', () => {
    expect(() => comprobaciones.suscripcion!(sinAvisarTrasUnCambio)).toThrow()
  })

  it('rechaza acciones que cambian de identidad entre lecturas', () => {
    expect(() => comprobaciones.identidadDeAcciones!(conAccionesNuevasEnCadaLectura)).toThrow()
  })
})
