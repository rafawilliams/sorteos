/**
 * Conjuntos cerrados de valores de la API, como constantes que existen en tiempo de ejecución.
 * Los tipos de `types.ts` salen de aquí, y `literales.test.ts` comprueba los fixtures contra ellas:
 * `satisfies` por sí solo no puede, porque un JSON importado ensancha cada texto a `string`.
 */
export const CATEGORIAS = ['dominical', 'miercolito', 'gordito', 'extraordinario'] as const
export const PREMIOS = ['primero', 'segundo', 'tercero'] as const
export const METODOS = ['ml', 'estadistico', 'combinada'] as const
/** Cómo se calculó la decena recomendada (`decena_recommendation`): con 3 sorteos, con 2 o por frecuencia. */
export const METODOS_DECENA = ['triple', 'pair', 'frecuencia'] as const
/** Número de cifras de los premios que no son de 4 cifras: se indexan así en `Stats.formatos`. */
export const FORMATOS = ['2', '5'] as const

export type Categoria = (typeof CATEGORIAS)[number]
export type Premio = (typeof PREMIOS)[number]
export type Metodo = (typeof METODOS)[number]
export type MetodoDecena = (typeof METODOS_DECENA)[number]
export type Formato = (typeof FORMATOS)[number]
