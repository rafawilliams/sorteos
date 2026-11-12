// Lógica pura de la isla Predicciones (spec frontend-react, T043). Equivale a la IIFE `hotDecena` de `renderDashboard`
// de static/app.js.
import type { Sorteo } from '../api/types'

/**
 * La terminación (dos últimas cifras) más repetida en los tres premios de los sorteos del año `anio` (`"2026"`).
 * Sin ninguna devuelve `{ ending: '00', count: 0 }`.
 *
 * Cuenta en un objeto plano y lo recorre con `Object.entries`, como el código antiguo: ante un empate gana la primera
 * en ese recorrido, y JavaScript recorre primero las claves enteras en orden ascendente (`'12'`) y después las demás en
 * orden de inserción (`'05'`). No se cambia para que la terminación caliente sea idéntica a la de antes.
 */
export function terminacionCaliente(sorteos: Sorteo[], anio: string): { ending: string; count: number } {
  const cuenta: Record<string, number> = {}
  for (const s of sorteos) {
    if (!s.fecha || !s.fecha.startsWith(`${anio}-`)) continue
    for (const premio of [s.primero, s.segundo, s.tercero]) {
      const n = premio || ''
      if (!n) continue
      const terminacion = n.slice(-2)
      cuenta[terminacion] = (cuenta[terminacion] || 0) + 1
    }
  }
  let mejor = '00'
  let mejorCuenta = 0
  for (const [terminacion, c] of Object.entries(cuenta)) {
    if (c > mejorCuenta) {
      mejorCuenta = c
      mejor = terminacion
    }
  }
  return { ending: mejor, count: mejorCuenta }
}
