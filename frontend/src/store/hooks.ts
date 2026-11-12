// Hooks de lectura y de acción sobre el Store (spec frontend-react, T014; plan §3).
// Cada hook se suscribe solo a su campo: un componente no se repinta porque cambie otro.
import { useSyncExternalStore } from 'react'
import type { Premio, Sorteo, Stats } from '../api/types'
import { useStore } from './StoreProvider'
import type { Snapshot, TabId, Tema } from './tipos'

/** Suscribe el componente a UN campo del estado. `getSnapshot` devuelve referencias estables, por eso no se repinta de más. */
function useCampo<K extends keyof Snapshot>(campo: K): Snapshot[K] {
  const store = useStore()
  return useSyncExternalStore(
    store.subscribe,
    () => store.getSnapshot()[campo],
    () => store.getSnapshot()[campo],
  )
}

export function useSorteos(): Sorteo[] {
  return useCampo('sorteos')
}

/** `null` mientras no llegó `/api/stats`: la isla debe mostrar su esqueleto. */
export function useStats(): Stats | null {
  return useCampo('stats')
}

/** `true` cuando ya llegó la lista de sorteos. */
export function useReady(): boolean {
  return useCampo('ready')
}

/** Modo de predicción (`true` = aprendizaje automático) y su cambio. */
export function useML(): [boolean, (valor: boolean) => void] {
  const store = useStore()
  return [useCampo('useML'), store.actions.setUseML]
}

/** Premio elegido en Predicciones y su cambio. */
export function usePrize(): [Premio, (premio: Premio) => void] {
  const store = useStore()
  return [useCampo('prize'), store.actions.setPrize]
}

/** Premio elegido en Estadísticas y su cambio. */
export function useStatsPrize(): [Premio, (premio: Premio) => void] {
  const store = useStore()
  return [useCampo('statsPrize'), store.actions.setStatsPrize]
}

export function useTheme(): Tema {
  return useCampo('theme')
}

export function useActiveTab(): TabId {
  return useCampo('activeTab')
}

/** Aviso emergente de la página. */
export function useToast(): (mensaje: string, ms?: number) => void {
  return useStore().actions.toast
}

/** Abre el Simulador con un número y lanza la simulación. */
export function useSimularNumero(): (numero: string) => void {
  return useStore().actions.simularNumero
}

/** Vuelve a cargar sorteos y estadísticas. */
export function useReload(): () => Promise<void> {
  return useStore().actions.reload
}
