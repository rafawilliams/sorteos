import { describe, expect, it, vi } from 'vitest'
import type { Sorteo } from '../api/types'
import { agregarFavorito, apariciones, CLAVE_FAVORITOS, contarAlertas, guardarFavoritos, leerFavoritos, quitarFavorito } from './favoritos'

const almacen = (valor: string | null) => ({ getItem: vi.fn((k: string) => (k === CLAVE_FAVORITOS ? valor : null)) })
const sorteo = (fecha: string, primero: string, segundo = '', tercero = '', cat: Sorteo['cat'] = 'dominical'): Sorteo => ({
  id: fecha, fecha, cat, primero, segundo, tercero, letra: '', serie: '', folio: '',
})

describe('leerFavoritos', () => {
  it('lee la lista guardada con la clave de siempre', () => {
    expect(CLAVE_FAVORITOS).toBe('lp_favorites')
    expect(leerFavoritos(almacen('["0042","1234"]'))).toEqual(['0042', '1234'])
  })

  it('sin nada guardado, lista vacía', () => {
    expect(leerFavoritos(almacen(null))).toEqual([])
  })

  it.each([['{no es json'], [''], ['null'], ['{"a":1}'], ['"texto"'], ['42'], ['true']])('JSON roto o que no es una lista («%s») → lista vacía', (v) => {
    expect(leerFavoritos(almacen(v))).toEqual([])
  })

  it('descarta lo que no es un número de 4 cifras y los repetidos', () => {
    expect(leerFavoritos(almacen('["0042", 7, null, "abc", "123", "12345", "0042", "9999"]'))).toEqual(['0042', '9999'])
  })

  it('si el almacenamiento lanza (modo privado, bloqueado), lista vacía', () => {
    expect(
      leerFavoritos({
        getItem: () => {
          throw new Error('bloqueado')
        },
      }),
    ).toEqual([])
  })
})

describe('con el almacenamiento del navegador bloqueado (el propio getter lanza)', () => {
  const bloquear = () =>
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError')
    })

  it('leer sin almacén explícito da lista vacía en vez de lanzar', () => {
    bloquear()
    expect(() => leerFavoritos()).not.toThrow()
    expect(leerFavoritos()).toEqual([])
  })

  it('guardar sin almacén explícito dice que no pudo, sin lanzar', () => {
    bloquear()
    expect(() => guardarFavoritos(['0042'])).not.toThrow()
    expect(guardarFavoritos(['0042'])).toBe(false)
  })
})

describe('guardarFavoritos', () => {
  it('guarda como JSON con la clave de siempre y dice que lo logró', () => {
    const setItem = vi.fn()
    expect(guardarFavoritos(['0042'], { setItem })).toBe(true)
    expect(setItem).toHaveBeenCalledWith('lp_favorites', '["0042"]')
  })

  it('si no puede guardar no lanza y lo dice', () => {
    expect(
      guardarFavoritos(['0042'], {
        setItem: () => {
          throw new Error('cuota')
        },
      }),
    ).toBe(false)
  })
})

describe('agregarFavorito', () => {
  it('añade al final, rellenando lo que teclea el usuario', () => {
    expect(agregarFavorito(['1234'], '42')).toEqual({ ok: true, numero: '0042', lista: ['1234', '0042'] })
  })

  it('no modifica la lista original', () => {
    const lista = ['1234']
    agregarFavorito(lista, '42')
    expect(lista).toEqual(['1234'])
  })

  it('rechaza un repetido, también si se escribe sin ceros', () => {
    expect(agregarFavorito(['0042'], '42')).toEqual({ ok: false, motivo: 'repetido', numero: '0042' })
  })

  it.each([[''], ['abc'], ['12345']])('rechaza «%s» como inválido', (t) => {
    expect(agregarFavorito([], t)).toEqual({ ok: false, motivo: 'invalido' })
  })
})

describe('quitarFavorito', () => {
  it('quita solo ese número y no toca la lista original', () => {
    const lista = ['0042', '1234']
    expect(quitarFavorito(lista, '0042')).toEqual(['1234'])
    expect(lista).toEqual(['0042', '1234'])
  })

  it('quitar uno que no está deja la lista igual', () => {
    expect(quitarFavorito(['1234'], '0042')).toEqual(['1234'])
  })
})

describe('apariciones: los 20 sorteos más recientes', () => {
  it('un acierto exacto marca el premio: 1ro, 2do, 3ro', () => {
    const s = [
      sorteo('2026-01-03', '0042', '1111', '2222'),
      sorteo('2026-01-02', '9999', '0042', '1111'),
      sorteo('2026-01-01', '9999', '1111', '0042', 'gordito'),
    ]
    expect(apariciones('0042', s)).toEqual([
      { id: '2026-01-03', fecha: '2026-01-03', cat: 'dominical', prizes: ['1ro'] },
      { id: '2026-01-02', fecha: '2026-01-02', cat: 'dominical', prizes: ['2do'] },
      { id: '2026-01-01', fecha: '2026-01-01', cat: 'gordito', prizes: ['3ro'] },
    ])
  })

  it('un número que sale en dos premios del mismo sorteo los marca los dos', () => {
    expect(apariciones('0042', [sorteo('2026-01-03', '0042', '0042', '')])[0]!.prizes).toEqual(['1ro', '2do'])
  })

  it('sin acierto exacto cuenta la terminación (los dos últimos dígitos), con «Term»', () => {
    expect(apariciones('0042', [sorteo('2026-01-03', '7742', '1142', '9999')])).toEqual([
      { id: '2026-01-03', fecha: '2026-01-03', cat: 'dominical', prizes: ['Term 1ro', 'Term 2do'] },
    ])
  })

  it('con acierto exacto en un premio, las terminaciones de los otros ya no cuentan', () => {
    expect(apariciones('0042', [sorteo('2026-01-03', '0042', '1142', '')])[0]!.prizes).toEqual(['1ro'])
  })

  it('premios de 2 y 5 cifras o vacíos se comparan tal como llegan, sin rellenar', () => {
    const s = [sorteo('2026-01-03', '42', '', '05342', 'extraordinario')]
    expect(apariciones('0042', s)[0]!.prizes).toEqual(['Term 1ro', 'Term 3ro'])
  })

  it('un premio vacío nunca coincide', () => {
    expect(apariciones('0000', [sorteo('2026-01-03', '', '', '')])).toEqual([])
  })

  it('solo mira los 20 más recientes', () => {
    const s = Array.from({ length: 25 }, (_, i) => sorteo(`2026-01-${25 - i < 10 ? '0' : ''}${25 - i}`, i === 20 ? '0042' : '9999'))
    expect(apariciones('0042', s)).toEqual([])
    s[19] = sorteo('2026-01-06', '0042')
    expect(apariciones('0042', s)).toHaveLength(1)
  })

  it('sin sorteos, nada', () => {
    expect(apariciones('0042', [])).toEqual([])
  })
})

describe('contarAlertas (insignia de la pestaña): aciertos exactos en los 5 sorteos más recientes', () => {
  const s = [
    sorteo('2026-01-06', '0042', '0042', ''),
    sorteo('2026-01-05', '1111', '', '0042'),
    sorteo('2026-01-04', '9999'),
    sorteo('2026-01-03', '9999'),
    sorteo('2026-01-02', '9999'),
    sorteo('2026-01-01', '0042'),
  ]

  it('suma cada premio acertado de cada favorito (la terminación no cuenta)', () => {
    expect(contarAlertas(['0042'], s)).toBe(3)
    expect(contarAlertas(['0042', '1111'], s)).toBe(4)
    expect(contarAlertas(['1142'], [sorteo('2026-01-06', '0042')])).toBe(0)
  })

  it('el sexto sorteo no cuenta', () => {
    expect(contarAlertas(['0042'], [...s.slice(0, 5), sorteo('2025-12-31', '0042')])).toBe(3)
  })

  it('sin favoritos o sin sorteos, cero', () => {
    expect(contarAlertas([], s)).toBe(0)
    expect(contarAlertas(['0042'], [])).toBe(0)
  })
})
