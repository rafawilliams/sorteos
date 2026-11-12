// Lógica pura de «Mis Números» (spec frontend-react, T023): lectura y escritura tolerantes de `lp_favorites`, alta y
// baja, y las coincidencias con los resultados recientes. Equivale a `getFavorites`/`addFavorite`/`renderFavorites`/
// `updateFavBadge` de static/app.js, sin tocar el DOM.
import type { Sorteo } from '../api/types'
import { validarNumero } from './numeroSimulador'

export const CLAVE_FAVORITOS = 'lp_favorites'

export interface Aparicion {
  fecha: string
  cat: string
  /** `1ro`/`2do`/`3ro` si salió el número entero; `Term 1ro`… si solo coincide la terminación (últimos 2 dígitos). */
  prizes: string[]
}

export type ResultadoAgregar = { ok: true; numero: string; lista: string[] } | { ok: false; motivo: 'invalido' | 'repetido'; numero?: string }

const PREMIOS = [
  ['primero', '1ro'],
  ['segundo', '2do'],
  ['tercero', '3ro'],
] as const

/** Los 20 sorteos más recientes cuentan como «recientes» en la lista; los 5 más recientes, en la insignia. */
const VENTANA_LISTA = 20
const VENTANA_INSIGNIA = 5

/**
 * La lista guardada. Tolerante: JSON roto, algo que no es una lista, entradas que no son un número de 4 cifras,
 * repetidos o un almacenamiento que lanza (modo privado) dan una lista válida en vez de romper la pestaña.
 */
export function leerFavoritos(almacen: Pick<Storage, 'getItem'> = localStorage): string[] {
  try {
    const valor: unknown = JSON.parse(almacen.getItem(CLAVE_FAVORITOS) || '[]')
    if (!Array.isArray(valor)) return []
    const limpios = valor.filter((n): n is string => typeof n === 'string' && /^[0-9]{4}$/.test(n))
    return [...new Set(limpios)]
  } catch {
    return []
  }
}

/** `false` si no se pudo guardar (cuota, modo privado): la lista sigue viva en memoria hasta recargar. */
export function guardarFavoritos(lista: string[], almacen: Pick<Storage, 'setItem'> = localStorage): boolean {
  try {
    almacen.setItem(CLAVE_FAVORITOS, JSON.stringify(lista))
    return true
  } catch {
    return false
  }
}

export function agregarFavorito(lista: string[], texto: string): ResultadoAgregar {
  const numero = validarNumero(texto)
  if (numero === null) return { ok: false, motivo: 'invalido' }
  if (lista.includes(numero)) return { ok: false, motivo: 'repetido', numero }
  return { ok: true, numero, lista: [...lista, numero] }
}

export function quitarFavorito(lista: string[], numero: string): string[] {
  return lista.filter((n) => n !== numero)
}

/** En qué premios de los sorteos recientes salió el número. `sorteos` viene del más reciente al más antiguo. */
export function apariciones(numero: string, sorteos: Sorteo[]): Aparicion[] {
  const terminacion = numero.slice(-2)
  const resultado: Aparicion[] = []
  for (const s of sorteos.slice(0, VENTANA_LISTA)) {
    const exactos = PREMIOS.filter(([campo]) => s[campo] && s[campo] === numero).map(([, etiqueta]) => etiqueta)
    // Los premios llegan con su formato real (2, 4 o 5 cifras): se compara la terminación tal cual, sin rellenar.
    const prizes = exactos.length
      ? exactos
      : PREMIOS.filter(([campo]) => s[campo] && s[campo].slice(-2) === terminacion).map(([, etiqueta]) => `Term ${etiqueta}`)
    if (prizes.length) resultado.push({ fecha: s.fecha, cat: s.cat, prizes })
  }
  return resultado
}

/** Aciertos exactos de todos los favoritos en los 5 sorteos más recientes: el número de la insignia de la pestaña. */
export function contarAlertas(lista: string[], sorteos: Sorteo[]): number {
  let alertas = 0
  for (const numero of lista) {
    for (const s of sorteos.slice(0, VENTANA_INSIGNIA)) {
      for (const [campo] of PREMIOS) if (s[campo] && s[campo] === numero) alertas += 1
    }
  }
  return alertas
}
