// Doble de pruebas del Store (spec frontend-react, T014). Lo usan las pruebas de componentes y de hooks:
// guarda el estado, avisa a los suscriptores como haría el puente real y registra las llamadas a las acciones.
import type { Snapshot, Store } from './tipos'

export interface StoreFalso extends Store {
  /**
   * Sustituye campos del estado y avisa a los suscriptores, SIEMPRE, aunque el valor no cambie: es más permisivo
   * que un almacén real, que podría no avisar. Las pruebas que dependan de eso no deben apoyarse en este doble.
   */
  cambiar(parcial: Partial<Snapshot>): void
  /** Hace que la siguiente recarga "falle": como un almacén real, se traga el fallo y conserva los datos viejos. */
  fallarSiguienteRecarga(): void
  /** Llamadas recibidas por las acciones, en orden. */
  llamadas: Array<{ accion: string; args: unknown[] }>
}

/** Estado de partida; función y no constante para que cada instancia tenga su propio array de sorteos. */
const estadoInicial = (): Snapshot => ({
  sorteos: [],
  stats: null,
  useML: false,
  prize: 'primero',
  statsPrize: 'primero',
  theme: 'dark',
  activeTab: 'predicciones',
  ready: false,
  simulacion: null,
})

export function crearStoreFalso(inicial: Partial<Snapshot> = {}): StoreFalso {
  let snapshot: Snapshot = { ...estadoInicial(), ...inicial }
  const escuchas = new Set<() => void>()
  const llamadas: StoreFalso['llamadas'] = []

  const cambiar = (parcial: Partial<Snapshot>) => {
    snapshot = { ...snapshot, ...parcial } // referencia nueva: `useSyncExternalStore` solo repinta si cambia
    escuchas.forEach((escucha) => escucha())
  }
  const registrar = (accion: string, ...args: unknown[]) => llamadas.push({ accion, args })
  let fallaLaRecarga = false
  let peticiones = 0 // contador de `simulacion.id`

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
      simularNumero(numero) {
        registrar('simularNumero', numero)
        peticiones += 1
        cambiar({ activeTab: 'simulador', simulacion: { numero, id: peticiones } })
      },
      async reload() {
        registrar('reload')
        if (fallaLaRecarga) {
          fallaLaRecarga = false
          registrar('reload:fallo-tragado') // el fallo se registra y se traga: los datos viejos se quedan
        }
      },
    },
    cambiar,
    fallarSiguienteRecarga: () => {
      fallaLaRecarga = true
    },
    llamadas,
  }
}
