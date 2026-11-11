// Doble de pruebas del Store (spec frontend-react, T014). Lo usan las pruebas de componentes y de hooks:
// guarda el estado, avisa a los suscriptores como haría el puente real y registra las llamadas a las acciones.
import type { Snapshot, Store } from './tipos'

export interface StoreFalso extends Store {
  /** Sustituye campos del estado y avisa a los suscriptores (como haría el puente real). */
  cambiar(parcial: Partial<Snapshot>): void
  /** Llamadas recibidas por las acciones, en orden. */
  llamadas: Array<{ accion: string; args: unknown[] }>
}

const ESTADO_INICIAL: Snapshot = {
  sorteos: [],
  stats: null,
  useML: false,
  prize: 'primero',
  statsPrize: 'primero',
  theme: 'dark',
  activeTab: 'predicciones',
  ready: false,
}

export function crearStoreFalso(inicial: Partial<Snapshot> = {}): StoreFalso {
  let snapshot: Snapshot = { ...ESTADO_INICIAL, ...inicial }
  const escuchas = new Set<() => void>()
  const llamadas: StoreFalso['llamadas'] = []

  const cambiar = (parcial: Partial<Snapshot>) => {
    snapshot = { ...snapshot, ...parcial } // referencia nueva: `useSyncExternalStore` solo repinta si cambia
    escuchas.forEach((escucha) => escucha())
  }
  const registrar = (accion: string, ...args: unknown[]) => llamadas.push({ accion, args })

  return {
    getSnapshot: () => snapshot,
    subscribe(escucha) {
      escuchas.add(escucha)
      return () => {
        escuchas.delete(escucha)
      }
    },
    actions: {
      setUseML(valor) {
        registrar('setUseML', valor)
        cambiar({ useML: valor })
      },
      setPrize(premio) {
        registrar('setPrize', premio)
        cambiar({ prize: premio })
      },
      setStatsPrize(premio) {
        registrar('setStatsPrize', premio)
        cambiar({ statsPrize: premio })
      },
      toast(mensaje, ms) {
        registrar('toast', mensaje, ms)
      },
      async reload() {
        registrar('reload')
      },
    },
    cambiar,
    llamadas,
  }
}
