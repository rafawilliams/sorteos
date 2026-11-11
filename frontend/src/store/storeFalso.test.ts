import { describe, expect, it, vi } from 'vitest'
import { crearStoreFalso } from './storeFalso'

describe('crearStoreFalso: estado inicial', () => {
  it('empieza sin datos, en tema oscuro, en Predicciones y sin modelo ML', () => {
    const s = crearStoreFalso().getSnapshot()
    expect(s).toEqual({
      sorteos: [],
      stats: null,
      useML: false,
      prize: 'primero',
      statsPrize: 'primero',
      theme: 'dark',
      activeTab: 'predicciones',
      ready: false,
    })
  })

  it('acepta un estado inicial parcial', () => {
    const s = crearStoreFalso({ theme: 'light', activeTab: 'gaps', ready: true }).getSnapshot()
    expect(s.theme).toBe('light')
    expect(s.activeTab).toBe('gaps')
    expect(s.ready).toBe(true)
    expect(s.useML).toBe(false)
  })
})

describe('crearStoreFalso: instantánea estable y suscripciones', () => {
  it('devuelve la misma referencia mientras no cambie el estado', () => {
    const store = crearStoreFalso()
    expect(store.getSnapshot()).toBe(store.getSnapshot())
  })

  it('cambia de referencia y de valor tras `cambiar`', () => {
    const store = crearStoreFalso()
    const antes = store.getSnapshot()
    store.cambiar({ useML: true })
    const despues = store.getSnapshot()
    expect(despues).not.toBe(antes)
    expect(despues.useML).toBe(true)
    expect(antes.useML).toBe(false)
  })

  it('avisa a todos los suscriptores tras cada cambio', () => {
    const store = crearStoreFalso()
    const a = vi.fn()
    const b = vi.fn()
    store.subscribe(a)
    store.subscribe(b)
    store.cambiar({ theme: 'light' })
    store.cambiar({ theme: 'dark' })
    expect(a).toHaveBeenCalledTimes(2)
    expect(b).toHaveBeenCalledTimes(2)
  })

  it('deja de avisar a quien cancela su suscripción', () => {
    const store = crearStoreFalso()
    const escucha = vi.fn()
    const cancelar = store.subscribe(escucha)
    store.cambiar({ ready: true })
    cancelar()
    store.cambiar({ ready: false })
    expect(escucha).toHaveBeenCalledTimes(1)
  })
})

describe('crearStoreFalso: acciones', () => {
  it('setUseML, setPrize y setStatsPrize cambian el estado y se registran', () => {
    const store = crearStoreFalso()
    store.actions.setUseML(true)
    store.actions.setPrize('tercero')
    store.actions.setStatsPrize('segundo')
    const s = store.getSnapshot()
    expect([s.useML, s.prize, s.statsPrize]).toEqual([true, 'tercero', 'segundo'])
    expect(store.llamadas).toEqual([
      { accion: 'setUseML', args: [true] },
      { accion: 'setPrize', args: ['tercero'] },
      { accion: 'setStatsPrize', args: ['segundo'] },
    ])
  })

  it('toast se registra con su mensaje y su duración', () => {
    const store = crearStoreFalso()
    store.actions.toast('Copiado: 1234', 3000)
    store.actions.toast('Listo')
    expect(store.llamadas).toEqual([
      { accion: 'toast', args: ['Copiado: 1234', 3000] },
      { accion: 'toast', args: ['Listo', undefined] },
    ])
  })

  it('reload se registra y devuelve una promesa que se resuelve', async () => {
    const store = crearStoreFalso()
    await expect(store.actions.reload()).resolves.toBeUndefined()
    expect(store.llamadas).toEqual([{ accion: 'reload', args: [] }])
  })
})
