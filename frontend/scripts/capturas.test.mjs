import { describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { CSS_CAPTURA, PESTAÑAS, TEMAS, comprobarBase, leerArgumentos } from './capturas.mjs'

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
    expect(o.url).toBe('http://127.0.0.1:5001')
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

describe('capturas: --sorteos (guarda de la base sembrada)', () => {
  it('espera 600 sorteos por defecto y acepta otro número', () => {
    expect(leerArgumentos(['--salida', 'x']).sorteos).toBe(600)
    expect(leerArgumentos(['--salida', 'x', '--sorteos', '120']).sorteos).toBe(120)
  })

  it('falla si --sorteos no es un entero', () => {
    expect(() => leerArgumentos(['--salida', 'x', '--sorteos', 'abc'])).toThrow('Valor no válido para --sorteos')
    expect(() => leerArgumentos(['--salida', 'x', '--sorteos', '-5'])).toThrow('Valor no válido para --sorteos')
  })

  it('rechaza claves heredadas del prototipo como opciones', () => {
    expect(() => leerArgumentos(['--salida', 'x', '--toString', 'y'])).toThrow('Opción desconocida: --toString')
  })
})

const respuesta = (total, ok = true, status = 200) => async () => ({ ok, status, json: async () => ({ total }) })

describe('capturas: comprobarBase', () => {
  it('acepta un servidor que sirve exactamente los sorteos esperados', async () => {
    await expect(comprobarBase('http://127.0.0.1:5001', 600, respuesta(600))).resolves.toBe(600)
  })

  it('rechaza un servidor con más sorteos (la base real) y lo dice', async () => {
    await expect(comprobarBase('http://127.0.0.1:5000', 600, respuesta(9296))).rejects.toThrow(/9296.*600.*sembrada/s)
  })

  it('rechaza un servidor con menos sorteos de los esperados', async () => {
    await expect(comprobarBase('http://x', 600, respuesta(10))).rejects.toThrow('sirve 10 sorteos')
  })

  it('falla con un mensaje claro si el servidor responde con error', async () => {
    await expect(comprobarBase('http://x', 600, respuesta(0, false, 500))).rejects.toThrow('No se pudo comprobar la base')
  })

  it('falla con un mensaje claro si no hay servidor', async () => {
    const sinServidor = async () => { throw new Error('ECONNREFUSED') }
    await expect(comprobarBase('http://x', 600, sinServidor)).rejects.toThrow(/No se pudo comprobar.*ECONNREFUSED/s)
  })

  it('pide la primera página con un solo sorteo (no lee la base entera)', async () => {
    const llamadas = []
    await comprobarBase('http://x:1', 3, async (url) => { llamadas.push(url); return { ok: true, json: async () => ({ total: 3 }) } })
    expect(llamadas).toEqual(['http://x:1/api/sorteos?page=1&per_page=1'])
  })
})

describe('capturas: estilos inyectados', () => {
  it('fuerza visibles las tarjetas .reveal, que en la página aparecen al hacer scroll', () => {
    expect(CSS_CAPTURA).toMatch(/\.reveal\s*\{[^}]*opacity:\s*1\s*!important/)
    expect(CSS_CAPTURA).toMatch(/\.reveal\s*\{[^}]*transform:\s*none\s*!important/)
  })

  it('mantiene sin animaciones ni transiciones', () => {
    expect(CSS_CAPTURA).toMatch(/animation:\s*none\s*!important/)
    expect(CSS_CAPTURA).toMatch(/transition:\s*none\s*!important/)
  })
})

