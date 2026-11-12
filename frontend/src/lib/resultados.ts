// Lógica pura de la pestaña «Resultados» (spec frontend-react, T035). Equivale a `getFilteredSorteos`, `renderPagination`,
// `renderStatCounters` y `exportCSV` de static/app.js, sin DOM: se prueba aparte y la isla solo la dibuja.
import type { Sorteo } from '../api/types'

export const POR_PAGINA = 50

export interface Filtros {
  q: string
  cat: string
  desde: string
  hasta: string
}

export const SIN_FILTROS: Filtros = { q: '', cat: 'all', desde: '', hasta: '' }

/**
 * Los sorteos que pasan los filtros, en su orden. El texto se busca como subcadena en cualquiera de los tres premios
 * (recortado; solo espacios no filtra); las fechas ISO se comparan como texto y son inclusivas. Sin filtros devuelve la
 * misma lista (misma referencia), como `allSorteos` en app.js: así no se invalidan los memos de quien la use.
 */
export function filtrarSorteos(sorteos: Sorteo[], f: Filtros): Sorteo[] {
  let d = sorteos
  const q = f.q.trim()
  if (f.cat !== 'all') d = d.filter((s) => s.cat === f.cat)
  if (q) d = d.filter((s) => [s.primero, s.segundo, s.tercero].some((n) => (n || '').includes(q)))
  if (f.desde) d = d.filter((s) => s.fecha >= f.desde)
  if (f.hasta) d = d.filter((s) => s.fecha <= f.hasta)
  return d
}

export function totalPaginas(total: number): number {
  return Math.ceil(total / POR_PAGINA)
}

/** Las páginas que se enseñan alrededor de la actual (3 a cada lado) y si hay «…» antes o después. */
export function ventanaPaginas(actual: number, total: number): { desde: number; hasta: number; puntosAntes: boolean; puntosDespues: boolean } {
  const desde = Math.max(1, actual - 3)
  const hasta = Math.min(total, actual + 3)
  return { desde, hasta, puntosAntes: desde > 1, puntosDespues: hasta < total }
}

/** Las categorías que hay, en orden de primera aparición; un sorteo sin categoría no cuenta. */
export function categoriasDe(sorteos: Sorteo[]): string[] {
  return [...new Set(sorteos.map((s) => s.cat).filter(Boolean))]
}

/** Cuántos sorteos hay de cada categoría, en orden de primera aparición. */
export function contarPorCategoria(sorteos: Sorteo[]): Array<[string, number]> {
  const cuenta = new Map<string, number>()
  for (const s of sorteos) if (s.cat) cuenta.set(s.cat, (cuenta.get(s.cat) ?? 0) + 1)
  return [...cuenta.entries()]
}

/**
 * Una celda del CSV. Un valor con coma, comillas o salto de línea va entre comillas (con las comillas duplicadas) y uno
 * que empieza por `=`, `+`, `-`, `@`, tabulador o retorno lleva delante un apóstrofo para que una hoja de cálculo no lo
 * lea como fórmula. Los valores normales (cifras y letras) salen tal cual, sin rellenar ni cambiar nada.
 */
function celda(valor: unknown): string {
  let t = valor == null ? '' : String(valor)
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`
  return /[",\r\n]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t
}

/** El CSV de los sorteos dados: la cabecera de app.js y una fila por sorteo, cada una con su salto de línea. */
export function aCsv(sorteos: Sorteo[]): string {
  let csv = 'Fecha,Categoria,1er Premio,2do Premio,3er Premio,Letras,Serie,Folio\n'
  for (const s of sorteos) {
    csv += [s.fecha, s.cat, s.primero, s.segundo, s.tercero, s.letra, s.serie, s.folio].map(celda).join(',') + '\n'
  }
  return csv
}

/** `sorteos_panama_2026-11-12.csv`: la fecha ISO (UTC) del día, como `exportCSV`. */
export function nombreArchivoCsv(ahora: Date): string {
  return `sorteos_panama_${ahora.toISOString().slice(0, 10)}.csv`
}
