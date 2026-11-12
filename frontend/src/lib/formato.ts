// Utilidades de formato de la interfaz (spec frontend-react, T012).
// Reglas copiadas de `static/app.js` (plan §0): migrar a React no cambia lo que se ve.
import type { Categoria } from '../api/types'

export const CAT_LABELS: Record<Categoria, string> = {
  dominical: 'Dominical',
  miercolito: 'Miercolito',
  gordito: 'Gordito del Zodiaco',
  extraordinario: 'Extraordinario',
}

/** Etiqueta de una categoría; una desconocida lleva solo su primera letra en mayúscula. */
export function catLabel(k: string): string {
  // Object.hasOwn: «toString» o «constructor» no son categorías (en el código viejo devolvían una función).
  if (Object.hasOwn(CAT_LABELS, k)) return CAT_LABELS[k as Categoria]
  return k.charAt(0).toUpperCase() + k.slice(1)
}

/** Clase CSS de una categoría: minúsculas y solo `[a-z0-9_-]`. */
export function catClase(k: unknown): string {
  return String(k ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
}

/** Fecha ISO (`YYYY-MM-DD`) como «2 oct 2019». Se lee como fecha local para que la zona horaria no cambie el día. */
export function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('es-PA', { year: 'numeric', month: 'short', day: 'numeric' })
}

/** «×2.24 azar»: las veces más probable que el azar (1 = azar). */
export function fmtLift(x: number | null | undefined): string {
  return x == null ? '—' : `×${Number(x).toFixed(2)} azar`
}

/** Relleno de la barra de lift en %: 2× el azar la llena. */
export function liftBar(x: number | null | undefined): number {
  return Math.min(((x || 0) / 2) * 100, 100)
}
