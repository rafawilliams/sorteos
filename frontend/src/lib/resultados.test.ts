import { describe, expect, it } from 'vitest'
import type { Sorteo } from '../api/types'
import { aCsv, categoriasDe, contarPorCategoria, filtrarSorteos, nombreArchivoCsv, POR_PAGINA, SIN_FILTROS, totalPaginas, ventanaPaginas } from './resultados'

const sorteo = (id: string, fecha: string, cat: string, primero: string, segundo = '', tercero = '', extra: Partial<Sorteo> = {}): Sorteo =>
  ({ id, fecha, cat, primero, segundo, tercero, letra: '', serie: '', folio: '', ...extra }) as Sorteo

const A = sorteo('1', '2019-10-02', 'extraordinario', '09614', '', '', { letra: 'ABCD', serie: '2', folio: '599' })
const B = sorteo('2', '2019-09-29', 'dominical', '3920', '0074', '98')
const C = sorteo('3', '2019-09-25', 'miercolito', '1234', '5678', '9012')
const D = sorteo('4', '2018-01-01', 'gordito', '4321', '98', '0074')
const TODOS = [A, B, C, D]
const f = (parcial: Partial<typeof SIN_FILTROS>) => ({ ...SIN_FILTROS, ...parcial })

describe('constantes', () => {
  it('50 filas por página y sin filtros por defecto', () => {
    expect(POR_PAGINA).toBe(50)
    expect(SIN_FILTROS).toEqual({ q: '', cat: 'all', desde: '', hasta: '' })
  })
})

describe('filtrarSorteos', () => {
  it('sin filtros devuelve la misma lista (misma referencia: no invalida los memos)', () => {
    expect(filtrarSorteos(TODOS, SIN_FILTROS)).toBe(TODOS)
  })

  it('«all» no es una categoría: no filtra', () => {
    expect(filtrarSorteos(TODOS, f({ cat: 'all' }))).toBe(TODOS)
  })

  it('por categoría, comparando la categoría tal cual', () => {
    expect(filtrarSorteos(TODOS, f({ cat: 'gordito' }))).toEqual([D])
    expect(filtrarSorteos(TODOS, f({ cat: 'inexistente' }))).toEqual([])
  })

  it('la categoría tiene que ser igual, no una subcadena de otra ni al revés', () => {
    expect(filtrarSorteos(TODOS, f({ cat: 'ario' }))).toEqual([]) // «extraordinario» la contiene
    expect(filtrarSorteos(TODOS, f({ cat: 'extraordinario ' }))).toEqual([]) // ni con un espacio de más
    expect(filtrarSorteos(TODOS, f({ cat: 'GORDITO' }))).toEqual([]) // ni con otras mayúsculas
  })

  it('el texto busca como subcadena en cualquiera de los tres premios', () => {
    expect(filtrarSorteos(TODOS, f({ q: '96' }))).toEqual([A]) // «09614» contiene «96»
    expect(filtrarSorteos(TODOS, f({ q: '0074' }))).toEqual([B, D]) // en el 2.º y en el 3.º
    expect(filtrarSorteos(TODOS, f({ q: '98' }))).toEqual([B, D])
    expect(filtrarSorteos(TODOS, f({ q: '5678' }))).toEqual([C])
  })

  it('el texto se recorta; solo espacios no filtra', () => {
    expect(filtrarSorteos(TODOS, f({ q: '  5678  ' }))).toEqual([C])
    expect(filtrarSorteos(TODOS, f({ q: '   ' }))).toBe(TODOS)
  })

  it('el texto no mira la fecha, la categoría, las letras, la serie ni el folio', () => {
    expect(filtrarSorteos(TODOS, f({ q: '2019' }))).toEqual([])
    expect(filtrarSorteos(TODOS, f({ q: 'ABCD' }))).toEqual([])
    expect(filtrarSorteos(TODOS, f({ q: '599' }))).toEqual([])
  })

  it('un premio vacío o ausente no rompe la búsqueda', () => {
    const roto = { ...A, segundo: undefined, tercero: null } as unknown as Sorteo
    expect(filtrarSorteos([roto], f({ q: '96' }))).toEqual([roto])
    expect(filtrarSorteos([roto], f({ q: 'zzz' }))).toEqual([])
  })

  it('las fechas son inclusivas por los dos lados', () => {
    expect(filtrarSorteos(TODOS, f({ desde: '2019-09-29' }))).toEqual([A, B])
    expect(filtrarSorteos(TODOS, f({ hasta: '2019-09-29' }))).toEqual([B, C, D])
    expect(filtrarSorteos(TODOS, f({ desde: '2019-09-25', hasta: '2019-09-29' }))).toEqual([B, C])
    expect(filtrarSorteos(TODOS, f({ desde: '2019-09-29', hasta: '2019-09-29' }))).toEqual([B])
  })

  it('un rango invertido no devuelve nada', () => {
    expect(filtrarSorteos(TODOS, f({ desde: '2019-12-01', hasta: '2019-01-01' }))).toEqual([])
  })

  it('los filtros se combinan con Y y conservan el orden original', () => {
    expect(filtrarSorteos(TODOS, f({ cat: 'dominical', q: '98', desde: '2019-01-01' }))).toEqual([B])
    expect(filtrarSorteos(TODOS, f({ cat: 'dominical', q: '1234' }))).toEqual([])
    expect(filtrarSorteos([D, B, A], f({ q: '98' }))).toEqual([D, B])
  })

  it('no modifica la lista de entrada', () => {
    const copia = [...TODOS]
    filtrarSorteos(TODOS, f({ cat: 'dominical' }))
    expect(TODOS).toEqual(copia)
  })
})

describe('totalPaginas y ventanaPaginas', () => {
  it.each([
    [0, 0],
    [1, 1],
    [50, 1],
    [51, 2],
    [100, 2],
    [101, 3],
    [9296, 186],
  ])('%i filas → %i páginas', (filas, paginas) => {
    expect(totalPaginas(filas)).toBe(paginas)
  })

  it.each([
    // actual, total, desde, hasta, puntosAntes, puntosDespues
    [1, 3, 1, 3, false, false],
    [1, 20, 1, 4, false, true],
    [4, 20, 1, 7, false, true],
    [5, 20, 2, 8, true, true],
    [10, 20, 7, 13, true, true],
    [17, 20, 14, 20, true, false],
    [20, 20, 17, 20, true, false],
    [1, 1, 1, 1, false, false],
  ])('desde la página %i de %i se ven las páginas %i a %i (puntos antes: %s, después: %s)', (actual, total, desde, hasta, antes, despues) => {
    expect(ventanaPaginas(actual, total)).toEqual({ desde, hasta, puntosAntes: antes, puntosDespues: despues })
  })
})

describe('categoriasDe y contarPorCategoria', () => {
  it('las categorías salen en orden de primera aparición y sin repetir', () => {
    expect(categoriasDe([A, B, C, D, A, B])).toEqual(['extraordinario', 'dominical', 'miercolito', 'gordito'])
  })

  it('un sorteo sin categoría no cuenta como categoría', () => {
    expect(categoriasDe([{ ...A, cat: '' } as unknown as Sorteo, B])).toEqual(['dominical'])
    expect(contarPorCategoria([{ ...A, cat: undefined } as unknown as Sorteo, B])).toEqual([['dominical', 1]])
  })

  it('cuenta por categoría, en el mismo orden', () => {
    expect(contarPorCategoria([A, B, C, D, B, A, A])).toEqual([
      ['extraordinario', 3],
      ['dominical', 2],
      ['miercolito', 1],
      ['gordito', 1],
    ])
  })

  it('sin sorteos no hay categorías', () => {
    expect(categoriasDe([])).toEqual([])
    expect(contarPorCategoria([])).toEqual([])
  })
})

describe('aCsv', () => {
  const CABECERA = 'Fecha,Categoria,1er Premio,2do Premio,3er Premio,Letras,Serie,Folio\n'

  it('sin filas deja solo la cabecera, con su salto de línea', () => {
    expect(aCsv([])).toBe(CABECERA)
  })

  it('una fila por sorteo, en orden, con los premios tal como llegan y un salto de línea al final de cada una', () => {
    expect(aCsv([A, B])).toBe(`${CABECERA}2019-10-02,extraordinario,09614,,,ABCD,2,599\n2019-09-29,dominical,3920,0074,98,,,\n`)
  })

  it('los premios de 2, 4 y 5 cifras y los vacíos no se rellenan con ceros ni se alteran', () => {
    const filas = aCsv([A, B, D]).split('\n')
    expect(filas[1]).toContain(',09614,,,') // 5 cifras
    expect(filas[2]).toContain(',3920,0074,98,') // 4, 4 y 2
    expect(filas[3]).toContain(',4321,98,0074,') // 2 cifras en el 2.º
  })

  it('un valor ausente o nulo queda vacío, no «undefined» ni «null»', () => {
    const roto = { id: '9', fecha: '2020-01-01', cat: 'dominical', primero: undefined, segundo: null, tercero: '', letra: undefined, serie: null, folio: undefined } as unknown as Sorteo
    expect(aCsv([roto])).toBe(`${CABECERA}2020-01-01,dominical,,,,,,\n`)
  })

  it('un valor con coma, comillas o salto de línea va entre comillas con las comillas duplicadas', () => {
    expect(aCsv([sorteo('1', '2020-01-01', 'dominical', '1234', '', '', { letra: 'A,B' })])).toContain(',"A,B",')
    expect(aCsv([sorteo('1', '2020-01-01', 'dominical', '1234', '', '', { letra: 'di"jo' })])).toContain(',"di""jo",')
    expect(aCsv([sorteo('1', '2020-01-01', 'dominical', '1234', '', '', { letra: 'a\nb' })])).toContain(',"a\nb",')
  })

  it.each(['=1+1', '+SUMA(A1)', '-2+3', '@cmd', '\tx', '\rx'])('un valor que empieza por «%s» no se puede leer como fórmula en una hoja de cálculo', (valor) => {
    const fila = aCsv([sorteo('1', '2020-01-01', 'dominical', '1234', '', '', { letra: valor })]).split('\n')[1]!
    const letra = fila.split(',')[5]!.replace(/^"/, '')
    expect(letra.startsWith("'")).toBe(true)
  })

  it('un valor normal no se toca', () => {
    expect(aCsv([sorteo('1', '2020-01-01', 'dominical', '1234', '5678', '9012', { letra: 'ABCD', serie: '3', folio: '12' })])).toBe(`${CABECERA}2020-01-01,dominical,1234,5678,9012,ABCD,3,12\n`)
  })
})

describe('nombreArchivoCsv', () => {
  it('lleva la fecha ISO del día, como el código antiguo', () => {
    expect(nombreArchivoCsv(new Date('2026-11-12T15:30:00Z'))).toBe('sorteos_panama_2026-11-12.csv')
  })
})
