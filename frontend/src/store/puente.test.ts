/**
 * El puente `window.LP` de `static/app.js` contra el `app.js` real (plantilla y fixtures reales, ver legacyHarness.ts).
 * Lo que no cubre el contrato genérico: los cambios nacidos en la parte antigua llegan a React, los de React llegan a
 * la parte antigua, y React no pide datos por su cuenta.
 */
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Premio } from '../api/types'
import { crearLegacyStore } from './legacyStore'
import { levantarLegacy, type Legacy } from './legacyHarness'
import type { Store } from './tipos'

const g = () => globalThis as unknown as { toggleTheme(): void; toggleML(): void }

let legacy: Legacy
let store: Store

beforeEach(async () => {
  legacy = levantarLegacy()
  store = crearLegacyStore()
  await legacy.iniciar()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const NUM_SORTEOS: number = JSON.parse(readFileSync('fixtures/sorteos.json', 'utf-8')).data.length
const clic = (selector: string) => (document.querySelector(selector) as HTMLElement).click()

describe('de app.js a React', () => {
  it('cambiar el tema avisa y la instantánea lo refleja', () => {
    const escucha = vi.fn()
    store.subscribe(escucha)
    expect(store.getSnapshot().theme).toBe('dark')
    g().toggleTheme() // lo que invoca el onclick de #themeToggle
    expect(store.getSnapshot().theme).toBe('light')
    expect(escucha).toHaveBeenCalled()
    g().toggleTheme()
    expect(store.getSnapshot().theme).toBe('dark')
  })

  it('activar una pestaña de navegación actualiza activeTab', () => {
    expect(store.getSnapshot().activeTab).toBe('predicciones')
    clic('#navTabs .nav-tab[data-tab="decenas"]')
    expect(store.getSnapshot().activeTab).toBe('decenas')
  })

  it('el interruptor ML actualiza useML en ambos sentidos', () => {
    g().toggleML()
    expect(store.getSnapshot().useML).toBe(true)
    g().toggleML()
    expect(store.getSnapshot().useML).toBe(false)
  })

  it('las pestañas de premio actualizan prize y statsPrize (statsPrize era un valor muerto en app.js)', () => {
    clic('#prizeTabs .prize-tab[data-prize="segundo"]')
    expect(store.getSnapshot().prize).toBe('segundo')
    expect(store.getSnapshot().statsPrize).toBe('primero')
    clic('#statsPrizeTabs .prize-tab[data-prize="tercero"]')
    expect(store.getSnapshot().statsPrize).toBe('tercero')
    expect(store.getSnapshot().prize).toBe('segundo')
  })

  it('tras la carga hay sorteos, estadísticas y ready', () => {
    const s = store.getSnapshot()
    expect(s.ready).toBe(true)
    expect(s.sorteos).toHaveLength(NUM_SORTEOS)
    expect(s.stats?.total_sorteos).toBe(600)
  })

  it('al elegir otra pestaña de estadísticas, la zona de estadísticas se repinta con ese premio', () => {
    clic('#statsPrizeTabs .prize-tab[data-prize="segundo"]')
    expect(document.querySelector('#statsPrizeTabs .prize-tab[data-prize="segundo"]')?.getAttribute('aria-selected')).toBe('true')
    expect(document.getElementById('digitChart')?.innerHTML).not.toBe('')
  })
})

describe('de React a app.js', () => {
  it('setUseML actualiza el estado y el botón de la parte antigua', () => {
    store.actions.setUseML(true)
    expect(store.getSnapshot().useML).toBe(true)
    const botones = Array.from(document.querySelectorAll('.ml-toggle'))
    expect(botones.length).toBeGreaterThan(0)
    botones.forEach((b) => expect(b.getAttribute('aria-pressed')).toBe('true'))
    store.actions.setUseML(true) // repetir no hace nada raro
    expect(store.getSnapshot().useML).toBe(true)
  })

  it('setPrize y setStatsPrize marcan la pestaña antigua y cambian el estado', () => {
    store.actions.setPrize('tercero' as Premio)
    expect(store.getSnapshot().prize).toBe('tercero')
    expect(document.querySelector('#prizeTabs .prize-tab[data-prize="tercero"]')?.getAttribute('aria-selected')).toBe('true')
    store.actions.setStatsPrize('segundo' as Premio)
    expect(store.getSnapshot().statsPrize).toBe('segundo')
    expect(document.querySelector('#statsPrizeTabs .prize-tab[data-prize="segundo"]')?.getAttribute('aria-selected')).toBe('true')
  })

  it('un premio desconocido se ignora', () => {
    store.actions.setPrize('cuarto' as Premio)
    expect(store.getSnapshot().prize).toBe('primero')
  })

  it('toast muestra el aviso de la página', () => {
    store.actions.toast('Hola')
    const t = document.getElementById('toast')!
    expect(t.textContent).toBe('Hola')
    expect(t.classList.contains('show')).toBe(true)
  })
})

describe('antes de la carga', () => {
  it('una instantánea tomada antes de cargar pasa a ready y recibe un aviso cuando llegan los datos', async () => {
    legacy = levantarLegacy()
    store = crearLegacyStore()
    const antes = store.getSnapshot()
    expect(antes.ready).toBe(false)
    expect(antes.stats).toBeNull()
    const escucha = vi.fn()
    store.subscribe(escucha)
    await legacy.iniciar()
    expect(escucha).toHaveBeenCalled()
    const despues = store.getSnapshot()
    expect(despues.ready).toBe(true)
    expect(despues.sorteos).toHaveLength(NUM_SORTEOS)
    expect(despues.stats?.total_sorteos).toBe(600)
  })
})

describe('referencias y datos', () => {
  it('sin cambios las referencias son estables, y un cambio ajeno no toca sorteos ni stats', () => {
    const antes = store.getSnapshot()
    expect(store.getSnapshot()).toBe(antes)
    store.actions.setUseML(true)
    const despues = store.getSnapshot()
    expect(despues).not.toBe(antes)
    expect(despues.sorteos).toBe(antes.sorteos)
    expect(despues.stats).toBe(antes.stats)
  })

  it('reload trae datos nuevos y conserva los viejos si falla', async () => {
    const antes = store.getSnapshot()
    await store.actions.reload()
    const trasExito = store.getSnapshot()
    expect(trasExito.sorteos).not.toBe(antes.sorteos) // llegó una lista nueva
    legacy.fallarSiguienteRecarga()
    await store.actions.reload()
    const trasFallo = store.getSnapshot()
    expect(trasFallo.sorteos).toBe(trasExito.sorteos)
    expect(trasFallo.stats).toBe(trasExito.stats)
    expect(trasFallo.stats?.total_sorteos).toBe(600)
  })

  it('un cuerpo de error en /api/sorteos no ocupa el lugar de la lista', async () => {
    const antes = store.getSnapshot().sorteos
    legacy.fallarSiguienteRecarga('cuerpo')
    await store.actions.reload()
    expect(store.getSnapshot().sorteos).toBe(antes)
    expect(Array.isArray(store.getSnapshot().sorteos)).toBe(true)
  })

  it('un 500 con cuerpo JSON en /api/stats no ocupa el lugar de las estadísticas', async () => {
    legacy.fallarSiguienteRecarga()
    await store.actions.reload()
    expect(store.getSnapshot().stats?.total_sorteos).toBe(600)
  })

  it('app.js emite lp:change en el documento', () => {
    const oyente = vi.fn()
    document.addEventListener('lp:change', oyente)
    store.actions.setUseML(true)
    document.removeEventListener('lp:change', oyente)
    expect(oyente).toHaveBeenCalled()
    expect((oyente.mock.calls[0]![0] as CustomEvent).detail.campos).toContain('useML')
  })

  it('crear el almacén y leerlo no pide datos: solo app.js llama a /api/sorteos y /api/stats', () => {
    const n = (prefijo: string) => legacy.peticiones.filter((u) => u.startsWith(prefijo)).length
    expect(n('/api/sorteos')).toBe(1)
    expect(n('/api/stats')).toBe(1)
    const otro = crearLegacyStore()
    otro.getSnapshot()
    otro.subscribe(() => {})()
    expect(n('/api/sorteos')).toBe(1)
    expect(n('/api/stats')).toBe(1)
  })
})
