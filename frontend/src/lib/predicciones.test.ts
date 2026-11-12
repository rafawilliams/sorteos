import { describe, expect, it } from 'vitest'
import type { Sorteo } from '../api/types'
import { terminacionCaliente } from './predicciones'

const sorteo = (fecha: string, primero: string, segundo = '', tercero = ''): Sorteo => ({ id: fecha + primero, fecha, cat: 'dominical', primero, segundo, tercero, letra: '', serie: '', folio: '' })

describe('terminacionCaliente', () => {
  it('cuenta las dos últimas cifras de los tres premios de los sorteos del año', () => {
    const lista = [sorteo('2026-03-01', '1234', '0034', '5534'), sorteo('2026-02-01', '9999', '1234', '0000'), sorteo('2026-01-01', '7734', '', '')]
    expect(terminacionCaliente(lista, '2026')).toEqual({ ending: '34', count: 5 })
  })

  it('ignora los sorteos de otros años', () => {
    const lista = [sorteo('2025-12-31', '1234', '1234', '1234'), sorteo('2026-01-01', '0001', '', '')]
    expect(terminacionCaliente(lista, '2026')).toEqual({ ending: '01', count: 1 })
  })

  it('no mira el año por la mitad de la fecha: «2026» no vale para 12026', () => {
    expect(terminacionCaliente([sorteo('12026-01-01', '1234')], '2026')).toEqual({ ending: '00', count: 0 })
  })

  it('el año se compara entero: «202» no es el prefijo del año 2026', () => {
    expect(terminacionCaliente([sorteo('2026-01-01', '1234')], '202')).toEqual({ ending: '00', count: 0 })
  })

  it('sin sorteos del año devuelve «00» con cuenta 0', () => {
    expect(terminacionCaliente([], '2026')).toEqual({ ending: '00', count: 0 })
    expect(terminacionCaliente([sorteo('2024-05-05', '1234')], '2026')).toEqual({ ending: '00', count: 0 })
  })

  it('un sorteo sin fecha no cuenta y un premio vacío tampoco', () => {
    const sinFecha = { ...sorteo('2026-01-01', '1234'), fecha: '' }
    expect(terminacionCaliente([sinFecha, sorteo('2026-01-02', '', '', '')], '2026')).toEqual({ ending: '00', count: 0 })
  })

  it('usa las dos últimas cifras de premios de 2 y de 5 cifras', () => {
    const lista = [sorteo('2026-01-01', '05309', '98', '0074')]
    // 05309 → «09», 98 → «98», 0074 → «74»: empatan a 1 y, por el orden de un objeto, gana la entera más baja
    expect(terminacionCaliente(lista, '2026')).toEqual({ ending: '74', count: 1 })
    expect(terminacionCaliente([sorteo('2026-01-01', '', '98', '98')], '2026')).toEqual({ ending: '98', count: 2 })
  })

  it('en un empate gana la primera en el orden de un objeto de JavaScript: los números enteros (10 a 99) van antes que «05»', () => {
    // El código antiguo contaba en un objeto: las claves enteras se recorren en orden ascendente y las demás en orden de
    // inserción. Se conserva para que la terminación caliente sea idéntica a la de antes.
    const lista = [sorteo('2026-01-01', '0005', '0012', '')]
    expect(terminacionCaliente(lista, '2026')).toEqual({ ending: '12', count: 1 })
  })

  it('entre claves no enteras gana la primera que aparece', () => {
    const lista = [sorteo('2026-01-01', '0005', '0007', '')]
    expect(terminacionCaliente(lista, '2026')).toEqual({ ending: '05', count: 1 })
  })

  it('un empate se resuelve a favor de la que ya iba por delante, no de la última', () => {
    const lista = [sorteo('2026-01-01', '0034', '0034', '0056'), sorteo('2026-01-02', '0056', '', '')]
    expect(terminacionCaliente(lista, '2026')).toEqual({ ending: '34', count: 2 })
  })
})
