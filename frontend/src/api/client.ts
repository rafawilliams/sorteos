/**
 * Cliente de la API (spec frontend-react, T011): una función por endpoint con retorno tipado.
 *
 * Los mensajes de error son SIEMPRE opacos: `'Error de conexión'` (red caída o cuerpo ilegible) o
 * `'Error del servidor'` (respuesta de error). Nunca se muestra el texto de una excepción ni una traza. La única
 * excepción son los `error` públicos que el propio servidor redacta para el usuario: los 400 de `/api/comparar` y
 * `/api/simulador` y las respuestas de `/api/actualizar`.
 *
 * Un 500 de `/api/stats`, `/api/gaps` o `/api/backtesting` y un 429 del limitador no son JSON (HTML de Flask):
 * por eso se mira `res.ok` antes de fiarse del cuerpo.
 */
import type { Backtesting, Comparacion, Gaps, Seguimiento, Simulacion } from './types'

export type Result<T> = { ok: true; data: T } | { ok: false; mensaje: string }
export type SimParams = { numero: string; cat?: string; from?: string; to?: string }
export interface ResultadoActualizar {
  status: number
  ok: boolean
  mensaje?: string
  ml_retrained?: boolean
}

export const MENSAJE_RED = 'Error de conexión'
export const MENSAJE_SERVIDOR = 'Error del servidor'

const LARGO_MAXIMO_ERROR_PUBLICO = 200

/** El `error` del servidor si es un texto razonable; si no, `undefined` (y se usa el genérico). */
function errorPublico(cuerpo: unknown): string | undefined {
  if (typeof cuerpo !== 'object' || cuerpo === null) return undefined
  const { error } = cuerpo as { error?: unknown }
  return typeof error === 'string' && error !== '' && error.length <= LARGO_MAXIMO_ERROR_PUBLICO ? error : undefined
}

/** `publico`: el endpoint redacta sus `error` para el usuario, así que se pueden mostrar. */
async function pedir<T>(ruta: string, publico = false): Promise<Result<T>> {
  let res: Response
  try {
    res = await fetch(ruta)
  } catch {
    return { ok: false, mensaje: MENSAJE_RED }
  }
  let cuerpo: unknown
  try {
    cuerpo = await res.json()
  } catch {
    return { ok: false, mensaje: res.ok ? MENSAJE_RED : MENSAJE_SERVIDOR }
  }
  const propio = publico ? errorPublico(cuerpo) : undefined
  if (!res.ok) return { ok: false, mensaje: propio ?? MENSAJE_SERVIDOR }
  if (typeof cuerpo !== 'object' || cuerpo === null) return { ok: false, mensaje: MENSAJE_SERVIDOR }
  if (propio !== undefined) return { ok: false, mensaje: propio } // un 200 con `error`, como comprobaba app.js
  return { ok: true, data: cuerpo as T }
}

export function getGaps(): Promise<Result<Gaps>> {
  return pedir('/api/gaps')
}

export function getSeguimiento(): Promise<Result<Seguimiento>> {
  return pedir('/api/seguimiento')
}

export function getBacktesting(lastN: number): Promise<Result<Backtesting>> {
  return pedir(`/api/backtesting?last_n=${Math.trunc(lastN)}`)
}

export function comparar(numeros: string[]): Promise<Result<Comparacion>> {
  return pedir(`/api/comparar?numeros=${numeros.map(encodeURIComponent).join(',')}`, true)
}

export function simular({ numero, cat, from, to }: SimParams): Promise<Result<Simulacion>> {
  let ruta = `/api/simulador?numero=${encodeURIComponent(numero)}`
  if (cat) ruta += `&cat=${encodeURIComponent(cat)}`
  if (from) ruta += `&from=${encodeURIComponent(from)}`
  if (to) ruta += `&to=${encodeURIComponent(to)}`
  return pedir(ruta, true)
}

/** POST con el token en la cabecera. Devuelve el estado HTTP (0 si no hubo respuesta) para que el botón distinga 401, 502, 503… */
export async function actualizar(token: string): Promise<ResultadoActualizar> {
  let res: Response
  try {
    res = await fetch('/api/actualizar', { method: 'POST', headers: { 'X-Update-Token': token } })
  } catch {
    return { status: 0, ok: false, mensaje: MENSAJE_RED }
  }
  let cuerpo: unknown
  try {
    cuerpo = await res.json()
  } catch {
    return { status: res.status, ok: false, mensaje: res.ok ? MENSAJE_RED : MENSAJE_SERVIDOR }
  }
  const datos = typeof cuerpo === 'object' && cuerpo !== null ? (cuerpo as { ok?: unknown; ml_retrained?: unknown }) : {}
  if (res.ok && datos.ok === true) {
    return typeof datos.ml_retrained === 'boolean' ? { status: res.status, ok: true, ml_retrained: datos.ml_retrained } : { status: res.status, ok: true }
  }
  return { status: res.status, ok: false, mensaje: errorPublico(cuerpo) ?? MENSAJE_SERVIDOR }
}
