/**
 * `errorSorteos` en el puente de `static/app.js` (seguimiento de la revisión de T035): contra el `app.js` real, la
 * carga inicial de sorteos puede fallar y el Store tiene que poder decirlo, para que una isla no se quede en su
 * esqueleto para siempre. Va en un archivo propio porque `puente.test.ts` carga los datos antes de cada prueba y aquí
 * el primer intento tiene que fallar.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearLegacyStore } from './legacyStore'
import { levantarLegacy, type Legacy } from './legacyHarness'
import type { Store } from './tipos'

let legacy: Legacy
let store: Store

beforeEach(() => {
  legacy = levantarLegacy()
  store = crearLegacyStore()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('errorSorteos en el puente', () => {
  it('con la carga correcta vale false', async () => {
    await legacy.iniciar()
    const s = store.getSnapshot()
    expect(s.errorSorteos).toBe(false)
    expect(s.ready).toBe(true)
  })

  it('antes de cargar nada vale false (todavía no ha fallado nada)', () => {
    expect(store.getSnapshot().errorSorteos).toBe(false)
  })

  it.each(['red', 'cuerpo'] as const)('si la carga inicial de sorteos falla (%s) vale true, sin sorteos y con `ready` en false', async (como) => {
    legacy.fallarSiguienteRecarga(como)
    await legacy.iniciar()
    const s = store.getSnapshot()
    expect(s.errorSorteos).toBe(true)
    expect(s.ready).toBe(false)
    expect(s.sorteos).toHaveLength(0)
  })

  it('avisa a los suscriptores cuando falla, con el estado nuevo ya visible', async () => {
    const vistos: boolean[] = []
    store.subscribe(() => vistos.push(store.getSnapshot().errorSorteos))
    legacy.fallarSiguienteRecarga()
    await legacy.iniciar()
    expect(vistos.at(-1)).toBe(true)
  })

  it('«reload» tras el fallo lo vuelve a false al EMPEZAR el intento (la isla enseña el esqueleto) y deja los sorteos al terminar', async () => {
    legacy.fallarSiguienteRecarga()
    await legacy.iniciar()
    expect(store.getSnapshot().errorSorteos).toBe(true)
    const vistos: boolean[] = []
    store.subscribe(() => vistos.push(store.getSnapshot().errorSorteos))
    await store.actions.reload()
    expect(vistos[0], 'el primer aviso del reintento debe ser el de «ya no hay error»').toBe(false)
    const s = store.getSnapshot()
    expect(s.errorSorteos).toBe(false)
    expect(s.ready).toBe(true)
    expect(s.sorteos.length).toBeGreaterThan(0)
  })

  it('si el reintento también falla vuelve a true', async () => {
    legacy.fallarSiguienteRecarga()
    await legacy.iniciar()
    legacy.fallarSiguienteRecarga()
    await store.actions.reload()
    const s = store.getSnapshot()
    expect(s.errorSorteos).toBe(true)
    expect(s.ready).toBe(false)
  })

  it('un fallo al RECARGAR con los datos ya cargados no lo marca: se conservan los viejos (contrato de `reload`)', async () => {
    await legacy.iniciar()
    legacy.fallarSiguienteRecarga()
    await store.actions.reload()
    const s = store.getSnapshot()
    expect(s.errorSorteos).toBe(false)
    expect(s.ready).toBe(true)
    expect(s.sorteos.length).toBeGreaterThan(0)
  })

  it('la instantánea conserva su referencia mientras no cambia nada', async () => {
    legacy.fallarSiguienteRecarga()
    await legacy.iniciar()
    expect(store.getSnapshot()).toBe(store.getSnapshot())
  })
})
