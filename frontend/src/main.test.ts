import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// main.tsx solo cablea: glob de `tabs/` (sin pruebas), almacén del puente y `montarIslas`.

const montarIslas = vi.fn()
vi.mock('./montaje', () => ({ montarIslas: (...args: unknown[]) => montarIslas(...args) }))

const puente = {
  getSnapshot: () => ({}),
  subscribe: () => () => {},
  setUseML() {},
  setPrize() {},
  setStatsPrize() {},
  toast() {},
  simular() {},
  reload: async () => {},
}

beforeEach(() => {
  vi.resetModules()
  montarIslas.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  delete window.LP
  vi.restoreAllMocks()
})

describe('main.tsx', () => {
  it('monta las islas con el almacén del puente', async () => {
    window.LP = puente as unknown as typeof window.LP
    await import('./main')
    expect(montarIslas).toHaveBeenCalledTimes(1)
    const [modulos, store] = montarIslas.mock.calls[0]!
    expect(typeof modulos).toBe('object')
    expect(typeof store.getSnapshot).toBe('function')
  })

  it('sin puente no lanza: lo deja en la consola y no monta nada', async () => {
    await expect(import('./main')).resolves.toBeDefined()
    expect(montarIslas).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalled()
  })

  it('el glob excluye los archivos de prueba de tabs/ (no deben entrar en el bundle)', () => {
    const fuente = readFileSync('src/main.tsx', 'utf-8')
    expect(fuente).toContain("'./tabs/*.tsx'")
    expect(fuente).toContain("'!./tabs/*.test.tsx'")
  })
})
