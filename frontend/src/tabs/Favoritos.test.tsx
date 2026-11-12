import { readFileSync } from 'node:fs'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Sorteo, Stats } from '../api/types'
import { StoreProvider } from '../store/StoreProvider'
import { crearStoreFalso } from '../store/storeFalso'
import { Componente, nombre } from './Favoritos'

const leer = <T,>(n: string): T => JSON.parse(readFileSync(`fixtures/${n}.json`, 'utf-8'))
const STATS = leer<Stats>('stats')
const SORTEOS = leer<{ data: Sorteo[] }>('sorteos').data
const RECIENTE = SORTEOS[0]!.primero // un número que sale en el sorteo más reciente

const sorteo = (fecha: string, primero: string, segundo = '', tercero = '', cat: Sorteo['cat'] = 'dominical'): Sorteo => ({
  id: fecha, fecha, cat, primero, segundo, tercero, letra: '', serie: '', folio: '',
})
const statsCon = (recs: string[], ml: string[]): Stats => ({
  ...STATS,
  recommendations: recs.map((number) => ({ number, score: 1, confidence: 1, lift: 1, veces: 1 })),
  ml_recommendations: ml.map((number) => ({ number, score: 1, confidence: 1 })),
})

function montar(estado: Partial<{ sorteos: Sorteo[]; stats: Stats | null }> = {}, estricto = false) {
  const store = crearStoreFalso({ activeTab: 'favoritos', sorteos: SORTEOS, stats: STATS, ready: true, ...estado })
  const arbol = (
    <StoreProvider store={store}>
      <Componente />
    </StoreProvider>
  )
  return { store, ...render(estricto ? <StrictMode>{arbol}</StrictMode> : arbol) }
}

const entrada = () => screen.getByRole('textbox', { name: 'Número (4 dígitos)' }) as HTMLInputElement
const agregar = (texto: string) => {
  fireEvent.change(entrada(), { target: { value: texto } })
  fireEvent.click(screen.getByRole('button', { name: 'Agregar número favorito' }))
}
const guardado = () => JSON.parse(localStorage.getItem('lp_favorites') ?? 'null')
const tarjeta = (numero: string) => screen.getByText(numero, { selector: 'span' }).closest('.card') as HTMLElement
const avisos = (store: ReturnType<typeof crearStoreFalso>) => store.llamadas.filter((l) => l.accion === 'toast').map((l) => l.args)

beforeEach(() => {
  localStorage.clear()
  document.body.innerHTML = ''
})
afterEach(() => vi.restoreAllMocks())

describe('contrato', () => {
  it('se llama «favoritos» como el data-tab de la barra', () => {
    expect(nombre).toBe('favoritos')
  })
})

describe('lista guardada', () => {
  it('sin nada guardado dice que no hay favoritos', () => {
    montar()
    expect(screen.getByText(/No tienes números favoritos aún/)).toBeInTheDocument()
    expect(screen.getByText(/Agrega números para rastrear sus apariciones/)).toBeInTheDocument()
  })

  it('lee lp_favorites y los muestra en el orden guardado', () => {
    localStorage.setItem('lp_favorites', JSON.stringify(['0042', '1234']))
    montar()
    const numeros = Array.from(document.querySelectorAll('.card span[style*="letter-spacing"]')).map((e) => e.textContent)
    expect(numeros).toEqual(['0042', '1234'])
  })

  it.each([['{no es json'], ['{"a":1}'], ['"texto"'], ['["abc", 7, null]']])('un valor guardado roto («%s») se trata como lista vacía', (v) => {
    localStorage.setItem('lp_favorites', v)
    montar()
    expect(screen.getByText(/No tienes números favoritos aún/)).toBeInTheDocument()
  })

  it('el formulario se ve aunque las estadísticas aún no hayan llegado; la lista muestra un esqueleto', () => {
    localStorage.setItem('lp_favorites', JSON.stringify(['0042']))
    montar({ stats: null })
    expect(entrada()).toBeInTheDocument()
    const lista = screen.getByRole('region', { name: 'Lista de números favoritos' })
    expect(within(lista).getByRole('status', { name: 'Cargando favoritos' }).querySelectorAll('.skeleton').length).toBeGreaterThan(0)
    expect(screen.queryByText('0042')).toBeNull()
  })

  it('la región de la lista avisa de los cambios (aria-live)', () => {
    montar()
    expect(screen.getByRole('region', { name: 'Lista de números favoritos' })).toHaveAttribute('aria-live', 'polite')
  })
})

describe('agregar', () => {
  it('añade el número rellenando lo tecleado, lo guarda, avisa y vacía el campo', () => {
    const { store } = montar()
    agregar('42')
    expect(screen.getByText('0042', { selector: 'span' })).toBeInTheDocument()
    expect(guardado()).toEqual(['0042'])
    expect(avisos(store)).toEqual([['0042 agregado a favoritos', 2000]])
    expect(entrada().value).toBe('')
    expect(screen.queryByText(/No tienes números favoritos aún/)).toBeNull()
  })

  it('añade al final y conserva lo anterior', () => {
    localStorage.setItem('lp_favorites', JSON.stringify(['1234']))
    montar()
    agregar('0042')
    expect(guardado()).toEqual(['1234', '0042'])
  })

  it.each([[''], ['   '], ['abc'], ['12345'], ['12a4']])('«%s» no es válido: avisa, no guarda y deja lo tecleado', (texto) => {
    const { store } = montar()
    agregar(texto)
    expect(avisos(store)).toEqual([['Ingresa un número de 4 dígitos', 3000]])
    expect(guardado()).toBeNull()
    expect(entrada().value).toBe(texto)
    expect(screen.getByText(/No tienes números favoritos aún/)).toBeInTheDocument()
  })

  it('un repetido avisa (también escrito sin ceros), no duplica y deja lo tecleado', () => {
    localStorage.setItem('lp_favorites', JSON.stringify(['0042']))
    const { store } = montar()
    agregar('42')
    expect(avisos(store)).toEqual([['0042 ya está en tu lista', 2000]])
    expect(guardado()).toEqual(['0042'])
    expect(entrada().value).toBe('42')
  })

  it('el campo acepta como mucho 4 caracteres y trae su pista', () => {
    montar()
    expect(entrada()).toHaveAttribute('maxlength', '4')
    expect(entrada()).toHaveAttribute('placeholder', '0042')
    expect(entrada()).toHaveAttribute('pattern', '[0-9]{4}')
  })

  it('si el navegador no deja guardar, la lista funciona igual y se avisa', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('cuota')
    })
    const { store } = montar()
    agregar('42')
    expect(screen.getByText('0042', { selector: 'span' })).toBeInTheDocument()
    // Solo ese aviso: el de «agregado» lo taparía (el #toast es uno solo) y la persona creería que se guardó.
    expect(avisos(store)).toEqual([['No se pudo guardar la lista en este navegador', 3000]])
  })

  it('con el almacenamiento bloqueado del todo, la isla se monta y funciona en memoria', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError')
    })
    const { store } = montar()
    expect(entrada()).toBeInTheDocument()
    agregar('42')
    expect(screen.getByText('0042', { selector: 'span' })).toBeInTheDocument()
    expect(avisos(store)).toEqual([['No se pudo guardar la lista en este navegador', 3000]])
  })

  it('en StrictMode añade una sola vez y avisa una sola vez', () => {
    const { store } = montar({}, true)
    agregar('42')
    expect(avisos(store)).toEqual([['0042 agregado a favoritos', 2000]])
    expect(guardado()).toEqual(['0042'])
    expect(document.querySelectorAll('.card span[style*="letter-spacing"]')).toHaveLength(1)
  })
})

describe('otra pestaña del navegador', () => {
  it('un cambio de lp_favorites hecho en otra pestaña se recoge (evento storage)', () => {
    localStorage.setItem('lp_favorites', JSON.stringify(['1111']))
    montar()
    localStorage.setItem('lp_favorites', JSON.stringify(['1111', '2222']))
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'lp_favorites' }))
    })
    expect(screen.getByText('2222', { selector: 'span' })).toBeInTheDocument()
  })

  it('así no se pisan: añadir tras el cambio ajeno conserva lo de la otra pestaña', () => {
    localStorage.setItem('lp_favorites', JSON.stringify(['1111']))
    montar()
    localStorage.setItem('lp_favorites', JSON.stringify(['1111', '2222']))
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'lp_favorites' }))
    })
    agregar('3333')
    expect(guardado()).toEqual(['1111', '2222', '3333'])
  })

  it('un evento de otra clave se ignora', () => {
    localStorage.setItem('lp_favorites', JSON.stringify(['1111']))
    montar()
    localStorage.setItem('lp_favorites', JSON.stringify(['1111', '2222']))
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'theme' }))
    })
    expect(screen.queryByText('2222', { selector: 'span' })).toBeNull()
  })

  it('al desmontar deja de escuchar', () => {
    const quitar = vi.spyOn(window, 'removeEventListener')
    const { unmount } = montar()
    unmount()
    expect(quitar).toHaveBeenCalledWith('storage', expect.any(Function))
  })
})

describe('quitar', () => {
  it('elimina solo ese número y actualiza lo guardado', () => {
    localStorage.setItem('lp_favorites', JSON.stringify(['0042', '1234']))
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar 0042' }))
    expect(screen.queryByText('0042', { selector: 'span' })).toBeNull()
    expect(screen.getByText('1234', { selector: 'span' })).toBeInTheDocument()
    expect(guardado()).toEqual(['1234'])
  })

  it('al quitar el foco pasa a la lista y no se pierde en <body>', () => {
    localStorage.setItem('lp_favorites', JSON.stringify(['0042']))
    montar()
    const boton = screen.getByRole('button', { name: 'Eliminar 0042' })
    boton.focus()
    fireEvent.click(boton)
    expect(screen.getByRole('region', { name: 'Lista de números favoritos' })).toHaveFocus()
  })

  it('quitar el último vuelve al mensaje de lista vacía', () => {
    localStorage.setItem('lp_favorites', JSON.stringify(['0042']))
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar 0042' }))
    expect(screen.getByText(/No tienes números favoritos aún/)).toBeInTheDocument()
    expect(guardado()).toEqual([])
  })
})

describe('cada favorito', () => {
  it('salió reciente: etiqueta, borde verde y sus apariciones (fecha, categoría y premio)', () => {
    localStorage.setItem('lp_favorites', JSON.stringify([RECIENTE]))
    montar()
    const t = tarjeta(RECIENTE)
    expect(t).toHaveTextContent('✓ SALIÓ RECIENTE')
    expect(t).toHaveStyle({ borderLeft: '4px solid #4ade80' })
    expect(t).toHaveTextContent(SORTEOS[0]!.fecha) // la fecha ISO tal cual
    expect(within(t).getAllByText(SORTEOS[0]!.cat)[0]).toHaveClass('cat-badge')
    expect(t).toHaveTextContent('1ro')
  })

  it('dos sorteos con la misma fecha y categoría salen los dos, sin avisos de claves repetidas', () => {
    const aviso = vi.spyOn(console, 'error').mockImplementation(() => {})
    const a = { ...sorteo('2002-12-29', '0042'), id: '1' }
    const b = { ...sorteo('2002-12-29', '0042'), id: '2' }
    localStorage.setItem('lp_favorites', JSON.stringify(['0042']))
    montar({ sorteos: [a, b] })
    expect(tarjeta('0042').querySelectorAll('.cat-badge')).toHaveLength(2)
    expect(aviso).not.toHaveBeenCalled()
  })

  it('muestra como mucho 5 apariciones', () => {
    const muchos = Array.from({ length: 8 }, (_, i) => sorteo(`2026-01-0${8 - i}`, '0042'))
    localStorage.setItem('lp_favorites', JSON.stringify(['0042']))
    montar({ sorteos: muchos })
    expect(tarjeta('0042').querySelectorAll('.cat-badge')).toHaveLength(5)
  })

  it('recomendado por el modelo estadístico: etiqueta y borde dorado si no salió', () => {
    localStorage.setItem('lp_favorites', JSON.stringify(['7777']))
    montar({ stats: statsCon(['7777'], []), sorteos: [sorteo('2026-01-01', '1111')] })
    const t = tarjeta('7777')
    expect(t).toHaveTextContent('📊 Recomendado')
    expect(t).not.toHaveTextContent('🤖 ML Recomendado')
    expect(t).not.toHaveTextContent('SALIÓ RECIENTE')
    expect(t.style.borderLeft).toBe('4px solid var(--gold-400)') // jsdom no resuelve var(): se mira el atributo
  })

  it('recomendado solo por el ML también lleva el borde dorado', () => {
    localStorage.setItem('lp_favorites', JSON.stringify(['7777']))
    montar({ stats: statsCon([], ['7777']), sorteos: [sorteo('2026-01-01', '1111')] })
    expect(tarjeta('7777').style.borderLeft).toBe('4px solid var(--gold-400)')
  })

  it('recomendado por el ML: su propia etiqueta; los dos a la vez muestran las dos', () => {
    localStorage.setItem('lp_favorites', JSON.stringify(['7777', '8888']))
    montar({ stats: statsCon(['8888'], ['7777', '8888']), sorteos: [sorteo('2026-01-01', '1111')] })
    expect(tarjeta('7777')).toHaveTextContent('🤖 ML Recomendado')
    expect(tarjeta('7777')).not.toHaveTextContent('📊 Recomendado')
    expect(tarjeta('8888')).toHaveTextContent('📊 Recomendado')
    expect(tarjeta('8888')).toHaveTextContent('🤖 ML Recomendado')
  })

  it('si salió y además está recomendado, el borde es el verde', () => {
    localStorage.setItem('lp_favorites', JSON.stringify(['0042']))
    montar({ stats: statsCon(['0042'], []), sorteos: [sorteo('2026-01-01', '0042')] })
    expect(tarjeta('0042')).toHaveStyle({ borderLeft: '4px solid #4ade80' })
  })

  it('sin aciertos ni recomendaciones no lleva etiquetas ni borde de color', () => {
    localStorage.setItem('lp_favorites', JSON.stringify(['5555']))
    montar({ stats: statsCon([], []), sorteos: [sorteo('2026-01-01', '1111')] })
    const t = tarjeta('5555')
    expect(t).not.toHaveTextContent('SALIÓ RECIENTE')
    expect(t).not.toHaveTextContent('Recomendado')
    expect(t.style.borderLeft).toBe('')
  })

  it('la terminación coincidente se marca «Term»', () => {
    localStorage.setItem('lp_favorites', JSON.stringify(['0042']))
    montar({ sorteos: [sorteo('2026-01-01', '7742', '', '05342', 'extraordinario')] })
    expect(tarjeta('0042')).toHaveTextContent('Term 1ro, Term 3ro')
  })

  it('«Simular» abre el Simulador con ese número y cada botón dice de cuál', () => {
    localStorage.setItem('lp_favorites', JSON.stringify(['0042', '1234']))
    const { store } = montar()
    expect(screen.getByRole('button', { name: 'Simular 1234' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Simular 0042' }))
    expect(store.llamadas).toContainEqual({ accion: 'simularNumero', args: ['0042'] })
  })

  it('las tarjetas se hacen visibles (no se quedan en blanco)', () => {
    localStorage.setItem('lp_favorites', JSON.stringify(['0042']))
    montar()
    expect(tarjeta('0042')).toHaveClass('reveal', 'visible')
  })

  it('un favorito reacciona a los datos nuevos (un sorteo nuevo lo marca como salido)', () => {
    localStorage.setItem('lp_favorites', JSON.stringify(['0042']))
    const { store } = montar({ sorteos: [sorteo('2026-01-01', '1111')] })
    expect(tarjeta('0042')).not.toHaveTextContent('SALIÓ RECIENTE')
    act(() => store.cambiar({ sorteos: [sorteo('2026-01-02', '0042'), sorteo('2026-01-01', '1111')] }))
    expect(tarjeta('0042')).toHaveTextContent('SALIÓ RECIENTE')
  })
})

describe('insignia de la pestaña', () => {
  const pestana = () => {
    const b = document.createElement('button')
    b.id = 'tab-favoritos'
    document.body.appendChild(b)
    return b
  }

  it('cuenta los aciertos exactos en los 5 últimos sorteos', () => {
    const b = pestana()
    localStorage.setItem('lp_favorites', JSON.stringify(['0042']))
    montar({ sorteos: [sorteo('2026-01-03', '0042', '0042'), sorteo('2026-01-02', '1111')] })
    expect(b.dataset.badge).toBe('2')
  })

  it('sin aciertos la insignia queda vacía; al añadir un acierto aparece', () => {
    const b = pestana()
    montar({ sorteos: [sorteo('2026-01-02', '1111')] })
    expect(b.dataset.badge).toBe('')
    agregar('1111')
    expect(b.dataset.badge).toBe('1')
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar 1111' }))
    expect(b.dataset.badge).toBe('')
  })

  it('funciona aunque la pestaña no sea la activa y aunque las estadísticas no hayan llegado', () => {
    const b = pestana()
    localStorage.setItem('lp_favorites', JSON.stringify(['1111']))
    const { store } = montar({ sorteos: [sorteo('2026-01-02', '1111')], stats: null })
    act(() => store.cambiar({ activeTab: 'gaps' }))
    expect(b.dataset.badge).toBe('1')
  })

  it('al desmontar la isla quita la insignia', () => {
    const b = pestana()
    localStorage.setItem('lp_favorites', JSON.stringify(['1111']))
    const { unmount } = montar({ sorteos: [sorteo('2026-01-02', '1111')] })
    expect(b.dataset.badge).toBe('1')
    unmount()
    expect(b.dataset.badge).toBe('')
  })

  it('sin botón de pestaña en la página no falla', () => {
    localStorage.setItem('lp_favorites', JSON.stringify(['1111']))
    expect(() => montar({ sorteos: [sorteo('2026-01-02', '1111')] })).not.toThrow()
  })
})
