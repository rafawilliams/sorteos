import { describe, expect, it } from 'vitest'
import backtesting from '../../fixtures/backtesting.json'
import backtestingPocosSorteos from '../../fixtures/backtesting_pocos_sorteos.json'
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
import statsSinModelo from '../../fixtures/stats_sin_modelo.json'
import statsSoloPrimeros from '../../fixtures/stats_solo_primeros.json'
import { CATEGORIAS, FORMATOS, METODOS, METODOS_DECENA, PREMIOS } from './constantes'

/**
 * `fixtures.check.ts` ensancha los textos literales a `string` (un JSON importado no puede ser otra cosa), así
 * que no puede comprobar `Categoria`, `Premio`, `Metodo` o el método de la decena. Esta prueba lo hace en
 * tiempo de ejecución sobre los 18 fixtures: todo texto de esos conjuntos cerrados tiene que pertenecer a ellos.
 */
const FIXTURES: Record<string, unknown> = {
  backtesting,
  backtesting_pocos_sorteos: backtestingPocosSorteos,
  backtesting_sin_modelo: backtestingSinModelo,
  comparar,
  comparar_sin_apariciones: compararSinApariciones,
  gaps,
  gaps_con_numeros: gapsConNumeros,
  seguimiento,
  seguimiento_vacio: seguimientoVacio,
  simulador,
  simulador_sin_aciertos: simuladorSinAciertos,
  sorteos,
  stats,
  stats_con_backtests: statsConBacktests,
  stats_formatos_reales: statsFormatosReales,
  stats_pocos_sorteos: statsPocosSorteos,
  stats_sin_modelo: statsSinModelo,
  stats_solo_primeros: statsSoloPrimeros,
}

type Objeto = Record<string, unknown>
const esObjeto = (v: unknown): v is Objeto => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Recorre el JSON entero y llama a `visitar` con cada propiedad: su nombre, su valor y el objeto que la tiene. */
function recorrer(valor: unknown, visitar: (clave: string, valor: unknown, padre: Objeto) => void): void {
  if (Array.isArray(valor)) valor.forEach((v) => recorrer(v, visitar))
  else if (esObjeto(valor)) {
    for (const [clave, hijo] of Object.entries(valor)) {
      visitar(clave, hijo, valor)
      recorrer(hijo, visitar)
    }
  }
}

/** Todos los valores de texto de las propiedades que se llaman `clave`, en cualquier parte del JSON. */
function textosDe(documento: unknown, clave: string): string[] {
  const hallados: string[] = []
  recorrer(documento, (k, v) => {
    if (k === clave && typeof v === 'string') hallados.push(v)
  })
  return hallados
}

/** Las claves de cada diccionario que cuelga de una propiedad llamada `nombre`. */
function clavesBajo(documento: unknown, nombre: string): string[][] {
  const hallados: string[][] = []
  recorrer(documento, (k, v) => {
    if (k === nombre && esObjeto(v)) hallados.push(Object.keys(v))
  })
  return hallados
}

const fueraDe = (valores: string[], permitidos: readonly string[]) => valores.filter((v) => !permitidos.includes(v))

describe.each(Object.entries(FIXTURES))('literales del fixture %s', (_nombre, doc) => {
  it('toda `cat` y `categoria` es una categoría conocida', () => {
    expect(fueraDe([...textosDe(doc, 'cat'), ...textosDe(doc, 'categoria')], CATEGORIAS)).toEqual([])
  })

  it('los diccionarios por categoría solo tienen categorías conocidas', () => {
    const claves = ['by_category', 'decena_recomendada', 'endings_by_category'].flatMap((n) => clavesBajo(doc, n).flat())
    expect(fueraDe(claves, CATEGORIAS)).toEqual([])
  })

  it('los diccionarios por premio solo tienen primero, segundo y tercero', () => {
    const claves = ['by_prize', 'prizes', 'ml_prizes'].flatMap((n) => clavesBajo(doc, n).flat())
    expect(fueraDe(claves, PREMIOS)).toEqual([])
  })

  it('`metodos` solo tiene métodos conocidos y `marcador` los tiene todos', () => {
    expect(fueraDe(clavesBajo(doc, 'metodos').flat(), METODOS)).toEqual([])
    for (const claves of clavesBajo(doc, 'marcador')) expect([...claves].sort()).toEqual([...METODOS].sort())
  })

  it('el método de la decena es uno de los conocidos', () => {
    expect(fueraDe(textosDe(doc, 'method'), METODOS_DECENA)).toEqual([])
  })

  it('`formatos` solo se indexa por 2 o 5 cifras', () => {
    expect(fueraDe(clavesBajo(doc, 'formatos').flat(), FORMATOS)).toEqual([])
  })
})

describe('literales: las comprobaciones no pasan en vacío', () => {
  const todos = Object.values(FIXTURES)

  it('los fixtures contienen de verdad categorías, métodos de decena y premios que comprobar', () => {
    expect(todos.flatMap((d) => textosDe(d, 'cat')).length).toBeGreaterThan(10)
    expect(todos.flatMap((d) => textosDe(d, 'categoria')).length).toBeGreaterThan(0)
    expect(todos.flatMap((d) => textosDe(d, 'method')).length).toBeGreaterThan(0)
    expect(todos.flatMap((d) => clavesBajo(d, 'prizes')).length).toBeGreaterThan(0)
    expect(todos.flatMap((d) => clavesBajo(d, 'metodos')).length).toBeGreaterThan(0)
    expect(todos.flatMap((d) => clavesBajo(d, 'marcador')).length).toBeGreaterThan(0)
  })

  it('un valor fuera de los conjuntos sí se detectaría', () => {
    const roto = { data: [{ cat: 'foo' }], by_category: { gordito: {}, otra: {} }, prizes: { cuarto: {} }, decena: { method: 'nuevo' } }
    expect(fueraDe(textosDe(roto, 'cat'), CATEGORIAS)).toEqual(['foo'])
    expect(fueraDe(clavesBajo(roto, 'by_category').flat(), CATEGORIAS)).toEqual(['otra'])
    expect(fueraDe(clavesBajo(roto, 'prizes').flat(), PREMIOS)).toEqual(['cuarto'])
    expect(fueraDe(textosDe(roto, 'method'), METODOS_DECENA)).toEqual(['nuevo'])
  })

  it('el método de decena «frecuencia» es el único que aparece en los fixtures; triple y pair se tipan por el código', () => {
    const vistos = new Set(todos.flatMap((d) => textosDe(d, 'method')))
    expect([...vistos]).toEqual(['frecuencia'])
  })
})
