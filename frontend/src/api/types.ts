/**
 * Tipos de las respuestas de la API (spec frontend-react, T010).
 *
 * Contrato en tres eslabones: el backend produce la respuesta → `frontend/fixtures/*.json` la guarda
 * (`tests/gen_fixtures_front.py`, comprobada contra la API por `tests/test_contrato_front.py`) → estos
 * tipos la describen (`fixtures.check.ts` los comprueba con `tsc`). Se escriben a mano: si se generaran
 * desde los fixtures, la comprobación pasaría siempre.
 *
 * Donde los fixtures no llegan (listas siempre vacías en la base sembrada, campos que solo faltan sin
 * modelo entrenado) el tipo sigue el código del backend, y así se indica. Un campo que el backend omite o
 * devuelve vacío según los datos es opcional o admite `ObjetoVacio`: tiparlo como siempre presente haría
 * que el front lo diera por seguro y fallara en ejecución sin que `tsc` avisara.
 *
 * Límite de la comprobación contra los fixtures (`fixtures.check.ts`): detecta campos que faltan, que
 * sobran y de distinto tipo, pero no ve si un campo obligatorio pasa a opcional, ni que un `number` pase a
 * `number | null`, ni valores concretos: eso lo cubren la lectura del backend y `literales.test.ts`.
 */
import type { Categoria, Formato, Metodo, MetodoDecena, Premio } from './constantes'

export type { Categoria, Formato, Metodo, MetodoDecena, Premio } from './constantes'

/** Conteos por clave de dato: dígito (`"0"`…`"9"`), terminación (`"00"`…`"99"`), mes (`"2019-10"`, `"Oct"`). */
export type Frecuencia = Record<string, number>

/** Un diccionario sin claves, que la API devuelve cuando no hay nada que contar (p. ej. `ml` sin modelo). */
export type ObjetoVacio = Record<string, never>

// ---------------------------------------------------------------------------
// /api/sorteos
// ---------------------------------------------------------------------------

/**
 * Un sorteo. Los premios llegan tal como los publica la fuente: `"98"`, `"0074"`, `"05309"` o `""`.
 * Nunca se rellenan con ceros (principio 7 de la constitución).
 */
export interface Sorteo {
  id: string
  fecha: string // ISO 8601, YYYY-MM-DD
  cat: Categoria
  primero: string
  segundo: string
  tercero: string
  letra: string
  serie: string
  folio: string
}

export interface SorteosRespuesta {
  data: Sorteo[]
  last_update: string
  page: number
  per_page: number
  total: number
}

// ---------------------------------------------------------------------------
// /api/stats
// ---------------------------------------------------------------------------

export interface NumeroConteo {
  number: string
  count: number
}

export interface TerminacionConteo {
  ending: string
  count: number
}

export interface ValorConteo {
  value: string
  count: number
}

export interface CalienteFrio<T> {
  hot: T[]
  cold: T[]
}

/** Recomendación estadística de un número. `confidence` = veces más probable que el azar (1 = azar, tope 15). */
export interface RecomendacionNumero {
  number: string
  score: number
  confidence: number
  lift: number
  veces: number
}

export interface RecomendacionNumeroMl {
  number: string
  score: number
  confidence: number
}

export interface RecomendacionTerminacion {
  ending: string
  score: number
  confidence: number
  lift: number
}

/** Comprobación hacia atrás de la decena recomendada; `null` en `DecenaCategoria` con menos de 230 sorteos. */
export interface BacktestDecena {
  acierto_pct: number
  acierto_pct_azar: number
  aciertos: number
  sorteos: number
}

/** Comprobación hacia atrás de las terminaciones; `null` con menos de 230 sorteos. */
export interface BacktestTerminaciones {
  aciertos: number
  aciertos_azar: number
  alguna_pct: number
  alguna_pct_azar: number
  sorteos: number
}

export interface EstadisticasCategoria {
  digit_frequency: Frecuencia
  hot_cold: CalienteFrio<NumeroConteo>
  ml_recommendations: RecomendacionNumeroMl[]
  recommendations: RecomendacionNumero[]
  total: number
}

export interface DecenaCategoria {
  backtest: BacktestDecena | null
  confidence: number
  follower_distribution: Frecuencia
  last_3: string[]
  last_3_fechas: string[]
  lift: number
  match_count: number
  method: MetodoDecena
  minimo: number
  muestras: number
  recommended: string
}

export interface TerminacionesCategoria {
  backtest: BacktestTerminaciones | null
  ml_recommendations: RecomendacionTerminacion[]
  recommendations: RecomendacionTerminacion[]
  total_endings: number
}

export interface EstadisticasPremio {
  digit_frequency: Frecuencia
  hot_cold: CalienteFrio<NumeroConteo>
  last_digit_pairs: Frecuencia
  position_frequency: Frecuencia[]
  recommendations: RecomendacionNumero[]
}

/** Estadísticas de los premios que no son de 4 cifras. Se indexan por número de cifras: `"2"` y `"5"`. */
export interface FormatoPremio {
  by_category: Partial<Record<Categoria, number>>
  by_prize: Partial<Record<Premio, number>>
  date_range: { from: string; to: string } | null
  digit_frequency: Frecuencia
  hot_cold: CalienteFrio<NumeroConteo>
  position_frequency: Frecuencia[]
  total: number
}

export interface PerfilMensual {
  draws: number
  hot: NumeroConteo[]
  month: number
  name: string
  numbers: number
  position_freq: Frecuencia[]
  top_endings: TerminacionConteo[]
}

export interface Stats {
  /** Solo las categorías con premios de 4 cifras: sin ellos (el extraordinario) la clave no está. */
  by_category: Partial<Record<Categoria, EstadisticasCategoria>>
  /** Solo las categorías con datos suficientes: `decena_recommendation` devuelve `None` si no los hay. */
  decena_recomendada: Partial<Record<Categoria, DecenaCategoria>>
  digit_frequency: Frecuencia
  endings: {
    by_prize: Record<Premio, TerminacionConteo[]>
    frequency: Frecuencia
    hot_cold: CalienteFrio<TerminacionConteo>
    recommendations: RecomendacionTerminacion[]
    total_endings: number
    trends: Array<{ endings: Frecuencia; month: string }>
  }
  /** Solo las categorías que tienen terminaciones. */
  endings_by_category: Partial<Record<Categoria, TerminacionesCategoria>>
  formatos: Partial<Record<Formato, FormatoPremio>>
  hot_cold: CalienteFrio<NumeroConteo>
  last_digit_pairs: Frecuencia
  last_update: string
  letras: Array<{ letra: string; count: number }>
  ml_endings: RecomendacionTerminacion[]
  /** Sin modelo entrenado el backend devuelve `trained: false` con `train_date` y `train_samples` nulos. */
  ml_info: {
    model_type: string
    train_date: string | null
    train_samples: number | null
    trained: boolean
    /** Solo si el modelo entrenado expone importancias (HistGradientBoosting hoy no): top 5 por posición. */
    feature_importances?: Record<string, Array<{ feature: string; importance: number }>>
  }
  /** Vacío (`{}`) con el modelo sin entrenar o con menos de 50 filas de entrenamiento. */
  ml_prizes: Partial<Record<Premio, RecomendacionNumeroMl[]>>
  ml_recommendations: RecomendacionNumeroMl[]
  monthly_reco: {
    digit_advantage: Frecuencia[]
    monthly_profiles: PerfilMensual[]
    recommendations: RecomendacionNumero[]
    target_draws_historical: number
    target_month: number
    target_month_name: string
    target_numbers_historical: number
    target_year: number
  }
  position_frequency: Frecuencia[]
  /** Cada premio es `{}` si no hay premios de 4 cifras de ese tipo (`_prize_stats`). */
  prizes: Record<Premio, EstadisticasPremio | ObjetoVacio>
  reco_from: string
  reco_sorteos: number
  recommendations: RecomendacionNumero[]
  series_folio: { folios: ValorConteo[]; series: ValorConteo[] }
  total_sorteos: number
  trends: Array<{ digits: Frecuencia; month: string; sorteos: number }>
}

// ---------------------------------------------------------------------------
// /api/seguimiento
// ---------------------------------------------------------------------------

/** Lo congelado para un método antes de que ocurra el sorteo. */
export interface MetodoPendiente {
  numeros: string[]
  terminaciones: string[]
}

/**
 * Lo congelado y lo que pasó. Sin premio de 4 cifras (extraordinario) las métricas de números no aplican y
 * valen `null` (`seguimiento.comparar`).
 */
export interface MetodoComparado extends MetodoPendiente {
  exactos: number | null
  numeros_acertados: string[]
  terminacion_numeros: number | null
  digitos_media: number | null
  terminaciones_aciertos: number
  terminaciones_acertadas: string[]
  alguna_terminacion: boolean
}

/** Valores esperados por puro azar para ese sorteo. */
export interface AzarComparado {
  exactos: number
  terminacion_numeros: number
  digitos_media: number | null
  terminaciones_aciertos: number
  alguna_terminacion: number
}

/** Sin modelo entrenado falta `ml` en `metodos`. `peso_ml` es `null` si no se congeló la combinada. */
export interface RegistroComparado {
  azar: AzarComparado
  categoria: Categoria
  metodos: Partial<Record<Metodo, MetodoComparado>>
  peso_ml: number | null
  registrado_en: string
  sorteo: Sorteo
}

export interface RegistroPendiente {
  categoria: Categoria
  metodos: Partial<Record<Metodo, MetodoPendiente>>
  /** `false` si la categoría no tiene premios de 4 cifras: sus números no se pueden acertar. */
  numeros_aplican: boolean
  peso_ml: number | null
  registrado_en: string
  ultima_fecha: string
}

export interface Marcador {
  alguna_terminacion_pct: number | null
  alguna_terminacion_pct_azar: number | null
  digitos_media: number | null
  digitos_media_azar: number
  exactos: number
  exactos_azar: number
  sorteos: number
  sorteos_numeros: number
  terminacion_numeros: number
  terminacion_numeros_azar: number
  terminaciones_media: number | null
  terminaciones_media_azar: number | null
}

export interface Seguimiento {
  comparados: RegistroComparado[]
  comparados_para_peso: number
  marcador: Record<Metodo, Marcador>
  minimo_peso: number
  pendientes: RegistroPendiente[]
  peso_ml: number
  sin_registro: Sorteo[]
  ventana_peso: number
}

// ---------------------------------------------------------------------------
// /api/gaps
// ---------------------------------------------------------------------------

export interface GapNumero {
  number: string
  gap: number
  avg_gap: number
  ratio: number
  count: number
}

export interface GapTerminacion {
  ending: string
  gap: number
  avg_gap: number
  ratio: number
  count: number
}

export interface Gaps {
  ontime_endings: GapTerminacion[]
  ontime_numbers: GapNumero[]
  overdue_endings: GapTerminacion[]
  overdue_numbers: GapNumero[]
  total_sorteos: number
}

// ---------------------------------------------------------------------------
// /api/backtesting
// ---------------------------------------------------------------------------

export interface PorPosicion {
  avg_prob_actual: number
  lift_top1: number
  position: number
  random_baseline_top1: number
  random_baseline_top3: number
  top1_accuracy: number
  top3_accuracy: number
}

export interface BacktestMl {
  avg_lift_top1: number
  avg_top1_accuracy: number
  avg_top3_accuracy: number
  ending_random_top10: number
  ending_random_top5: number
  ending_top10_hit_rate: number
  ending_top5_hit_rate: number
  per_position: PorPosicion[]
  rolling_accuracy: Array<{ count: number; month: string; top1_avg: number; top3_avg: number }>
  total_evaluated: number
}

export interface BacktestEstadistico {
  avg_lift_top1: number
  avg_top1_accuracy: number
  avg_top3_accuracy: number
  per_position: PorPosicion[]
  total_evaluated: number
}

export interface Backtesting {
  /**
   * `comparison.best_method` sale «ML» aunque `ml` esté vacío (el backend toma 10 % por defecto): no es una
   * conclusión que mostrar sin comprobar `ml`.
   */
  comparison: { best_method: string; ml_better: boolean; ml_lift: number; stat_lift: number }
  /** Vacío si el modelo no está entrenado o hay pocos sorteos. */
  ml: BacktestMl | ObjetoVacio
  /** Vacío con menos de 100 primeros premios de 4 cifras. */
  statistical: BacktestEstadistico | ObjetoVacio
}

// ---------------------------------------------------------------------------
// /api/comparar y /api/simulador
// ---------------------------------------------------------------------------

export interface ComparacionNumero {
  best_month: string
  best_month_count: number
  digits: string[]
  ending_matches: number
  exact: Record<Premio, number>
  frequency_pct: number
  gap: number | null
  last_appearance: string | null
  monthly: Record<string, number>
  number: string
  total_exact: number
}

export interface Comparacion {
  numbers: ComparacionNumero[]
  total_sorteos: number
}

export interface Simulacion {
  by_category: Partial<Record<Categoria, number>>
  date_range: { from: string; to: string }
  ending: { frequency_pct: number; primero: number; segundo: number; tercero: number; total: number }
  exact: {
    frequency_pct: number
    gap_draws: number | null
    last_appearance: string | null
    /** `tipo` viene siempre vacío: el backend lo busca en un campo del sorteo que no existe. */
    matches: Array<{ cat: Categoria; fecha: string; tipo: string }>
    primero: number
    segundo: number
    tercero: number
    total: number
  }
  monthly_distribution: Record<string, number>
  numero: string
  terminacion: string
  total_sorteos: number
}

// ---------------------------------------------------------------------------
// POST /api/actualizar y errores (sin fixture: se tipan leyendo app.py)
// ---------------------------------------------------------------------------

export interface ActualizarOk {
  ok: true
  output: string
  ml_retrained: boolean
  seguimiento_registrado: Categoria[]
  last_update: string
}

/** 401 (`auth_required`), 502, 503, 504 y 500: el mensaje es siempre genérico, sin trazas. */
export interface ActualizarError {
  ok: false
  error: string
  auth_required?: boolean
}

export type ActualizarRespuesta = ActualizarOk | ActualizarError

/**
 * Cuerpo de error en JSON. Solo lo devuelven `/api/comparar` y `/api/simulador` (400) y `/api/seguimiento` (500).
 * Un 500 de `/api/stats`, `/api/gaps` o `/api/backtesting` y un 429 del limitador de peticiones NO son JSON
 * (HTML de Flask): comprobar `respuesta.ok` antes de llamar a `.json()`.
 */
export interface ErrorApi {
  error: string
}
