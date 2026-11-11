import { describe, expect, it } from 'vitest'

/**
 * Principio 7 de la constitución: un premio se muestra tal como llega, nunca rellenado con ceros.
 * Única excepción: el número que teclea el usuario en el Simulador (`lib/numeroSimulador.ts`).
 * Esta prueba busca el relleno en el código fuente de la interfaz (spec frontend-react, plan §0).
 */
const PERMITIDO = './lib/numeroSimulador.ts'
const ESTE_ARCHIVO = './sin-relleno.test.ts'
// El patrón se arma por partes para que este archivo no se detecte a sí mismo.
const RELLENO = new RegExp('pad' + 'Start|pad' + 'End|z' + 'fill')

// Vite lee todos los fuentes de `src` como texto: no hace falta el sistema de archivos ni tipos de Node.
const fuentes = import.meta.glob('./**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

describe('sin relleno de ceros en la interfaz', () => {
  const vigilados = Object.entries(fuentes).filter(([ruta]) => ruta !== PERMITIDO && ruta !== ESTE_ARCHIVO)

  it('hay archivos que vigilar', () => {
    expect(vigilados.length).toBeGreaterThan(3)
  })

  it('ningún archivo de frontend/src usa relleno, salvo el del número del Simulador', () => {
    const culpables = vigilados.filter(([, texto]) => RELLENO.test(texto)).map(([ruta]) => ruta)
    expect(culpables).toEqual([])
  })

  it('el patrón detecta de verdad el relleno (no pasa en vacío)', () => {
    expect(RELLENO.test('x.' + 'pad' + 'Start(4, "0")')).toBe(true)
    expect(RELLENO.test('s.z' + 'fill(4)')).toBe(true)
    expect(RELLENO.test('const premio = "98"')).toBe(false)
  })
})
