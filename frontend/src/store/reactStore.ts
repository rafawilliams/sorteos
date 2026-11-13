/**
 * `ReactStore` (spec frontend-react, T052): el `Store` de la interfaz, con React como dueño del armazón. Guarda el estado y
 * replica `loadData()`, `toggleTheme()` y `activateNavTab()` del antiguo `static/app.js` (retirado en T055).
 *
 * Carga en dos fases, como el código antiguo: primero los sorteos (`/api/sorteos?all=true`, ligero) y luego las
 * estadísticas (`/api/stats`, puede tardar minutos la primera vez), con un límite de 180 000 ms por intento y 3 intentos sin
 * espera entre ellos. Nunca se muestra un dato a medias: `stats` solo toma un cuerpo con `total_sorteos` numérico y una
 * respuesta correcta, y un cuerpo de error no ocupa su lugar (más estricto que `app.js`, que no miraba el estado HTTP).
 *
 * Cumple los invariantes de `tipos.ts`: la instantánea y cada campo conservan su referencia mientras no cambien, y
 * `subscribe` y las acciones son funciones propias (no métodos) con identidad fija.
 */
import type { Premio, Sorteo, Stats } from '../api/types'
import { TABS, type Snapshot, type Store, type TabId, type Tema } from './tipos'

export interface ReactStore extends Store {
  /** Primera carga de datos (la que hacía `DOMContentLoaded` en `app.js`). Igual que `actions.reload`; nunca rechaza. */
  cargar(): Promise<void>
}

export const URL_SORTEOS = '/api/sorteos?all=true'
export const URL_STATS = '/api/stats'
export const LIMITE_STATS_MS = 180_000
export const INTENTOS_STATS = 3
export const CLAVE_TEMA = 'theme'
export const ID_AVISO = 'toast'
const DURACION_AVISO_MS = 2500

const PREMIOS: readonly Premio[] = ['primero', 'segundo', 'tercero']

/** Un cuerpo de `/api/stats` solo vale si trae `total_sorteos` numérico (un `{}` o un error en JSON no cuentan). */
function statsValidas(cuerpo: unknown): cuerpo is Stats {
  return typeof cuerpo === 'object' && cuerpo !== null && typeof (cuerpo as { total_sorteos?: unknown }).total_sorteos === 'number'
}

/** El tema guardado en el navegador; sin él (o sin acceso al almacenamiento) es el oscuro, que es el de partida. */
function temaGuardado(): Tema {
  try {
    return localStorage.getItem(CLAVE_TEMA) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

function aplicarTema(tema: Tema): void {
  document.documentElement.setAttribute('data-theme', tema)
  try {
    localStorage.setItem(CLAVE_TEMA, tema)
  } catch {
    // Sin almacenamiento (ventana privada, datos bloqueados): el tema cambia igual, solo que no se recuerda.
  }
}

export function crearReactStore(): ReactStore {
  const tema = temaGuardado()
  aplicarTema(tema)
  let snapshot: Snapshot = {
    sorteos: [],
    stats: null,
    useML: false,
    prize: 'primero',
    statsPrize: 'primero',
    theme: tema,
    activeTab: 'predicciones',
    ready: false,
    simulacion: null,
    errorSorteos: false,
  }
  const escuchas = new Set<() => void>()
  let peticionesSimulacion = 0
  let cargaEnCurso: Promise<void> | null = null
  let temporizadorAviso: ReturnType<typeof setTimeout> | undefined

  /** Referencia nueva de la instantánea y avisos; los campos que no se tocan conservan la suya. */
  const cambiar = (parcial: Partial<Snapshot>) => {
    snapshot = { ...snapshot, ...parcial }
    escuchas.forEach((escucha) => {
      try {
        escucha()
      } catch (error) {
        console.error(error) // una escucha rota no debe impedir que avisen las demás
      }
    })
  }

  const toast = (mensaje: string, ms: number = DURACION_AVISO_MS) => {
    const aviso = document.getElementById(ID_AVISO)
    if (!aviso) return
    aviso.textContent = mensaje
    aviso.classList.add('show')
    clearTimeout(temporizadorAviso) // un aviso nuevo no debe apagarse con el temporizador del anterior
    temporizadorAviso = setTimeout(() => aviso.classList.remove('show'), ms)
  }

  async function cargarSorteos(): Promise<void> {
    if (snapshot.errorSorteos) cambiar({ errorSorteos: false }) // nuevo intento: vuelve a «cargando»
    try {
      const res = await fetch(URL_SORTEOS)
      const cuerpo: unknown = await res.json()
      const lista = Array.isArray(cuerpo) ? cuerpo : (cuerpo as { data?: unknown } | null)?.data
      if (!res.ok || !Array.isArray(lista)) throw new Error('Respuesta inválida de /api/sorteos')
      cambiar({ sorteos: lista as Sorteo[], ready: lista.length > 0 })
    } catch (error) {
      console.error('Error loading sorteos:', error)
      // Sin ningún sorteo una isla no distingue «cargando» de «no va a llegar»; con datos viejos se conservan.
      if (snapshot.sorteos.length === 0) cambiar({ errorSorteos: true })
    }
  }

  async function cargarStats(): Promise<void> {
    for (let intento = 1; intento <= INTENTOS_STATS; intento += 1) {
      try {
        const res = await fetch(URL_STATS, { signal: AbortSignal.timeout(LIMITE_STATS_MS) })
        const cuerpo: unknown = await res.json()
        if (!res.ok || !statsValidas(cuerpo)) throw new Error('Respuesta inválida de /api/stats')
        cambiar({ stats: cuerpo })
        return
      } catch (error) {
        if (intento < INTENTOS_STATS) console.warn(`Stats attempt ${intento} failed, retrying...`)
        else console.error('Error loading stats:', error)
      }
    }
  }

  /** Una sola carga a la vez: pedir otra mientras corre una devuelve la misma promesa. */
  const cargar = (): Promise<void> => {
    cargaEnCurso ??= (async () => {
      try {
        await cargarSorteos()
        await cargarStats()
      } finally {
        cargaEnCurso = null
      }
    })()
    return cargaEnCurso
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(escucha) {
      escuchas.add(escucha)
      return () => {
        escuchas.delete(escucha)
      }
    },
    cargar,
    actions: {
      setUseML(valor) {
        if (valor === snapshot.useML) return
        cambiar({ useML: valor })
        const info = snapshot.stats?.ml_info
        if (valor && info?.trained) toast(`ML: ${info.train_samples} muestras · Entrenado: ${info.train_date}`, 3000)
      },
      setPrize(premio) {
        if (!PREMIOS.includes(premio) || premio === snapshot.prize) return
        cambiar({ prize: premio })
      },
      setStatsPrize(premio) {
        if (!PREMIOS.includes(premio) || premio === snapshot.statsPrize) return
        cambiar({ statsPrize: premio })
      },
      setTheme(nuevo) {
        if ((nuevo !== 'light' && nuevo !== 'dark') || nuevo === snapshot.theme) return
        aplicarTema(nuevo)
        cambiar({ theme: nuevo })
      },
      setActiveTab(pestaña) {
        if (!TABS.includes(pestaña as TabId) || pestaña === snapshot.activeTab) return
        cambiar({ activeTab: pestaña })
      },
      toast,
      simularNumero(numero) {
        peticionesSimulacion += 1
        cambiar({ activeTab: 'simulador', simulacion: { numero: String(numero), id: peticionesSimulacion } })
      },
      reload: () => cargar().catch((error) => console.error('Error reloading:', error)),
    },
  }
}
