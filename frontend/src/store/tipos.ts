/**
 * Contrato del estado compartido de la interfaz (spec frontend-react, T014; plan §3).
 *
 * Mientras convivan `static/app.js` y las islas React, `app.js` es la fuente de verdad y la implementación
 * `LegacyStore` (T015) lee su estado por un puente. Al final de la migración, `ReactStore` (T052) toma el
 * relevo. Las pestañas solo conocen esta interfaz y no cambian entre una y otra.
 */
import type { Premio, Sorteo, Stats } from '../api/types'

/** Las 14 pestañas de la barra principal, con el `data-tab` que llevan en la plantilla. */
export const TABS = [
  'predicciones',
  'decenas',
  'terminaciones',
  'resultados',
  'estadisticas',
  'tendencias',
  'analisis',
  'comparador',
  'gaps',
  'simulador',
  'favoritos',
  'mensual',
  'precision',
  'seguimiento',
] as const

export type TabId = (typeof TABS)[number]
export type Tema = 'light' | 'dark'

export interface Snapshot {
  /** Todos los sorteos (`/api/sorteos?all=true`). Vacío hasta que llegan. */
  sorteos: Sorteo[]
  /** `null` mientras no llegó `/api/stats` (puede tardar minutos la primera vez): toda isla muestra su esqueleto. */
  stats: Stats | null
  /** Modo de predicción: `true` = aprendizaje automático, `false` = estadístico. */
  useML: boolean
  /** Premio elegido en Predicciones. */
  prize: Premio
  /** Premio elegido en Estadísticas. */
  statsPrize: Premio
  theme: Tema
  activeTab: TabId
  /** `true` cuando ya llegó la lista de sorteos. */
  ready: boolean
}

export interface AccionesStore {
  setUseML(valor: boolean): void
  setPrize(premio: Premio): void
  setStatsPrize(premio: Premio): void
  /** Aviso emergente de la página (`#toast`). */
  toast(mensaje: string, ms?: number): void
  /** Vuelve a cargar sorteos y estadísticas (tras actualizar los datos). */
  reload(): Promise<void>
}

export interface Store {
  /** Debe devolver la MISMA referencia mientras el estado no cambie (lo exige `useSyncExternalStore`). */
  getSnapshot(): Snapshot
  /** Avisa tras cada cambio; devuelve la función que cancela la suscripción. */
  subscribe(escucha: () => void): () => void
  actions: AccionesStore
}
