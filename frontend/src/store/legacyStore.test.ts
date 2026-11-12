import { afterEach, describe, expect, it, vi } from 'vitest'
import { describirContratoDeStore, type ControlDeCarga } from './contratoStore'
import { crearLegacyStore } from './legacyStore'
import { levantarLegacy, type Legacy } from './legacyHarness'

let actual: Legacy

afterEach(() => {
  vi.unstubAllGlobals()
})

const control: ControlDeCarga = {
  cargar: () => actual.iniciar(),
  fallarSiguienteRecarga: () => actual.fallarSiguienteRecarga(),
}

describirContratoDeStore(
  'LegacyStore sobre static/app.js',
  () => {
    actual = levantarLegacy()
    return crearLegacyStore()
  },
  control,
)

describe('crearLegacyStore', () => {
  it('sin puente falla con un mensaje claro', () => {
    delete window.LP
    expect(() => crearLegacyStore()).toThrow(/window\.LP/)
  })
})
