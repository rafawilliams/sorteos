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
  /**
   * `null` mientras no llegó `/api/stats` (puede tardar minutos la primera vez): toda isla muestra su esqueleto.
   * Si la carga falla tras sus reintentos se queda en `null`, como hoy; un estado de error explícito (campo
   * nuevo, sin romper esta interfaz) se decide en T052, junto con el armazón en React.
   */
  stats: Stats | null
  /** Modo de predicción: `true` = aprendizaje automático, `false` = estadístico. */
  useML: boolean
  /** Premio elegido en Predicciones. */
  prize: Premio
  /** Premio elegido en Estadísticas. */
  statsPrize: Premio
  theme: Tema
  activeTab: TabId
  /** `true` cuando ya llegó la lista de sorteos (primera fase de la carga). No depende de `stats`. Si esa fase falla, sigue en `false`. */
  ready: boolean
}

export interface AccionesStore {
  setUseML(valor: boolean): void
  setPrize(premio: Premio): void
  setStatsPrize(premio: Premio): void
  /** Aviso emergente de la página (`#toast`). */
  toast(mensaje: string, ms?: number): void
  /**
   * Vuelve a cargar sorteos y estadísticas (tras actualizar los datos). Mientras dura se conservan los datos viejos
   * (`stats` y `ready` no vuelven a `null` ni a `false`) hasta que llegan los nuevos. La promesa se resuelve cuando la
   * carga termina, con éxito o sin él, y nunca rechaza: un fallo se registra y los datos viejos se quedan, como en
   * `static/app.js`.
   */
  reload(): Promise<void>
}

/**
 * Invariantes que toda implementación debe cumplir; los comprueba `describirContratoDeStore` (`contratoStore.ts`):
 *  - `getSnapshot` devuelve la MISMA referencia mientras el estado no cambie, y lo mismo cada campo (`sorteos`,
 *    `stats`…): los hooks leen campos sueltos con `useSyncExternalStore`, y una referencia nueva en cada lectura
 *    provoca un bucle de repintados. Al cambiar un campo, los demás conservan su referencia.
 *  - `subscribe` y todas las `actions` funcionan SUELTAS, sin depender de `this`, y conservan su identidad
 *    (los hooks las pasan por separado y las usan en dependencias). `getSnapshot` sí se llama como método.
 */
export interface Store {
  getSnapshot(): Snapshot
  /** Avisa tras cada cambio; devuelve la función que cancela la suscripción. */
  subscribe(escucha: () => void): () => void
  actions: AccionesStore
}
