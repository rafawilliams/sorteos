/**
 * `LegacyStore` (spec frontend-react, T015): el `Store` de las islas React mientras `static/app.js` siga siendo la
 * fuente de verdad. No guarda estado propio: lee y escribe a través del puente `window.LP` que `app.js` expone al
 * principio del archivo (instantánea con referencias estables por campo, `subscribe` y los setters).
 * Al final de la migración, `ReactStore` (T052) lo sustituye sin que las pestañas cambien.
 */
import type { Premio } from '../api/types'
import type { Snapshot, Store, TabId, Tema } from './tipos'

/** Lo que `static/app.js` publica en `window.LP`. */
export interface PuenteLP {
  getSnapshot(): Snapshot
  subscribe(escucha: () => void): () => void
  setUseML(valor: boolean): void
  setPrize(premio: Premio): void
  setStatsPrize(premio: Premio): void
  setTheme(tema: Tema): void
  setActiveTab(pestaña: TabId): void
  toast(mensaje: string, ms?: number): void
  simular(numero: string): void
  reload(): Promise<void>
}

declare global {
  interface Window {
    LP?: PuenteLP
  }
}

export function crearLegacyStore(puente: PuenteLP | undefined = window.LP): Store {
  if (!puente) {
    throw new Error('Falta el puente `window.LP`: `static/app.js` debe cargarse antes que las islas React.')
  }
  return {
    getSnapshot: () => puente.getSnapshot(),
    subscribe: (escucha) => puente.subscribe(escucha),
    actions: {
      setUseML: (valor) => puente.setUseML(valor),
      setPrize: (premio) => puente.setPrize(premio),
      setStatsPrize: (premio) => puente.setStatsPrize(premio),
      setTheme: (tema) => puente.setTheme(tema),
      setActiveTab: (pestaña) => puente.setActiveTab(pestaña),
      toast: (mensaje, ms) => puente.toast(mensaje, ms),
      simularNumero: (numero) => puente.simular(numero),
      reload: () => puente.reload(),
    },
  }
}
