import { describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { PESTAÑAS, TEMAS, leerArgumentos } from './capturas.mjs'

describe('capturas: lista de pestañas y temas', () => {
  it('cubre las 14 pestañas de la barra principal, en su orden', () => {
    expect(PESTAÑAS).toEqual([
      'predicciones', 'decenas', 'terminaciones', 'resultados', 'estadisticas', 'tendencias', 'analisis',
      'comparador', 'gaps', 'simulador', 'favoritos', 'mensual', 'precision', 'seguimiento',
    ])
  })

  it('usa los nombres de tema que llevan los archivos (oscuro y claro)', () => {
    expect(TEMAS).toEqual({ oscuro: 'dark', claro: 'light' })
  })
})

describe('capturas: leerArgumentos', () => {
  it('con solo --salida usa el servidor local, todas las pestañas y los dos temas', () => {
    const o = leerArgumentos(['--salida', 'capturas'])
    expect(o.url).toBe('http://127.0.0.1:5000')
    expect(o.salida).toBe(resolve('capturas'))
    expect(o.pestañas).toHaveLength(14)
    expect(o.temas).toEqual(['oscuro', 'claro'])
  })

  it('acepta --url (sin barra final), --solo y --temas', () => {
    const o = leerArgumentos(['--salida', 'x', '--url', 'http://localhost:8000/', '--solo', 'gaps,seguimiento', '--temas', 'claro'])
    expect(o.url).toBe('http://localhost:8000')
    expect(o.pestañas).toEqual(['gaps', 'seguimiento'])
    expect(o.temas).toEqual(['claro'])
  })

  it('falla si falta --salida', () => {
    expect(() => leerArgumentos([])).toThrow('Falta --salida')
  })

  it('falla con una pestaña desconocida', () => {
    expect(() => leerArgumentos(['--salida', 'x', '--solo', 'gaps,inventada'])).toThrow('Pestaña desconocida: inventada')
  })

  it('falla con un tema desconocido', () => {
    expect(() => leerArgumentos(['--salida', 'x', '--temas', 'sepia'])).toThrow('Tema desconocido: sepia')
  })

  it('falla con una opción desconocida o sin valor', () => {
    expect(() => leerArgumentos(['--salida', 'x', '--rapido', 'si'])).toThrow('Opción desconocida: --rapido')
    expect(() => leerArgumentos(['--salida'])).toThrow('Falta el valor de --salida')
    expect(() => leerArgumentos(['--salida', '--url', 'http://x'])).toThrow('Falta el valor de --salida')
  })
})
