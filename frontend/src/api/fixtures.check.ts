/**
 * Comprobación en tiempo de compilación de que los tipos de `types.ts` describen los fixtures
 * (spec frontend-react, T010, criterio AC6). No se ejecuta: solo tiene que compilar con `npm run typecheck`.
 *
 * Dos comprobaciones por fixture:
 *  1. `satisfies Ensanchar<Tipo>`: el fixture tiene todos los campos del tipo, con el tipo de valor correcto.
 *  2. `Cubre<Tipo, typeof fixture>`: el tipo declara todos los campos que tiene el fixture. `satisfies` no lo
 *     ve (un JSON importado no pasa por la comprobación de propiedades de más), y sin esto un campo nuevo
 *     de la API que el tipo no conoce pasaría inadvertido.
 */
import backtesting from '../../fixtures/backtesting.json'
import backtestingSinModelo from '../../fixtures/backtesting_sin_modelo.json'
import comparar from '../../fixtures/comparar.json'
import compararSinApariciones from '../../fixtures/comparar_sin_apariciones.json'
import gaps from '../../fixtures/gaps.json'
import gapsConNumeros from '../../fixtures/gaps_con_numeros.json'
import seguimiento from '../../fixtures/seguimiento.json'
import seguimientoVacio from '../../fixtures/seguimiento_vacio.json'
import simulador from '../../fixtures/simulador.json'
import simuladorSinAciertos from '../../fixtures/simulador_sin_aciertos.json'
import sorteos from '../../fixtures/sorteos.json'
import stats from '../../fixtures/stats.json'
import statsConBacktests from '../../fixtures/stats_con_backtests.json'
import statsFormatosReales from '../../fixtures/stats_formatos_reales.json'
import statsPocosSorteos from '../../fixtures/stats_pocos_sorteos.json'
import type {
  Backtesting,
  Comparacion,
  Gaps,
  Seguimiento,
  Simulacion,
  SorteosRespuesta,
  Stats,
} from './types'

/**
 * Cambia cada texto literal por `string` (un JSON importado ensancha `"dominical"` a `string`) y admite
 * `undefined` en los valores de un diccionario: al inferir una lista de objetos con claves distintas,
 * TypeScript añade `clave?: undefined` a los demás elementos, algo que el JSON real no tiene.
 */
type Ensanchar<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? Ensanchar<U>[]
    : T extends object
      ? string extends keyof T
        ? { [clave: string]: Ensanchar<T[string]> | undefined }
        : { [K in keyof T]: Ensanchar<T[K]> }
      : T

type Todos<U> = false extends U ? false : true

type CubreUno<T, F> = F extends readonly (infer FE)[]
  ? T extends readonly (infer TE)[]
    ? Cubre<TE, FE>
    : false
  : F extends object
    ? T extends object
      ? Todos<{ [K in keyof F]: K extends keyof T ? Cubre<T[K], F[K]> : false }[keyof F]>
      : false
    : true

/** `true` si alguna variante de `T` declara todas las claves que tiene `F`, a cualquier profundidad. */
export type Cubre<T, F> = [F] extends [never] ? true : true extends (T extends unknown ? CubreUno<T, F> : never) ? true : false

type Verdadero<T extends true> = T

// 1. El fixture cumple el tipo.
export const cumplen = [
  sorteos satisfies Ensanchar<SorteosRespuesta>,
  stats satisfies Ensanchar<Stats>,
  statsPocosSorteos satisfies Ensanchar<Stats>,
  statsConBacktests satisfies Ensanchar<Stats>,
  statsFormatosReales satisfies Ensanchar<Stats>,
  seguimiento satisfies Ensanchar<Seguimiento>,
  seguimientoVacio satisfies Ensanchar<Seguimiento>,
  gaps satisfies Ensanchar<Gaps>,
  gapsConNumeros satisfies Ensanchar<Gaps>,
  backtesting satisfies Ensanchar<Backtesting>,
  backtestingSinModelo satisfies Ensanchar<Backtesting>,
  comparar satisfies Ensanchar<Comparacion>,
  compararSinApariciones satisfies Ensanchar<Comparacion>,
  simulador satisfies Ensanchar<Simulacion>,
  simuladorSinAciertos satisfies Ensanchar<Simulacion>,
]

// 2. El tipo cubre todos los campos del fixture (si no, `Verdadero<false>` no compila).
export type TiposCubren = [
  Verdadero<Cubre<SorteosRespuesta, typeof sorteos>>,
  Verdadero<Cubre<Stats, typeof stats>>,
  Verdadero<Cubre<Stats, typeof statsPocosSorteos>>,
  Verdadero<Cubre<Stats, typeof statsConBacktests>>,
  Verdadero<Cubre<Stats, typeof statsFormatosReales>>,
  Verdadero<Cubre<Seguimiento, typeof seguimiento>>,
  Verdadero<Cubre<Seguimiento, typeof seguimientoVacio>>,
  Verdadero<Cubre<Gaps, typeof gaps>>,
  Verdadero<Cubre<Gaps, typeof gapsConNumeros>>,
  Verdadero<Cubre<Backtesting, typeof backtesting>>,
  Verdadero<Cubre<Backtesting, typeof backtestingSinModelo>>,
  Verdadero<Cubre<Comparacion, typeof comparar>>,
  Verdadero<Cubre<Comparacion, typeof compararSinApariciones>>,
  Verdadero<Cubre<Simulacion, typeof simulador>>,
  Verdadero<Cubre<Simulacion, typeof simuladorSinAciertos>>,
]
