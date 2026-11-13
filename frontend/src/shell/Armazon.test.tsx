import { readFileSync } from 'node:fs'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Sorteo, Stats } from '../api/types'
import { formatDate } from '../lib/formato'
import { StoreProvider } from '../store/StoreProvider'
import { crearReactStore, URL_SORTEOS, URL_STATS, type ReactStore } from '../store/reactStore'
import { TABS } from '../store/tipos'
import { Armazon } from './Armazon'

// Chart.js no pinta en jsdom: el componente se sustituye por un doble.
vi.mock('../components/Chart', () => ({
  Chart: (props: Record<string, unknown>) => <div role="img" aria-label={String(props.etiqueta)} />,
}))

const STATS: Stats = JSON.parse(readFileSync('fixtures/stats.json', 'utf-8'))
const SORTEOS: Sorteo[] = JSON.parse(readFileSync('fixtures/sorteos.json', 'utf-8')).data

const TITULOS: Record<string, string> = {
  predicciones: 'Números Recomendados',
  decenas: 'Decena Recomendada',
  terminaciones: 'Análisis de Últimos 2 Dígitos',
  resultados: 'Resultados Recientes',
  estadisticas: 'Estadísticas Generales',
  tendencias: 'Tendencias Temporales',
  analisis: 'Análisis por Posición',
  comparador: 'Comparador de Números',
  gaps: 'Análisis de Gaps',
  simulador: 'Simulador: ¿Cuánto habría ganado?',
  favoritos: 'Mis Números Favoritos',
  mensual: 'Recomendación Mensual',
  seguimiento: 'Seguimiento de Recomendaciones',
  precision: 'Precisión Histórica',
}

let store: ReactStore
let cargaSorteos: Promise<void>
let soltarStats: () => void

/** Una red falsa: sorteos y estadísticas de las fixtures; la de estadísticas espera a que la prueba la suelte si se pide. */
function red({ retenerStats = false, ultimaActualizacion }: { retenerStats?: boolean; ultimaActualizacion?: string } = {}) {
  const puerta = new Promise<void>((r) => (soltarStats = r))
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === URL_SORTEOS) return new Response(JSON.stringify({ data: SORTEOS }))
      if (url === URL_STATS) {
        if (retenerStats) await puerta
        return new Response(JSON.stringify(ultimaActualizacion ? { ...STATS, last_update: ultimaActualizacion } : STATS))
      }
      return new Response(JSON.stringify({ error: 'no simulado' }), { status: 404 })
    }),
  )
}

async function montar(opciones: Parameters<typeof red>[0] = {}, cargar = true) {
  red(opciones)
  store = crearReactStore()
  const vista = render(
    <StoreProvider store={store}>
      <Armazon />
    </StoreProvider>,
  )
  if (cargar) {
    cargaSorteos = store.cargar()
    if (!opciones.retenerStats) await act(async () => cargaSorteos)
  }
  return vista
}

const seccion = (id: string) => document.getElementById(`sec-${id}`)!
const texto = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  document.body.className = ''
  document.body.innerHTML = '<div id="toast"></div>'
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('armazón: estructura', () => {
  it('trae el enlace de salto, el botón del menú y dentro de .app el fondo, la cabecera, la barra, el contenido y el pie', async () => {
    const { container } = await montar()
    const app = container.querySelector('.app')!
    expect(Array.from(app.children).map((el) => el.id || el.tagName.toLowerCase())).toEqual(['menuBackdrop', 'header', 'navTabs', 'content', 'footerText'])
    expect(container.firstElementChild).toBe(screen.getByRole('link', { name: 'Saltar al contenido principal' }))
    expect(container.querySelector('#menuToggle')!.parentElement).toBe(container)
  })

  it('el enlace de salto es lo primero que alcanza Tab y apunta al contenido, que acepta el foco sin ser un control', async () => {
    await montar()
    await userEvent.tab()
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Saltar al contenido principal' }))
    const principal = document.getElementById('content')!
    expect(principal.tagName).toBe('MAIN')
    expect(principal.getAttribute('tabindex')).toBe('-1') // sin el atributo jsdom también daría -1: se mira el atributo
    expect(principal.style.outlineStyle).toBe('none')
  })

  it('hay 14 pestañas y 14 secciones: cada sección es el panel de su pestaña', async () => {
    await montar()
    expect(within(screen.getByRole('tablist', { name: 'Secciones principales' })).getAllByRole('tab')).toHaveLength(14)
    for (const id of TABS) {
      const panel = seccion(id)
      expect(panel).toHaveAttribute('role', 'tabpanel')
      expect(panel).toHaveAttribute('aria-labelledby', `tab-${id}`)
      expect(panel).toHaveClass('section')
      expect(document.getElementById(`tab-${id}`)).toHaveAttribute('aria-controls', `sec-${id}`)
    }
  })

  it('cada sección lleva su título y su subtítulo', async () => {
    await montar()
    for (const id of TABS) {
      const h2 = seccion(id).querySelector('h2.section-title')!
      expect(texto(h2), id).toBe(TITULOS[id])
      expect(seccion(id).querySelector('.section-subtitle'), id).not.toBeNull()
    }
  })

  it('el subtítulo de Seguimiento resalta «antes» y el de Gaps conserva las comillas', async () => {
    await montar()
    expect(seccion('seguimiento').querySelector('.section-subtitle strong')!.textContent).toBe('antes')
    expect(texto(seccion('gaps').querySelector('.section-subtitle'))).toContain('están "vencidos"')
  })

  it('al empezar solo Predicciones está activa', async () => {
    await montar()
    const activas = Array.from(document.querySelectorAll('.section.active')).map((s) => s.id)
    expect(activas).toEqual(['sec-predicciones'])
  })

  it('elegir una pestaña activa su sección y desactiva la anterior', async () => {
    await montar()
    await userEvent.click(screen.getByRole('tab', { name: 'Decenas' }))
    expect(Array.from(document.querySelectorAll('.section.active')).map((s) => s.id)).toEqual(['sec-decenas'])
    await userEvent.click(screen.getByRole('tab', { name: 'Precisión' }))
    expect(Array.from(document.querySelectorAll('.section.active')).map((s) => s.id)).toEqual(['sec-precision'])
  })

  it('las 14 secciones están montadas desde el principio, aunque solo se vea una', async () => {
    await montar()
    expect(document.querySelectorAll('section.section')).toHaveLength(14)
    expect(seccion('decenas').querySelector('.decena-card')).not.toBeNull() // Decenas ya tiene su contenido aunque esté oculta
  })

  it('el cambio de pestaña desde el Store (botón «Simular») activa su sección', async () => {
    await montar()
    act(() => store.actions.simularNumero('0042'))
    expect(Array.from(document.querySelectorAll('.section.active')).map((s) => s.id)).toEqual(['sec-simulador'])
  })
})

describe('armazón: cabeceras de sección', () => {
  it('Predicciones: resumen, título, recomendaciones y la tarjeta «¿Cómo funciona?» con su aviso', async () => {
    await montar()
    const s = seccion('predicciones')
    expect(Array.from(s.children).map((c) => c.tagName)).toEqual(expect.arrayContaining(['DIV', 'H2', 'P']))
    const tarjeta = within(s).getByRole('heading', { name: '¿Cómo funciona?' }).closest('.card') as HTMLElement
    expect(tarjeta).toHaveClass('reveal')
    expect(tarjeta.style.marginTop).toBe('28px')
    expect(texto(tarjeta.querySelector('.card-badge'))).toBe('Metodología')
    expect(texto(tarjeta)).toContain('frecuencia de dígitos por posición')
    expect(texto(tarjeta)).toContain('desde 1995 hasta la fecha')
    expect(texto(tarjeta)).toContain('⚠ Nota: La lotería es un juego de azar.')
    expect(Array.from(tarjeta.querySelectorAll('strong')).map((x) => x.textContent)).toEqual(['frecuencia de dígitos por posición', 'pesos de recencia', 'probabilidad exacta', 'desde 1995 hasta la fecha'])
  })

  it('Terminaciones: el interruptor ML va a la derecha del título y cambia el modo de toda la app', async () => {
    await montar()
    const s = seccion('terminaciones')
    const interruptor = within(s).getByRole('button', { name: 'Alternar entre modelo ML y Estadístico' })
    expect(interruptor).toHaveAttribute('aria-pressed', 'false')
    expect(interruptor.textContent).toBe('📊 Estadístico')
    expect(interruptor.previousElementSibling!.querySelector('h2')!.textContent).toBe('Análisis de Últimos 2 Dígitos')
    await userEvent.click(interruptor)
    expect(store.getSnapshot().useML).toBe(true)
    expect(interruptor).toHaveAttribute('aria-pressed', 'true')
    expect(interruptor.textContent).toBe('🤖 ML Activo')
    // el de Predicciones es otro botón del mismo estado
    const deprediccion = within(seccion('predicciones')).getByRole('button', { name: 'Alternar entre modelo ML y Estadístico' })
    expect(deprediccion).toHaveAttribute('aria-pressed', 'true')
  })

  it('Resultados: «Actualizar datos» a la derecha y «Exportar CSV» en su ranura, delante', async () => {
    await montar()
    const s = seccion('resultados')
    const actualizar = within(s).getByRole('button', { name: 'Actualizar datos de sorteos' })
    expect(actualizar.id).toBe('updateBtn')
    const ranura = s.querySelector('#resultadosCsv') as HTMLElement
    expect(ranura.style.display).toBe('contents')
    expect(ranura.nextElementSibling).toBe(actualizar)
    await waitFor(() => expect(within(ranura).getByRole('button', { name: 'Exportar resultados a CSV' })).toBeInTheDocument())
    expect(s.querySelector('.section-header')).not.toBeNull()
  })

  it('«Actualizar datos» pide el token y llama a POST /api/actualizar con él', async () => {
    await montar()
    const fn = globalThis.fetch as ReturnType<typeof vi.fn>
    vi.stubGlobal('prompt', vi.fn(() => 'secreto'))
    fn.mockImplementation(async (url: string) => (url === '/api/actualizar' ? new Response(JSON.stringify({ ok: true, ml_retrained: true })) : new Response(JSON.stringify(url === URL_SORTEOS ? { data: SORTEOS } : STATS))))
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar datos de sorteos' }))
    expect(fn).toHaveBeenCalledWith('/api/actualizar', { method: 'POST', headers: { 'X-Update-Token': 'secreto' } })
    await waitFor(() => expect(document.getElementById('toast')!.textContent).toBe('Datos actualizados correctamente'))
  })
})

describe('armazón: cabecera y pie', () => {
  const ultima = () => document.getElementById('lastUpdate')!
  const pie = () => document.getElementById('footerText')!

  it('la cabecera lleva el título, la frase, la insignia oculta a los lectores y el botón de tema', async () => {
    await montar()
    const h = document.querySelector('header.hero')!
    expect(h.querySelector('h1')!.textContent).toBe('Sorteos & Predicciones')
    expect(texto(h.querySelector('p'))).toBe('Consulta resultados, analiza tendencias estadísticas y descubre los números con mayor probabilidad para el próximo sorteo.')
    expect(h.querySelector('.hero-badge')).toHaveAttribute('aria-hidden', 'true')
    expect(texto(h.querySelector('.hero-badge'))).toBe('En vivo — Lotería de Panamá')
    expect(h.querySelector('#themeToggle')).not.toBeNull()
    expect((h as HTMLElement).style.position).toBe('relative')
  })

  it('antes de cargar nada, la fecha está vacía y el pie es el texto base', async () => {
    await montar({}, false)
    expect(ultima().textContent).toBe('')
    expect(ultima()).toHaveAttribute('role', 'status')
    expect(ultima()).toHaveAttribute('aria-live', 'polite')
    expect(pie().textContent).toBe('Lotería de Panamá — Análisis Estadístico © 2026')
    expect(pie()).toHaveAttribute('role', 'contentinfo')
  })

  it('con los sorteos cargados y las estadísticas todavía en camino usa la fecha del primer sorteo', async () => {
    await montar({ retenerStats: true })
    await waitFor(() => expect(store.getSnapshot().ready).toBe(true))
    expect(store.getSnapshot().stats).toBeNull()
    expect(ultima().textContent).toBe(`Última actualización: ${formatDate(SORTEOS[0]!.fecha)}`)
    await act(async () => {
      soltarStats()
      await cargaSorteos
    })
  })

  it('con las estadísticas cargadas usa su last_update y el pie cuenta los sorteos con espacios duros alrededor del punto', async () => {
    await montar({ ultimaActualizacion: '2026-01-15' })
    expect(ultima().textContent).toBe(`Última actualización: ${formatDate('2026-01-15')}`)
    expect(pie().textContent).toBe(`Lotería de Panamá — Análisis Estadístico © 2026  ·  ${SORTEOS.length.toLocaleString()} sorteos históricos  ·  Actualizado: ${formatDate('2026-01-15')}`)
  })

  it('con mil sorteos o más el pie separa los miles', async () => {
    const muchos = Array.from({ length: 1234 }, (_, i) => ({ ...SORTEOS[0]!, id: String(i) }))
    red()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => new Response(JSON.stringify(url === URL_SORTEOS ? { data: muchos } : STATS))),
    )
    store = crearReactStore()
    render(
      <StoreProvider store={store}>
        <Armazon />
      </StoreProvider>,
    )
    await act(async () => store.cargar())
    expect(pie().textContent).toContain(`${(1234).toLocaleString()} sorteos históricos`)
    expect(pie().textContent).not.toContain(' 1234 ')
  })

  it('el botón de tema cambia el documento y su texto', async () => {
    await montar()
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar tema claro/oscuro' }))
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(texto(screen.getByRole('button', { name: 'Cambiar tema claro/oscuro' }))).toBe('🌙 Oscuro')
  })
})

describe('armazón: menú lateral', () => {
  it('con el menú abierto la cabecera, el contenido y el pie son inertes y la barra no', async () => {
    await montar()
    fireEvent.click(document.getElementById('menuToggle')!)
    expect(document.querySelector('header.hero')).toHaveAttribute('inert')
    expect(document.getElementById('content')).toHaveAttribute('inert')
    expect(document.getElementById('footerText')).toHaveAttribute('inert')
    expect(document.getElementById('navTabs')).not.toHaveAttribute('inert')
    expect(document.getElementById('navTabs')).toHaveClass('open')
    fireEvent.click(document.getElementById('menuBackdrop')!)
    expect(document.getElementById('content')).not.toHaveAttribute('inert')
    expect(document.activeElement).toBe(document.getElementById('menuToggle'))
  })

  it('elegir una sección con el menú abierto la muestra y cierra el menú', async () => {
    await montar()
    fireEvent.click(document.getElementById('menuToggle')!)
    await userEvent.click(screen.getByRole('tab', { name: 'Análisis' }))
    expect(seccion('analisis')).toHaveClass('active')
    expect(document.getElementById('navTabs')).not.toHaveClass('open')
  })
})
