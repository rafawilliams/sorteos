/**
 * Contrato del estado compartido de la interfaz (spec frontend-react, T014; plan §3).
 *
 * `ReactStore` (T052) guarda el estado y hace la carga de datos. Durante la migración, `LegacyStore` (T015) leía el estado
 * de `static/app.js` por un puente; se retiró con él (T055). Las pestañas solo conocen esta interfaz.
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
   *
   * Un cuerpo de error en JSON o sin `total_sorteos` numérico nunca ocupa su lugar (el `app.js` antiguo lo asignaba
   * sin mirar la respuesta HTTP).
   *
   * Si la carga falla tras sus reintentos, `stats` conserva lo que tuviera (`null` la primera vez) y se registra en la
   * consola; no hay un campo de error para las estadísticas (sí lo hay para los sorteos: `errorSorteos`).
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
  /**
   * Última petición «simula este número» (botón «Simular» de Mis Números), o `null` si nadie ha pedido ninguna.
   * La isla Simulador lanza una simulación por cada `id` nuevo, así que pedir el mismo número otra vez es otra petición.
   */
  simulacion: PeticionSimulacion | null
  /**
   * `true` cuando la carga de sorteos ha fallado y NO hay ninguno (red caída, un 500, un cuerpo que no es una lista): en
   * ese caso `ready` se queda en `false` y una isla que dependa de los sorteos no puede distinguir «todavía cargando» de
   * «no va a llegar». Un fallo al RECARGAR con datos ya cargados no lo marca (se conservan los viejos, ver `reload`), y
   * volver a pedir los sorteos lo devuelve a `false` mientras dura el intento. Vale `false` si no ha fallado nada.
   */
  errorSorteos: boolean
}

/** Una petición de simulación: el número (ya normalizado a 4 cifras) y un contador que crece con cada petición. */
export interface PeticionSimulacion {
  numero: string
  id: number
}

export interface AccionesStore {
  setUseML(valor: boolean): void
  setPrize(premio: Premio): void
  setStatsPrize(premio: Premio): void
  /** Cambia el tema (claro u oscuro), lo aplica al documento y lo recuerda en el navegador. Un valor desconocido se ignora. */
  setTheme(tema: Tema): void
  /** Activa una pestaña de la barra principal. Una desconocida se ignora. */
  setActiveTab(pestaña: TabId): void
  /** Aviso emergente de la página (`#toast`). */
  toast(mensaje: string, ms?: number): void
  /**
   * Abre el Simulador con ese número (ya normalizado a 4 cifras) y lanza la simulación: el botón «Simular» de Mis
   * Números. Deja `activeTab` en `'simulador'` y una petición nueva en `simulacion` (con otro `id` aunque el número se
   * repita): la isla Simulador la ve y simula.
   */
  simularNumero(numero: string): void
  /**
   * Vuelve a cargar sorteos y estadísticas (tras actualizar los datos). Mientras dura se conservan los datos viejos
   * (`stats` y `ready` no vuelven a `null` ni a `false`) hasta que llegan los nuevos. La promesa se resuelve cuando la
   * carga termina, con éxito o sin él, y nunca rechaza: un fallo se registra y los datos viejos se quedan. Un fallo
   * es una red caída o una respuesta de error (p. ej. un 500 con cuerpo JSON): ese cuerpo NO sustituye a `stats`.
   * Toda implementación debe ignorar un cuerpo sin `total_sorteos` numérico y conservar el estado anterior (el `app.js`
   * antiguo no comprobaba la respuesta HTTP y repintaba sus contenedores como esqueletos mientras recargaba; las islas
   * conservan los datos a la vista).
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
