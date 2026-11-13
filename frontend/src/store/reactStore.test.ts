import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Sorteo, Stats } from '../api/types'
import { describirContratoDeStore, type ControlDeCarga } from './contratoStore'
import { crearReactStore, CLAVE_TEMA, INTENTOS_STATS, LIMITE_STATS_MS, URL_SORTEOS, URL_STATS, type ReactStore } from './reactStore'

const STATS: Stats = JSON.parse(readFileSync('fixtures/stats.json', 'utf-8'))
const SORTEOS: Sorteo[] = JSON.parse(readFileSync('fixtures/sorteos.json', 'utf-8')).data

type Respuesta = 'ok' | 'red' | '500' | '500-con-datos' | 'vacio' | 'sin-total' | 'array' | 'cuerpo-raro'

/** Una red falsa: cada endpoint responde según su guion; se guardan las llamadas con su `init`. */
function crearRed() {
  const guion: { sorteos: Respuesta[]; stats: Respuesta[] } = { sorteos: [], stats: [] }
  const llamadas: Array<{ url: string; init?: RequestInit }> = []
  const siguiente = (cola: Respuesta[]): Respuesta => (cola.length > 1 ? cola.shift()! : (cola[0] ?? 'ok'))
  const fetchFalso = vi.fn(async (url: string, init?: RequestInit) => {
    llamadas.push({ url, init })
    const esSorteos = url === URL_SORTEOS
    const modo = siguiente(esSorteos ? guion.sorteos : guion.stats)
    if (modo === 'red') throw new TypeError('Failed to fetch')
    const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } })
    if (modo === '500') return json({ error: 'interno' }, 500)
    if (modo === '500-con-datos') return json(esSorteos ? { data: SORTEOS } : STATS, 500) // un error con un cuerpo que parece bueno
    if (modo === 'cuerpo-raro') return new Response('<html>no es json</html>', { status: 200 })
    if (esSorteos) return modo === 'array' ? json(SORTEOS) : modo === 'vacio' ? json({ data: [] }) : modo === 'sin-total' ? json({ otro: 1 }) : json({ data: SORTEOS })
    return modo === 'vacio' ? json({}) : modo === 'sin-total' ? json({ total_sorteos: 'muchos' }) : json(STATS)
  })
  vi.stubGlobal('fetch', fetchFalso)
  return { guion, llamadas, fetchFalso, deSorteos: () => llamadas.filter((l) => l.url === URL_SORTEOS), deStats: () => llamadas.filter((l) => l.url === URL_STATS) }
}

let red: ReturnType<typeof crearRed>

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  document.body.innerHTML = '<div id="toast"></div>'
  red = crearRed()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Contrato genérico de Store
// ---------------------------------------------------------------------------
const control: ControlDeCarga = {
  cargar: (s) => (s as ReactStore).cargar(),
  fallarSiguienteRecarga: () => {
    red.guion.sorteos = ['red']
    red.guion.stats = ['500']
  },
}
describirContratoDeStore('ReactStore', () => crearReactStore(), control)

// ---------------------------------------------------------------------------
// Estado de partida y tema
// ---------------------------------------------------------------------------
describe('ReactStore: estado de partida', () => {
  it('empieza vacío: sin sorteos ni estadísticas, premios primero, modo estadístico y Predicciones activa', () => {
    const s = crearReactStore().getSnapshot()
    expect(s).toEqual({ sorteos: [], stats: null, useML: false, prize: 'primero', statsPrize: 'primero', theme: 'dark', activeTab: 'predicciones', ready: false, simulacion: null, errorSorteos: false, errorStats: false })
  })

  it('crearlo no pide nada a la red: la carga la lanza quien lo usa', () => {
    crearReactStore()
    expect(red.fetchFalso).not.toHaveBeenCalled()
  })

  it('sin tema guardado es oscuro y lo deja puesto en el documento', () => {
    expect(crearReactStore().getSnapshot().theme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('recupera el tema claro guardado y lo aplica al documento', () => {
    localStorage.setItem(CLAVE_TEMA, 'light')
    expect(crearReactStore().getSnapshot().theme).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('un valor guardado que no es «light» se trata como oscuro', () => {
    localStorage.setItem(CLAVE_TEMA, 'sepia')
    expect(crearReactStore().getSnapshot().theme).toBe('dark')
  })

  it('si el navegador no deja leer ni escribir el almacenamiento, funciona con el tema oscuro', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    const store = crearReactStore()
    expect(store.getSnapshot().theme).toBe('dark')
    store.actions.setTheme('light')
    expect(store.getSnapshot().theme).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })
})

describe('ReactStore: tema, pestaña y premios', () => {
  it('setTheme cambia el estado, el atributo del documento y lo recuerda', () => {
    const store = crearReactStore()
    store.actions.setTheme('light')
    expect(store.getSnapshot().theme).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('light')
    store.actions.setTheme('dark')
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('dark')
  })

  it('un tema desconocido se ignora y repetir el actual no avisa', () => {
    const store = crearReactStore()
    const escucha = vi.fn()
    store.subscribe(escucha)
    store.actions.setTheme('sepia' as never)
    store.actions.setTheme('dark')
    expect(escucha).not.toHaveBeenCalled()
    expect(store.getSnapshot().theme).toBe('dark')
  })

  it('setActiveTab acepta las 14 pestañas y rechaza una desconocida', () => {
    const store = crearReactStore()
    store.actions.setActiveTab('seguimiento')
    expect(store.getSnapshot().activeTab).toBe('seguimiento')
    store.actions.setActiveTab('inexistente' as never)
    expect(store.getSnapshot().activeTab).toBe('seguimiento')
  })

  it('repetir la pestaña activa no avisa', () => {
    const store = crearReactStore()
    const escucha = vi.fn()
    store.subscribe(escucha)
    store.actions.setActiveTab('predicciones')
    expect(escucha).not.toHaveBeenCalled()
  })

  it('los premios desconocidos se ignoran y repetir el mismo no avisa', () => {
    const store = crearReactStore()
    const escucha = vi.fn()
    store.subscribe(escucha)
    store.actions.setPrize('cuarto' as never)
    store.actions.setStatsPrize('cuarto' as never)
    store.actions.setPrize('primero')
    store.actions.setStatsPrize('primero')
    expect(escucha).not.toHaveBeenCalled()
    store.actions.setPrize('tercero')
    store.actions.setStatsPrize('segundo')
    expect(escucha).toHaveBeenCalledTimes(2)
    expect(store.getSnapshot()).toMatchObject({ prize: 'tercero', statsPrize: 'segundo' })
  })

  it('el premio de Predicciones y el de Estadísticas son independientes', () => {
    const store = crearReactStore()
    store.actions.setPrize('segundo')
    expect(store.getSnapshot().statsPrize).toBe('primero')
    store.actions.setStatsPrize('tercero')
    expect(store.getSnapshot().prize).toBe('segundo')
  })

  it('simularNumero activa el Simulador y numera las peticiones aunque el número se repita', () => {
    const store = crearReactStore()
    store.actions.simularNumero('0042')
    const a = store.getSnapshot().simulacion
    store.actions.simularNumero('0042')
    const b = store.getSnapshot().simulacion
    expect(a).toEqual({ numero: '0042', id: 1 })
    expect(b).toEqual({ numero: '0042', id: 2 })
    expect(store.getSnapshot().activeTab).toBe('simulador')
  })

  it('una escucha que lanza no impide que avisen las demás ni rompe el cambio', () => {
    const store = crearReactStore()
    const buena = vi.fn()
    store.subscribe(() => {
      throw new Error('escucha rota')
    })
    store.subscribe(buena)
    store.actions.setUseML(true)
    expect(buena).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot().useML).toBe(true)
    expect(console.error).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Aviso emergente y modo ML
// ---------------------------------------------------------------------------
describe('ReactStore: aviso emergente y modo ML', () => {
  const aviso = () => document.getElementById('toast')!

  it('toast escribe el texto, lo muestra y lo apaga a los 2500 ms por defecto', () => {
    vi.useFakeTimers()
    const store = crearReactStore()
    store.actions.toast('Hola')
    expect(aviso().textContent).toBe('Hola')
    expect(aviso().classList.contains('show')).toBe(true)
    vi.advanceTimersByTime(2499)
    expect(aviso().classList.contains('show')).toBe(true)
    vi.advanceTimersByTime(1)
    expect(aviso().classList.contains('show')).toBe(false)
  })

  it('un aviso nuevo reinicia el temporizador: el viejo no apaga el nuevo', () => {
    vi.useFakeTimers()
    const store = crearReactStore()
    store.actions.toast('uno', 1000)
    vi.advanceTimersByTime(900)
    store.actions.toast('dos', 1000)
    vi.advanceTimersByTime(900)
    expect(aviso().textContent).toBe('dos')
    expect(aviso().classList.contains('show')).toBe(true)
    vi.advanceTimersByTime(100)
    expect(aviso().classList.contains('show')).toBe(false)
  })

  it('sin el elemento del aviso no falla', () => {
    document.body.innerHTML = ''
    expect(() => crearReactStore().actions.toast('x')).not.toThrow()
  })

  it('activar ML con un modelo entrenado avisa con las muestras y la fecha', async () => {
    vi.useFakeTimers()
    const store = crearReactStore()
    const ml = { ...STATS.ml_info, trained: true, train_samples: 1234, train_date: '2026-11-12' }
    red.fetchFalso.mockImplementation(async (url: string) => new Response(JSON.stringify(url === URL_SORTEOS ? { data: SORTEOS } : { ...STATS, ml_info: ml })))
    await store.cargar()
    store.actions.setUseML(true)
    expect(aviso().textContent).toBe('ML: 1234 muestras · Entrenado: 2026-11-12')
    expect(aviso().classList.contains('show')).toBe(true)
    vi.advanceTimersByTime(3000)
    expect(aviso().classList.contains('show')).toBe(false)
  })

  it('no avisa al desactivar ML, sin modelo entrenado ni antes de que lleguen las estadísticas', async () => {
    const store = crearReactStore()
    store.actions.setUseML(true) // todavía sin estadísticas
    expect(aviso().textContent).toBe('')
    store.actions.setUseML(false)
    red.fetchFalso.mockImplementation(async (url: string) => new Response(JSON.stringify(url === URL_SORTEOS ? { data: SORTEOS } : { ...STATS, ml_info: { ...STATS.ml_info, trained: false } })))
    await store.cargar()
    store.actions.setUseML(true)
    expect(aviso().textContent).toBe('')
  })

  it('repetir el mismo modo no avisa ni repite el aviso', async () => {
    const store = crearReactStore()
    const escucha = vi.fn()
    store.subscribe(escucha)
    store.actions.setUseML(false)
    expect(escucha).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Carga en dos fases
// ---------------------------------------------------------------------------
describe('ReactStore: carga en dos fases', () => {
  it('pide primero los sorteos y después las estadísticas, cada uno una vez', async () => {
    const store = crearReactStore()
    await store.cargar()
    expect(red.llamadas.map((l) => l.url)).toEqual([URL_SORTEOS, URL_STATS])
    expect(store.getSnapshot()).toMatchObject({ ready: true, errorSorteos: false })
    expect(store.getSnapshot().sorteos).toHaveLength(SORTEOS.length)
    expect(store.getSnapshot().stats).toEqual(STATS)
  })

  it('los sorteos llegan y `ready` es true mientras las estadísticas siguen en camino (stats null)', async () => {
    const store = crearReactStore()
    let soltar!: () => void
    red.fetchFalso.mockImplementation(async (url: string) => {
      if (url === URL_STATS) await new Promise<void>((r) => (soltar = r))
      return new Response(JSON.stringify(url === URL_SORTEOS ? { data: SORTEOS } : STATS))
    })
    const carga = store.cargar()
    await vi.waitFor(() => expect(store.getSnapshot().ready).toBe(true))
    expect(store.getSnapshot().stats).toBeNull()
    expect(store.getSnapshot().sorteos).toHaveLength(SORTEOS.length)
    soltar()
    await carga
    expect(store.getSnapshot().stats).toEqual(STATS)
  })

  it('las estadísticas se piden con un límite de 180 000 ms', async () => {
    const espia = vi.spyOn(AbortSignal, 'timeout')
    await crearReactStore().cargar()
    expect(LIMITE_STATS_MS).toBe(180_000)
    expect(espia).toHaveBeenCalledWith(180_000)
    expect(red.deStats()[0]!.init?.signal).toBeInstanceOf(AbortSignal)
    expect(red.deSorteos()[0]!.init?.signal).toBeUndefined() // los sorteos no llevan límite, como en app.js
  })

  it('acepta los sorteos como lista suelta o dentro de `data`', async () => {
    red.guion.sorteos = ['array']
    const a = crearReactStore()
    await a.cargar()
    expect(a.getSnapshot().sorteos).toHaveLength(SORTEOS.length)
    red.guion.sorteos = ['ok']
    const b = crearReactStore()
    await b.cargar()
    expect(b.getSnapshot().sorteos).toHaveLength(SORTEOS.length)
  })

  it('una lista vacía no deja `ready` en true', async () => {
    red.guion.sorteos = ['vacio']
    const store = crearReactStore()
    await store.cargar()
    expect(store.getSnapshot().sorteos).toEqual([])
    expect(store.getSnapshot().ready).toBe(false)
    expect(store.getSnapshot().errorSorteos).toBe(false)
  })

  it.each<[Respuesta]>([['red'], ['500'], ['500-con-datos'], ['sin-total'], ['cuerpo-raro']])('si los sorteos fallan (%s) y no hay ninguno, `errorSorteos` es true y `ready` false', async (modo) => {
    red.guion.sorteos = [modo]
    const store = crearReactStore()
    await store.cargar()
    expect(store.getSnapshot()).toMatchObject({ errorSorteos: true, ready: false, sorteos: [] })
    expect(console.error).toHaveBeenCalledWith('Error loading sorteos:', expect.anything())
  })

  it('aun sin sorteos sigue con las estadísticas, como app.js', async () => {
    red.guion.sorteos = ['red']
    const store = crearReactStore()
    await store.cargar()
    expect(store.getSnapshot().stats).toEqual(STATS)
  })

  it('un nuevo intento baja `errorSorteos` mientras dura y lo deja en false si funciona', async () => {
    red.guion.sorteos = ['red']
    const store = crearReactStore()
    await store.cargar()
    expect(store.getSnapshot().errorSorteos).toBe(true)
    red.guion.sorteos = ['ok']
    const vistos: boolean[] = []
    store.subscribe(() => vistos.push(store.getSnapshot().errorSorteos))
    await store.actions.reload()
    expect(vistos[0]).toBe(false)
    expect(store.getSnapshot()).toMatchObject({ errorSorteos: false, ready: true })
  })

  it('un fallo al recargar con datos ya cargados los conserva y no marca error', async () => {
    const store = crearReactStore()
    await store.cargar()
    const antes = store.getSnapshot()
    red.guion.sorteos = ['500']
    await store.actions.reload()
    expect(store.getSnapshot().sorteos).toBe(antes.sorteos)
    expect(store.getSnapshot().errorSorteos).toBe(false)
    expect(store.getSnapshot().ready).toBe(true)
  })

  it('una recarga correcta sustituye los datos por los nuevos', async () => {
    const store = crearReactStore()
    await store.cargar()
    const viejos = store.getSnapshot()
    await store.actions.reload()
    expect(store.getSnapshot().sorteos).not.toBe(viejos.sorteos)
    expect(store.getSnapshot().stats).not.toBe(viejos.stats)
  })
})

describe('ReactStore: estadísticas con reintentos', () => {
  it('reintenta hasta 3 veces sin esperar y se queda con el primer intento bueno', async () => {
    red.guion.stats = ['red', '500', 'ok']
    const store = crearReactStore()
    await store.cargar()
    expect(INTENTOS_STATS).toBe(3)
    expect(red.deStats()).toHaveLength(3)
    expect(store.getSnapshot().stats).toEqual(STATS)
    expect(console.warn).toHaveBeenCalledTimes(2)
    expect(console.warn).toHaveBeenCalledWith('Stats attempt 1 failed, retrying...')
    expect(console.warn).toHaveBeenCalledWith('Stats attempt 2 failed, retrying...')
    expect(console.error).not.toHaveBeenCalled()
  })

  it('si los 3 intentos fallan, `stats` sigue en null y se registra un único error', async () => {
    red.guion.stats = ['500']
    const store = crearReactStore()
    await store.cargar()
    expect(red.deStats()).toHaveLength(3)
    expect(store.getSnapshot().stats).toBeNull()
    expect(console.warn).toHaveBeenCalledTimes(2)
    expect(console.error).toHaveBeenCalledTimes(1)
    expect(console.error).toHaveBeenCalledWith('Error loading stats:', expect.anything())
  })

  it('no se pide una cuarta vez', async () => {
    red.guion.stats = ['red']
    await crearReactStore().cargar()
    expect(red.deStats()).toHaveLength(INTENTOS_STATS)
  })

  it('con las estadísticas por llegar `errorStats` es false; si llegan, sigue en false', async () => {
    const store = crearReactStore()
    expect(store.getSnapshot().errorStats).toBe(false)
    await store.cargar()
    expect(store.getSnapshot()).toMatchObject({ errorStats: false, stats: STATS })
  })

  it('si los 3 intentos fallan y no hay estadísticas, `errorStats` es true', async () => {
    red.guion.stats = ['500']
    const store = crearReactStore()
    await store.cargar()
    expect(store.getSnapshot()).toMatchObject({ errorStats: true, stats: null })
  })

  it('un intento que falla pero no es el último no activa `errorStats`', async () => {
    red.guion.stats = ['red', 'red', 'ok']
    const store = crearReactStore()
    const vistos: boolean[] = []
    store.subscribe(() => vistos.push(store.getSnapshot().errorStats))
    await store.cargar()
    expect(vistos).not.toContain(true)
    expect(store.getSnapshot().errorStats).toBe(false)
  })

  it('un nuevo intento baja `errorStats` mientras dura y lo deja en false si funciona', async () => {
    red.guion.stats = ['500']
    const store = crearReactStore()
    await store.cargar()
    expect(store.getSnapshot().errorStats).toBe(true)
    red.guion.stats = ['ok']
    const vistos: boolean[] = []
    store.subscribe(() => vistos.push(store.getSnapshot().errorStats))
    await store.actions.reload()
    expect(vistos[0]).toBe(false)
    expect(store.getSnapshot()).toMatchObject({ errorStats: false, stats: STATS })
  })

  it('un nuevo intento que vuelve a fallar deja `errorStats` otra vez en true', async () => {
    red.guion.stats = ['500']
    const store = crearReactStore()
    await store.cargar()
    await store.actions.reload()
    expect(store.getSnapshot()).toMatchObject({ errorStats: true, stats: null })
  })

  it('un fallo al recargar con estadísticas ya cargadas las conserva y no marca error', async () => {
    const store = crearReactStore()
    await store.cargar()
    const viejas = store.getSnapshot().stats
    red.guion.stats = ['500']
    await store.actions.reload()
    expect(store.getSnapshot().stats).toBe(viejas)
    expect(store.getSnapshot().errorStats).toBe(false)
  })

  it.each<[Respuesta, string]>([
    ['500', 'un 500 con cuerpo JSON'],
    ['500-con-datos', 'un 500 cuyo cuerpo parece unas estadísticas válidas'],
    ['vacio', 'un cuerpo vacío'],
    ['sin-total', 'un cuerpo con total_sorteos que no es un número'],
    ['cuerpo-raro', 'un cuerpo que no es JSON'],
  ])('%s: %s no ocupa el lugar de las estadísticas', async (modo) => {
    red.guion.stats = [modo]
    const store = crearReactStore()
    await store.cargar()
    expect(store.getSnapshot().stats).toBeNull()
  })

  it('tras un fallo de recarga conservan las estadísticas viejas, nunca datos a medias', async () => {
    const store = crearReactStore()
    await store.cargar()
    const viejas = store.getSnapshot().stats
    red.guion.stats = ['vacio']
    await store.actions.reload()
    expect(store.getSnapshot().stats).toBe(viejas)
  })

  it('los datos nuevos se publican de golpe: las estadísticas no cambian hasta que llegan completas', async () => {
    const store = crearReactStore()
    await store.cargar()
    const viejas = store.getSnapshot().stats
    let soltar!: () => void
    red.fetchFalso.mockImplementation(async (url: string) => {
      if (url === URL_STATS) await new Promise<void>((r) => (soltar = r))
      return new Response(JSON.stringify(url === URL_SORTEOS ? { data: SORTEOS } : { ...STATS, total_sorteos: 1 }))
    })
    const recarga = store.actions.reload()
    await vi.waitFor(() => expect(soltar).toBeTypeOf('function'))
    expect(store.getSnapshot().stats).toBe(viejas)
    soltar()
    await recarga
    expect(store.getSnapshot().stats?.total_sorteos).toBe(1)
  })
})

describe('ReactStore: una sola carga a la vez', () => {
  it('pedir otra recarga mientras corre una devuelve la misma y no repite las peticiones', async () => {
    const store = crearReactStore()
    const a = store.cargar()
    const b = store.actions.reload()
    await Promise.all([a, b])
    expect(red.deSorteos()).toHaveLength(1)
    expect(red.deStats()).toHaveLength(1)
  })

  it('terminada una carga se puede lanzar otra', async () => {
    const store = crearReactStore()
    await store.cargar()
    await store.actions.reload()
    expect(red.deSorteos()).toHaveLength(2)
    expect(red.deStats()).toHaveLength(2)
  })

  it('una carga fallida tampoco bloquea la siguiente', async () => {
    red.guion.sorteos = ['red', 'ok']
    red.guion.stats = ['500', 'ok']
    const store = crearReactStore()
    await store.cargar()
    expect(store.getSnapshot().errorSorteos).toBe(true)
    await store.actions.reload()
    expect(store.getSnapshot().errorSorteos).toBe(false)
    expect(store.getSnapshot().stats).toEqual(STATS)
  })

  it('reload nunca rechaza, aunque falle algo inesperado dentro', async () => {
    red.fetchFalso.mockImplementation(() => {
      throw new Error('boom')
    })
    await expect(crearReactStore().actions.reload()).resolves.toBeUndefined()
  })
})
