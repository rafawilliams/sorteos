import { afterEach, describe, expect, it, vi } from 'vitest'
import { CAT_LABELS, catClase, catLabel, fmtLift, formatDate, liftBar } from './formato'

// Reglas copiadas de static/app.js (plan §0 «Global constraints»): la migración no cambia lo que se ve.

describe('CAT_LABELS y catLabel', () => {
  it('tiene exactamente las cuatro categorías con sus etiquetas (sin variantes ni zodiaco)', () => {
    expect(CAT_LABELS).toEqual({
      dominical: 'Dominical',
      miercolito: 'Miercolito',
      gordito: 'Gordito del Zodiaco',
      extraordinario: 'Extraordinario',
    })
    expect(Object.keys(CAT_LABELS).sort()).toEqual(['dominical', 'extraordinario', 'gordito', 'miercolito'])
  })

  it('devuelve la etiqueta de cada categoría conocida', () => {
    expect(catLabel('gordito')).toBe('Gordito del Zodiaco')
    expect(catLabel('extraordinario')).toBe('Extraordinario')
  })

  it('una categoría desconocida lleva solo la primera letra en mayúscula', () => {
    expect(catLabel('zodiaco')).toBe('Zodiaco')
    expect(catLabel('otra cosa')).toBe('Otra cosa')
    expect(catLabel('')).toBe('')
  })

  it('no se confunde con propiedades heredadas del objeto (toString, constructor)', () => {
    expect(catLabel('toString')).toBe('ToString')
    expect(catLabel('constructor')).toBe('Constructor')
  })
})

describe('catClase', () => {
  it('pasa a minúsculas y deja solo letras, números, guion y guion bajo', () => {
    expect(catClase('Gordito Del Zodíaco!')).toBe('gorditodelzodaco')
    expect(catClase('a_b-c9')).toBe('a_b-c9')
  })

  it('un valor nulo o ausente da una cadena vacía', () => {
    expect(catClase(null)).toBe('')
    expect(catClase(undefined)).toBe('')
  })

  it('convierte cualquier valor a texto antes de limpiarlo', () => {
    expect(catClase(42)).toBe('42')
  })
})

describe('formatDate', () => {
  it('el entorno de pruebas corre en la zona horaria de Panamá (UTC-5), fijada en vite.config.ts', () => {
    // Sin una zona fija, las pruebas de fechas no detectarían una lectura en UTC cuando el CI corre en UTC.
    expect(new Date('2019-12-31T00:00:00Z').getDate()).toBe(30)
  })

  it('da el día, el mes abreviado y el año en español de Panamá', () => {
    expect(formatDate('2019-10-02')).toMatch(/^2 oct\.? 2019$/)
    expect(formatDate('2026-01-15')).toMatch(/^15 ene\.? 2026$/)
  })

  it('no cambia de día según la zona horaria (la fecha se lee como local)', () => {
    // Una fecha ISO sin hora se interpreta en UTC; con la zona de Panamá el 31 de diciembre pasaría al 30.
    expect(formatDate('2024-02-29')).toMatch(/^29 feb\.? 2024$/)
    expect(formatDate('2019-12-31')).toMatch(/^31 dic\.? 2019$/)
  })

  it('una fecha vacía o ausente se muestra como guion largo', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
    expect(formatDate('')).toBe('—')
  })
})

describe('formatDate: el día no cambia en ninguna zona horaria', () => {
  // La interfaz corre en el navegador de cada usuario, no solo en Panamá: la lectura local de la fecha debe ser
  // correcta con offsets negativos, positivos y cero. Sin esto una fecha escrita para Panamá (-05:00) pasaría.
  afterEach(() => vi.unstubAllEnvs())

  it.each([['Asia/Tokyo', -540], ['Pacific/Honolulu', 600], ['America/Panama', 300], ['UTC', 0], ['Pacific/Kiritimati', -840]])(
    'en %s (offset %i min) el 31 de diciembre sigue siendo 31 y el 1 de enero, 1',
    (zona, offset) => {
      vi.stubEnv('TZ', zona)
      expect(new Date(2019, 11, 31).getTimezoneOffset(), 'la zona no se aplicó: la prueba no probaría nada').toBe(offset)
      expect(formatDate('2019-12-31')).toMatch(/^31 dic\.? 2019$/)
      expect(formatDate('2020-01-01')).toMatch(/^1 ene\.? 2020$/)
    },
  )
})

describe('fmtLift', () => {
  it('muestra las veces sobre el azar con dos decimales', () => {
    expect(fmtLift(2.236)).toBe('×2.24 azar')
    expect(fmtLift(1)).toBe('×1.00 azar')
    expect(fmtLift(0)).toBe('×0.00 azar')
    expect(fmtLift(15)).toBe('×15.00 azar')
  })

  it('un valor nulo o ausente se muestra como guion largo', () => {
    expect(fmtLift(null)).toBe('—')
    expect(fmtLift(undefined)).toBe('—')
  })
})

describe('liftBar', () => {
  it('2× el azar llena la barra y el resto es proporcional', () => {
    expect(liftBar(2)).toBe(100)
    expect(liftBar(1)).toBe(50)
    expect(liftBar(0.5)).toBe(25)
  })

  it('no pasa del 100 %', () => {
    expect(liftBar(5)).toBe(100)
    expect(liftBar(15)).toBe(100)
  })

  it('un valor nulo, ausente o cero da una barra vacía', () => {
    expect(liftBar(null)).toBe(0)
    expect(liftBar(undefined)).toBe(0)
    expect(liftBar(0)).toBe(0)
  })
})
