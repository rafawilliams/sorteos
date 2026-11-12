import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Sorteo } from '../api/types'
import { catLabel, formatDate } from '../lib/formato'
import { StoreProvider } from '../store/StoreProvider'
import { crearStoreFalso } from '../store/storeFalso'
import { Componente, nombre } from './Resultados'

const CATS = ['dominical', 'miercolito', 'gordito', 'extraordinario']
const sorteo = (id: string, fecha: string, cat: string, primero: string, segundo = '', tercero = '', extra: Partial<Sorteo> = {}): Sorteo =>
  ({ id, fecha, cat, primero, segundo, tercero, letra: '', serie: '', folio: '', ...extra }) as Sorteo
const fechaDe = (i: number) => new Date(Date.UTC(2019, 9, 2) - i * 86_400_000).toISOString().slice(0, 10)
/** n sorteos, del más reciente al más antiguo, repartidos entre las cuatro categorías. */
const muchos = (n: number): Sorteo[] => Array.from({ length: n }, (_, i) => sorteo(String(i + 1), fechaDe(i), CATS[i % 4]!, String(1000 + i), String(2000 + i), String(3000 + i), { letra: 'ABCD', serie: String(i % 9), folio: String(i) }))

const FORMATOS: Sorteo[] = [
  sorteo('f1', '2019-10-02', 'extraordinario', '09614', '', '', { letra: 'ABCD', serie: '2', folio: '599' }), // 5 cifras y vacíos
  sorteo('f2', '2019-09-29', 'dominical', '3920', '0074', '0098'), // 4 cifras con ceros a la izquierda
  sorteo('f3', '2019-09-25', 'gordito', '4321', '98', '07'), // 2 cifras (gordito desde 1996)
  sorteo('f4', '2019-09-22', 'miercolito', '98', '07', '12'), // 2 cifras en los tres (miercolito 1962-1966)
]

const crear = vi.hoisted(() => ({ blobs: [] as Blob[] }))
let clics: Array<{ download: string; href: string }>

function montar({ sorteos = muchos(120), ready = true, estricto = false, ranura = false, errorSorteos = false } = {}) {
  if (ranura) {
    // La cabecera de la plantilla: la ranura del CSV (que ocupa la isla) y el botón de actualizar (que sigue siendo del JS antiguo).
    const cabecera = document.createElement('div')
    cabecera.id = 'cabecera'
    const hueco = document.createElement('span')
    hueco.id = 'resultadosCsv'
    hueco.style.display = 'contents'
    const actualizar = document.createElement('button')
    actualizar.id = 'updateBtn'
    actualizar.textContent = '↻ Actualizar datos'
    cabecera.append(hueco, actualizar)
    document.body.append(cabecera)
  }
  const store = crearStoreFalso({ activeTab: 'resultados' as never, sorteos, ready, errorSorteos })
  const arbol = (
    <StoreProvider store={store}>
      <Componente />
    </StoreProvider>
  )
  return { store, ...render(estricto ? <StrictMode>{arbol}</StrictMode> : arbol) }
}
/** Las filas de sorteos; la fila de «No hay resultados…» (con `colspan`) no es un sorteo. */
const filas = () => Array.from(document.querySelectorAll<HTMLTableRowElement>('tbody tr')).filter((f) => !f.querySelector('td[colspan]'))
const celdas = (fila: HTMLElement) => Array.from(fila.querySelectorAll('td'))
const busqueda = () => screen.getByRole('searchbox', { name: 'Buscar número' }) as HTMLInputElement
const categoria = () => screen.getByRole('combobox', { name: 'Filtrar por categoría' }) as HTMLSelectElement
const desde = () => screen.getByLabelText('Fecha desde') as HTMLInputElement
const hasta = () => screen.getByLabelText('Fecha hasta') as HTMLInputElement
const paginacion = () => screen.getByRole('navigation', { name: 'Paginación de resultados' })
const botonPagina = (n: number) => within(paginacion()).getByRole('button', { name: `Página ${n}` })
const paginaActiva = () => within(paginacion()).getByRole('button', { current: 'page' })
const avisos = (store: ReturnType<typeof crearStoreFalso>) => store.llamadas.filter((l) => l.accion === 'toast').map((l) => l.args)

beforeEach(() => {
  crear.blobs.length = 0
  clics = []
  URL.createObjectURL = vi.fn((b: Blob) => (crear.blobs.push(b), 'blob:falso')) as never
  URL.revokeObjectURL = vi.fn() as never
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clics.push({ download: this.download, href: this.href })
  })
})
afterEach(() => {
  document.getElementById('cabecera')?.remove()
  vi.restoreAllMocks()
})

describe('contrato y carga', () => {
  it('se llama «resultados» como el data-tab de la barra', () => {
    expect(nombre).toBe('resultados')
  })

  it('mientras no llegan los sorteos muestra su esqueleto, sin filtros ni tabla', () => {
    montar({ sorteos: [], ready: false })
    expect(screen.getByRole('status', { name: 'Cargando resultados' })).toBeInTheDocument()
    expect(screen.queryByRole('search')).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('si la carga de sorteos falla lo dice, con «Reintentar», en vez de quedarse en el esqueleto para siempre', () => {
    montar({ sorteos: [], ready: false, errorSorteos: true })
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar los sorteos.')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('search')).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('con el error a la vista, el botón de exportar sigue desactivado', () => {
    montar({ sorteos: [], ready: false, errorSorteos: true })
    expect(screen.getByRole('button', { name: 'Exportar resultados a CSV' })).toBeDisabled()
  })

  it('«Reintentar» vuelve a pedir los datos y el foco se queda en la isla, no se pierde en <body>', () => {
    const { store } = montar({ sorteos: [], ready: false, errorSorteos: true })
    const zona = screen.getByRole('alert').parentElement as HTMLElement
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(store.llamadas.filter((l) => l.accion === 'reload')).toHaveLength(1)
    expect(zona).toHaveFocus()
    // El Store limpia el error al empezar el intento: el mismo contenedor pasa a enseñar el esqueleto y conserva el foco.
    act(() => store.cambiar({ errorSorteos: false }))
    expect(screen.getByRole('status', { name: 'Cargando resultados' })).toBeInTheDocument()
    expect(zona.contains(screen.getByRole('status'))).toBe(true)
    expect(zona).toHaveFocus()
  })

  it('error → intento (esqueleto) → datos: la secuencia completa', () => {
    const { store } = montar({ sorteos: [], ready: false, errorSorteos: true })
    act(() => store.cambiar({ errorSorteos: false }))
    expect(screen.getByRole('status')).toBeInTheDocument()
    act(() => store.cambiar({ sorteos: muchos(10), ready: true }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(filas()).toHaveLength(10)
  })

  it('si ya hay sorteos, un `errorSorteos` rezagado no tapa la tabla', () => {
    montar({ errorSorteos: true })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(filas()).toHaveLength(50)
  })

  it('el error no ocupa el sitio de otra cosa: sin error y sin datos sigue siendo el esqueleto', () => {
    montar({ sorteos: [], ready: false, errorSorteos: false })
    expect(screen.getByRole('status', { name: 'Cargando resultados' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('no depende de `stats`: con `stats` nulo y los sorteos cargados ya se ve todo', () => {
    const { store } = montar()
    expect(store.getSnapshot().stats).toBeNull()
    expect(screen.getByRole('table', { name: 'Sorteos de la Lotería de Panamá' })).toBeInTheDocument()
  })

  it('cuando llegan los sorteos pasa del esqueleto a la pestaña', () => {
    const { store } = montar({ sorteos: [], ready: false })
    act(() => store.cambiar({ sorteos: muchos(10), ready: true }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(filas()).toHaveLength(10)
  })
})

describe('contadores por categoría', () => {
  it('hay un contador del total y uno por categoría, en orden de aparición, con separador de miles', () => {
    montar({ sorteos: muchos(1234) })
    const tarjetas = Array.from(screen.getByRole('region', { name: 'Contadores por categoría' }).querySelectorAll('.stat-card')).map((t) => [t.querySelector('.stat-label')!.textContent, t.querySelector('.stat-value')!.textContent])
    expect(tarjetas).toEqual([
      ['Total Sorteos', (1234).toLocaleString()],
      [catLabel('dominical'), (309).toLocaleString()],
      [catLabel('miercolito'), (309).toLocaleString()],
      [catLabel('gordito'), (308).toLocaleString()],
      [catLabel('extraordinario'), (308).toLocaleString()],
    ])
  })

  it('cada cifra va en un solo nodo de texto (nodos partidos dan anchos distintos en Chromium)', () => {
    montar({ sorteos: muchos(1234) })
    document.querySelectorAll('[aria-label="Contadores por categoría"] .stat-value').forEach((v) => expect(v.childNodes).toHaveLength(1))
  })

  it('los contadores cuentan todos los sorteos, no solo los filtrados', () => {
    montar()
    fireEvent.change(categoria(), { target: { value: 'gordito' } })
    expect(screen.getByText('Total Sorteos').previousElementSibling).toHaveTextContent('120')
  })
})

describe('filtros', () => {
  it('la barra de filtros es una búsqueda con los mismos campos y nombres', () => {
    montar()
    const barra = screen.getByRole('search', { name: 'Filtros de búsqueda' })
    expect(within(barra).getByPlaceholderText('Buscar número…')).toBe(busqueda())
    expect(busqueda()).toHaveAttribute('type', 'search')
    expect(desde()).toHaveAttribute('type', 'date')
    expect(hasta()).toHaveAttribute('type', 'date')
  })

  it('el selector ofrece «Todas las categorías» y las categorías que hay, con su etiqueta', () => {
    montar()
    expect(Array.from(categoria().options).map((o) => [o.value, o.textContent])).toEqual([
      ['all', 'Todas las categorías'],
      ...CATS.map((c) => [c, catLabel(c)]),
    ])
  })

  it('una categoría desconocida entra en el selector con su primera letra en mayúscula', () => {
    montar({ sorteos: [sorteo('1', '2019-10-02', 'rara', '1234')] })
    expect(Array.from(categoria().options).map((o) => o.textContent)).toContain('Rara')
  })

  it('por categoría', () => {
    montar()
    fireEvent.change(categoria(), { target: { value: 'gordito' } })
    expect(filas()).toHaveLength(30)
    filas().forEach((f) => expect(within(f).getByText(catLabel('gordito'))).toBeInTheDocument())
    expect(within(paginacion()).queryAllByRole('button')).toHaveLength(0) // 30 filas caben en una página
  })

  it('con más de una página, el total de resultados es el de lo filtrado', () => {
    montar({ sorteos: muchos(240) })
    fireEvent.change(categoria(), { target: { value: 'gordito' } })
    expect(screen.getByText(`${(60).toLocaleString()} resultados`)).toBeInTheDocument()
    expect(paginaActiva()).toHaveTextContent('1')
  })

  it('por texto, en cualquiera de los tres premios, y se recorta', () => {
    montar({ sorteos: FORMATOS })
    fireEvent.change(busqueda(), { target: { value: '  0074 ' } })
    expect(filas()).toHaveLength(1)
    expect(celdas(filas()[0]!)[3]).toHaveTextContent('0074')
    fireEvent.change(busqueda(), { target: { value: '98' } })
    expect(filas()).toHaveLength(3) // 0098 (3.º), 98 (2.º del gordito: «4321,98») y 98 (1.º del miercolito)
  })

  it('por fechas, inclusivas', () => {
    montar({ sorteos: FORMATOS })
    fireEvent.change(desde(), { target: { value: '2019-09-25' } })
    fireEvent.change(hasta(), { target: { value: '2019-09-29' } })
    expect(filas().map((f) => celdas(f)[2]!.textContent)).toEqual(['3920', '4321'])
  })

  it('los filtros se combinan', () => {
    montar({ sorteos: FORMATOS })
    fireEvent.change(categoria(), { target: { value: 'dominical' } })
    fireEvent.change(busqueda(), { target: { value: '98' } })
    expect(filas()).toHaveLength(1)
    fireEvent.change(busqueda(), { target: { value: '9614' } })
    expect(filas()).toHaveLength(0)
  })

  it('cambiar cualquier filtro vuelve a la página 1', () => {
    montar({ sorteos: muchos(400) }) // 100 por categoría: con cada filtro siguen quedando 2 o más páginas
    fireEvent.click(botonPagina(3))
    expect(paginaActiva()).toHaveTextContent('3')
    fireEvent.change(busqueda(), { target: { value: '1' } })
    expect(paginaActiva()).toHaveTextContent('1')
    fireEvent.click(botonPagina(2))
    fireEvent.change(categoria(), { target: { value: 'dominical' } })
    expect(paginaActiva()).toHaveTextContent('1')
    fireEvent.change(desde(), { target: { value: '2019-01-01' } })
    expect(paginaActiva()).toHaveTextContent('1')
    fireEvent.change(hasta(), { target: { value: '2019-12-31' } })
    expect(paginaActiva()).toHaveTextContent('1')
  })

  it('sin resultados lo dice dentro de la tabla y no hay paginación', () => {
    montar({ sorteos: FORMATOS })
    fireEvent.change(busqueda(), { target: { value: 'zzz' } })
    expect(screen.getByText('No hay resultados con esos filtros.')).toBeInTheDocument()
    expect(within(paginacion()).queryAllByRole('button')).toHaveLength(0)
  })

  it('un filtro por una categoría que no existe tampoco rompe nada', () => {
    montar({ sorteos: FORMATOS })
    fireEvent.change(categoria(), { target: { value: 'dominical' } })
    fireEvent.change(categoria(), { target: { value: 'all' } })
    expect(filas()).toHaveLength(4)
  })
})

describe('la tabla', () => {
  it('es una tabla con nombre, dentro de una región desplazable con foco de teclado, con sus 8 cabeceras', () => {
    montar({ sorteos: FORMATOS })
    const region = screen.getByRole('region', { name: 'Tabla de resultados' })
    expect(region).toHaveAttribute('tabindex', '0')
    expect(region).toHaveClass('table-wrap')
    const cab = within(screen.getByRole('table', { name: 'Sorteos de la Lotería de Panamá' })).getAllByRole('columnheader')
    expect(cab.map((c) => c.textContent)).toEqual(['Fecha', 'Categoría', '1er Premio', '2do Premio', '3er Premio', 'Letras', 'Serie', 'Folio'])
    cab.forEach((c) => expect(c).toHaveAttribute('scope', 'col'))
  })

  it('cada fila lleva la fecha formateada, la categoría con su clase y los tres premios', () => {
    montar({ sorteos: FORMATOS })
    const c = celdas(filas()[0]!)
    expect(c).toHaveLength(8)
    expect(c[0]).toHaveTextContent(formatDate('2019-10-02'))
    const pastilla = c[1]!.querySelector('span')!
    expect(pastilla).toHaveClass('cat-pill', 'cat-extraordinario')
    expect(pastilla).toHaveTextContent(catLabel('extraordinario'))
    expect(c[2]!.querySelector('.prize-chip')).toHaveClass('prize-1')
  })

  it('los premios de 2, 4 y 5 cifras y los vacíos se muestran tal como llegan, sin ceros añadidos (AC4)', () => {
    montar({ sorteos: FORMATOS })
    const premios = filas().map((f) => celdas(f).slice(2, 5).map((c) => c.textContent))
    expect(premios).toEqual([
      ['09614', '—', '—'],
      ['3920', '0074', '0098'],
      ['4321', '98', '07'],
      ['98', '07', '12'],
    ])
  })

  it('cada premio lleva su clase de color y los vacíos, el guion de «sin dato»', () => {
    montar({ sorteos: FORMATOS })
    const c = celdas(filas()[0]!)
    expect(c[2]!.querySelector('.prize-chip.prize-1')).toBeInTheDocument()
    expect(c[3]!.querySelector('.prize-chip')).toBeNull()
    expect(c[3]!.querySelector('.num-empty')).toHaveTextContent('—')
    const d = celdas(filas()[1]!)
    expect(d[3]!.querySelector('.prize-chip.prize-2')).toBeInTheDocument()
    expect(d[4]!.querySelector('.prize-chip.prize-3')).toBeInTheDocument()
    expect(d[2]!.classList.contains('num-cell')).toBe(true)
  })

  it('letras, serie y folio salen en sus fichas, y vacíos con guion', () => {
    montar({ sorteos: FORMATOS })
    const c = celdas(filas()[0]!)
    expect(c.slice(5).map((x) => x.querySelector('.meta-chip')?.textContent)).toEqual(['ABCD', '2', '599'])
    const d = celdas(filas()[1]!)
    expect(d.slice(5).map((x) => x.querySelector('.num-empty')?.textContent)).toEqual(['—', '—', '—'])
  })

  it('una categoría con marcado o fuera de lo normal se escribe como texto y su clase solo lleva caracteres seguros', () => {
    montar({ sorteos: [sorteo('1', '2019-10-02', '<img src=x onerror=alert(1)>', '1234', '5678', '9012', { letra: '<b>A</b>' })] })
    expect(document.querySelector('tbody img, tbody b')).toBeNull()
    const pastilla = celdas(filas()[0]!)[1]!.querySelector('span')!
    expect(pastilla.textContent).toContain('<img src=x onerror=alert(1)>')
    expect(pastilla.className).toMatch(/^cat-pill cat-[a-z0-9_-]*$/)
    expect(celdas(filas()[0]!)[5]!.textContent).toBe('<b>A</b>')
  })

  it('las filas siguen el orden de los datos', () => {
    montar({ sorteos: FORMATOS })
    expect(filas().map((f) => celdas(f)[2]!.textContent)).toEqual(['09614', '3920', '4321', '98'])
  })
})

describe('paginación', () => {
  it('solo 50 filas por página', () => {
    montar()
    expect(filas()).toHaveLength(50)
    fireEvent.click(botonPagina(3))
    expect(filas()).toHaveLength(20)
  })

  it('cada página enseña las filas que le tocan', () => {
    montar()
    fireEvent.click(botonPagina(2))
    expect(celdas(filas()[0]!)[2]).toHaveTextContent('1050')
    expect(celdas(filas().at(-1)!)[2]).toHaveTextContent('1099')
  })

  it('con 50 filas o menos no hay botones de paginación', () => {
    montar({ sorteos: muchos(50) })
    expect(within(paginacion()).queryAllByRole('button')).toHaveLength(0)
    expect(within(paginacion()).queryByText(/resultados/)).not.toBeInTheDocument()
  })

  it('con 51 hay dos páginas', () => {
    montar({ sorteos: muchos(51) })
    expect(botonPagina(2)).toBeInTheDocument()
    expect(filas()).toHaveLength(50)
  })

  it('la navegación se llama «Paginación de resultados» y dice cuántos resultados hay, con separador de miles', () => {
    montar({ sorteos: muchos(1234) })
    expect(within(paginacion()).getByText(`${(1234).toLocaleString()} resultados`)).toHaveClass('page-info')
    expect(within(paginacion()).getByText(`${(1234).toLocaleString()} resultados`).childNodes).toHaveLength(1)
  })

  it('en la primera página «‹» y ««» están desactivados y «›» y «»» no', () => {
    montar()
    const p = within(paginacion())
    expect(p.getByRole('button', { name: 'Primera página' })).toBeDisabled()
    expect(p.getByRole('button', { name: 'Página anterior' })).toBeDisabled()
    expect(p.getByRole('button', { name: 'Página siguiente' })).toBeEnabled()
    expect(p.getByRole('button', { name: 'Última página' })).toBeEnabled()
  })

  it('en la última son «›» y «»» los desactivados', () => {
    montar()
    fireEvent.click(within(paginacion()).getByRole('button', { name: 'Última página' }))
    const p = within(paginacion())
    expect(paginaActiva()).toHaveTextContent('3')
    expect(p.getByRole('button', { name: 'Página siguiente' })).toBeDisabled()
    expect(p.getByRole('button', { name: 'Última página' })).toBeDisabled()
    expect(p.getByRole('button', { name: 'Primera página' })).toBeEnabled()
  })

  it('«›» y «‹» avanzan y retroceden una página; «««» y «»» saltan a los extremos', () => {
    montar()
    const p = within(paginacion())
    fireEvent.click(p.getByRole('button', { name: 'Página siguiente' }))
    expect(paginaActiva()).toHaveTextContent('2')
    fireEvent.click(p.getByRole('button', { name: 'Página siguiente' }))
    expect(paginaActiva()).toHaveTextContent('3')
    fireEvent.click(p.getByRole('button', { name: 'Página anterior' }))
    expect(paginaActiva()).toHaveTextContent('2')
    fireEvent.click(p.getByRole('button', { name: 'Primera página' }))
    expect(paginaActiva()).toHaveTextContent('1')
    fireEvent.click(p.getByRole('button', { name: 'Última página' }))
    expect(paginaActiva()).toHaveTextContent('3')
  })

  it('el botón de la página actual lleva la clase `active` y `aria-current`; los demás, no', () => {
    montar()
    fireEvent.click(botonPagina(2))
    expect(botonPagina(2)).toHaveClass('active')
    expect(botonPagina(2)).toHaveAttribute('aria-current', 'page')
    expect(botonPagina(1)).not.toHaveClass('active')
    expect(botonPagina(1)).not.toHaveAttribute('aria-current')
  })

  it('los botones llevan el texto de antes (« ‹ › » y el número) y la clase page-btn', () => {
    montar()
    const botones = within(paginacion()).getAllByRole('button')
    expect(botones.map((b) => b.textContent)).toEqual(['«', '‹', '1', '2', '3', '›', '»'])
    botones.forEach((b) => expect(b).toHaveClass('page-btn'))
  })

  it('con muchas páginas enseña 3 a cada lado de la actual y «…» donde faltan', () => {
    montar({ sorteos: muchos(1000) }) // 20 páginas
    const textos = () => within(paginacion()).getAllByRole('button').map((b) => b.textContent)
    expect(textos()).toEqual(['«', '‹', '1', '2', '3', '4', '›', '»'])
    expect(Array.from(paginacion().querySelectorAll('.page-info')).map((s) => s.textContent)).toEqual(['…', `${(1000).toLocaleString()} resultados`])
    fireEvent.click(botonPagina(4))
    fireEvent.click(botonPagina(7))
    expect(textos()).toEqual(['«', '‹', '4', '5', '6', '7', '8', '9', '10', '›', '»'])
    expect(paginacion().querySelectorAll('.page-info')).toHaveLength(3) // «…», «…» y el total
    fireEvent.click(within(paginacion()).getByRole('button', { name: 'Última página' }))
    expect(textos()).toEqual(['«', '‹', '17', '18', '19', '20', '›', '»'])
    expect(paginacion().querySelectorAll('.page-info')).toHaveLength(2)
  })

  it('al cambiar de página la tabla vuelve arriba', () => {
    montar()
    const region = screen.getByRole('region', { name: 'Tabla de resultados' })
    Object.defineProperty(region, 'scrollTop', { value: 240, writable: true, configurable: true })
    fireEvent.click(botonPagina(2))
    expect(region.scrollTop).toBe(0)
  })

  it('si los datos se reducen y la página actual ya no existe, se enseña la última', () => {
    const { store } = montar()
    fireEvent.click(botonPagina(3))
    act(() => store.cambiar({ sorteos: muchos(60) }))
    expect(paginaActiva()).toHaveTextContent('2')
    expect(filas()).toHaveLength(10)
  })

  it('no hay botones fuera de rango aunque se fuerce el salto', () => {
    montar()
    fireEvent.click(within(paginacion()).getByRole('button', { name: 'Última página' }))
    fireEvent.click(within(paginacion()).getByRole('button', { name: 'Página siguiente' })) // desactivado: no hace nada
    expect(paginaActiva()).toHaveTextContent('3')
  })
})

describe('exportar CSV', () => {
  const exportar = () => screen.getByRole('button', { name: 'Exportar resultados a CSV' })
  const csvDe = async (i = 0) => crear.blobs[i]!.text()

  it('el botón dice «⬇ Exportar CSV» y es un botón de la barra de acciones', () => {
    montar()
    expect(exportar()).toHaveTextContent('⬇ Exportar CSV')
    expect(exportar()).toHaveClass('btn')
    expect(exportar()).toHaveAttribute('type', 'button')
  })

  it('con la ranura de la cabecera en la plantilla, el botón va dentro de ella (junto al de actualizar, que no es suyo)', () => {
    montar({ ranura: true })
    const ranura = document.getElementById('resultadosCsv')!
    expect(within(ranura).getByRole('button', { name: 'Exportar resultados a CSV' })).toBeInTheDocument()
    expect(document.getElementById('updateBtn')).toBeInTheDocument()
    expect(document.getElementById('updateBtn')!.previousElementSibling).toBe(ranura)
  })

  it('sin la ranura (pruebas, otra plantilla) el botón se pinta en su sitio', () => {
    const { container } = montar()
    expect(container.contains(exportar())).toBe(true)
  })

  it('con la ranura, el botón se quita de ella al desmontar la isla', () => {
    const { unmount } = montar({ ranura: true })
    unmount()
    expect(document.getElementById('resultadosCsv')!.querySelector('button')).toBeNull()
  })

  it('mientras no hay sorteos el botón está desactivado', () => {
    montar({ sorteos: [], ready: false })
    expect(exportar()).toBeDisabled()
  })

  it('descarga TODOS los sorteos filtrados, no solo la página que se ve', async () => {
    montar()
    fireEvent.change(categoria(), { target: { value: 'dominical' } })
    fireEvent.click(exportar())
    const csv = await csvDe()
    expect(csv.trim().split('\n')).toHaveLength(1 + 30) // cabecera y 30 sorteos (120 / 4)
    expect(csv.split('\n')[0]).toBe('Fecha,Categoria,1er Premio,2do Premio,3er Premio,Letras,Serie,Folio')
  })

  it('sin filtros descarga los 120 aunque la tabla enseñe 50', async () => {
    montar()
    fireEvent.click(exportar())
    expect((await csvDe()).trim().split('\n')).toHaveLength(121)
  })

  it('los premios de 2, 4 y 5 cifras y los vacíos salen tal como llegan', async () => {
    montar({ sorteos: FORMATOS })
    fireEvent.click(exportar())
    expect((await csvDe()).split('\n').slice(1, 5)).toEqual([
      '2019-10-02,extraordinario,09614,,,ABCD,2,599',
      '2019-09-29,dominical,3920,0074,0098,,,',
      '2019-09-25,gordito,4321,98,07,,,',
      '2019-09-22,miercolito,98,07,12,,,',
    ])
  })

  it('es un archivo de texto CSV en UTF-8', async () => {
    montar()
    fireEvent.click(exportar())
    expect(crear.blobs[0]!.type).toBe('text/csv;charset=utf-8;')
  })

  it('se descarga con el nombre sorteos_panama_AAAA-MM-DD.csv', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-12T15:30:00Z'))
    montar()
    fireEvent.click(exportar())
    vi.useRealTimers()
    expect(clics).toEqual([{ download: 'sorteos_panama_2026-11-12.csv', href: 'blob:falso' }])
  })

  it('avisa con el número de registros exportados', () => {
    const { store } = montar()
    fireEvent.change(categoria(), { target: { value: 'gordito' } })
    fireEvent.click(exportar())
    expect(avisos(store)).toEqual([['CSV exportado: 30 registros', undefined]])
  })

  it('libera la dirección del archivo a los 40 s, no en el mismo instante ni a los 0 ms (algunos navegadores cortarían la descarga)', () => {
    vi.useFakeTimers()
    montar()
    fireEvent.click(exportar())
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(39_999)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    vi.useRealTimers()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:falso')
  })

  it('sin resultados exporta solo la cabecera y lo dice', async () => {
    const { store } = montar({ sorteos: FORMATOS })
    fireEvent.change(busqueda(), { target: { value: 'zzz' } })
    fireEvent.click(exportar())
    expect(await csvDe()).toBe('Fecha,Categoria,1er Premio,2do Premio,3er Premio,Letras,Serie,Folio\n')
    expect(avisos(store)).toEqual([['CSV exportado: 0 registros', undefined]])
  })

  it('un valor que se leería como fórmula sale con apóstrofo', async () => {
    montar({ sorteos: [sorteo('1', '2019-10-02', 'dominical', '1234', '5678', '9012', { letra: '=HYPERLINK("http://x")' })] })
    fireEvent.click(exportar())
    expect((await csvDe()).split('\n')[1]).toContain(`"'=HYPERLINK(""http://x"")"`)
  })
})

describe('con la pestaña viva', () => {
  it('si tras recargar los datos desaparece la categoría elegida, el selector y la tabla vuelven a «Todas las categorías»', () => {
    const { store } = montar()
    fireEvent.change(categoria(), { target: { value: 'gordito' } })
    expect(filas()).toHaveLength(30)
    act(() => store.cambiar({ sorteos: muchos(120).filter((s) => s.cat !== 'gordito') }))
    expect(categoria().value).toBe('all')
    expect(screen.getByText(`${(90).toLocaleString()} resultados`)).toBeInTheDocument()
    expect(filas()).toHaveLength(50)
    expect(screen.queryByText('No hay resultados con esos filtros.')).not.toBeInTheDocument()
  })

  it('cuando se recargan los sorteos mantiene los filtros', () => {
    const { store } = montar()
    fireEvent.change(categoria(), { target: { value: 'gordito' } })
    act(() => store.cambiar({ sorteos: muchos(240) }))
    expect(categoria().value).toBe('gordito')
    expect(screen.getByText(`${(60).toLocaleString()} resultados`)).toBeInTheDocument()
  })

  it('en modo estricto se pinta una sola vez la cabecera de acciones', () => {
    montar({ estricto: true, ranura: true })
    expect(document.getElementById('resultadosCsv')!.querySelectorAll('button')).toHaveLength(1)
  })
})
