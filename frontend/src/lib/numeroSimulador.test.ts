import { describe, expect, it } from 'vitest'
import { normalizarNumero, validarNumero } from './numeroSimulador'

// El ÚNICO relleno de ceros permitido en la interfaz: lo que teclea el usuario (principio 7, plan §0).
describe('normalizarNumero', () => {
  it.each([
    ['74', '0074'],
    ['5', '0005'],
    ['0042', '0042'],
    ['9614', '9614'],
    [' 74 ', '0074'],
    ['\t7\n', '0007'],
    ['', '0000'],
  ])('«%s» → «%s»', (entrada, esperado) => {
    expect(normalizarNumero(entrada)).toBe(esperado)
  })

  it('no recorta lo que ya es más largo (se rechaza al validar, no se corta)', () => {
    expect(normalizarNumero('12345')).toBe('12345')
  })
})

describe('validarNumero', () => {
  it.each([
    ['74', '0074'],
    ['0042', '0042'],
    [' 5 ', '0005'],
    ['9614', '9614'],
  ])('«%s» es válido y queda «%s»', (entrada, esperado) => {
    expect(validarNumero(entrada)).toBe(esperado)
  })

  it.each([[''], ['   '], ['abc'], ['12a4'], ['12345'], ['-123'], ['1.5'], ['１２３４'], ['12 34']])('«%s» no es válido', (entrada) => {
    expect(validarNumero(entrada)).toBeNull()
  })
})
