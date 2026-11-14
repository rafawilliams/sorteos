import { readFileSync } from 'node:fs'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Sorteo, Stats } from '../api/types'
import { fmtLift, formatDate } from '../lib/formato'
import { StoreProvider } from '../store/StoreProvider'
import { crearStoreFalso } from '../store/storeFalso'
import type { Snapshot } from '../store/tipos'
import { Componente, nombre } from './PrediccionesResumen'

const STATS: Stats = JSON.parse(readFileSync('fixtures/stats.json', 'utf-8'))
const SORTEOS: Sorteo[] = JSON.parse(readFileSync('fixtures/sorteos.json', 'utf-8')).data
const ULTIMO = SORTEOS[0]!

const sorteo = (extra: Partial<Sorteo>): Sorteo => ({ ...ULTIMO, ...extra })

function montar(estado: Partial<Snapshot> = {}) {
  const store = crearStoreFalso({ activeTab: 'predicciones' as never, stats: STATS, sorteos: SORTEOS, ready: true, ...estado })
  const vista = render(
    <StoreProvider store={store}>
      <Componente />
    </StoreProvider>,
  )
  return { store, ...vista }
}
const texto = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
const resumen = () => screen.getByRole('region', { name: 'Resumen rápido' })
const kpi = (rotulo: string) => Array.from(resumen().querySelectorAll('.kpi-card')).find((k) => texto(k.querySelector('.kpi-label')) === rotulo) as HTMLElement
const caja = (n: number) => resumen().querySelector(`.prize-box-${n}`) as HTMLElement
const bolas = (el: Element) => el.querySelector('.lotto-balls') as HTMLElement

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2019-10-05T12:00:00'))
})
afterEach(() => vi.useRealTimers())

describe('isla Predicciones: panel de resumen', () => {
  it('se llama «predicciones-resumen»', () => {
    expect(nombre).toBe('predicciones-resumen')
  })

  it('sin estadísticas enseña el esqueleto de carga', () => {
    montar({ stats: null })
    expect(screen.getByRole('status', { name: 'Cargando resumen' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Resumen rápido' })).toBeNull()
  })

  it('con la carga de estadísticas fallida no pinta aviso ni esqueleto: el aviso con «Reintentar» lo da la lista de recomendaciones, justo debajo', () => {
    montar({ stats: null, errorStats: true })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Resumen rápido' })).toBeNull()
  })

  it('sin sorteos tampoco hay resumen: esqueleto', () => {
    montar({ sorteos: [], ready: false })
    expect(screen.getByRole('status', { name: 'Cargando resumen' })).toBeTruthy()
  })

  describe('error de carga de los sorteos', () => {
    it('si /api/sorteos falla y no hay ninguno, avisa y ofrece reintentar en vez de quedarse en el esqueleto', () => {
      montar({ sorteos: [], ready: false, errorSorteos: true })
      expect(texto(screen.getByRole('alert'))).toContain('No se pudo cargar el último sorteo.')
      expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
      expect(screen.queryByRole('status', { name: 'Cargando resumen' })).toBeNull()
    })

    it('también avisa aunque las estadísticas no hayan llegado', () => {
      montar({ stats: null, sorteos: [], ready: false, errorSorteos: true })
      expect(screen.getByRole('alert')).toBeTruthy()
    })

    it('«Reintentar» pide recargar y deja el foco en el contenedor (el botón desaparece al reintentar)', async () => {
      const { store } = montar({ sorteos: [], ready: false, errorSorteos: true })
      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
      expect(store.llamadas.filter((l) => l.accion === 'reload')).toHaveLength(1)
      expect((document.activeElement as HTMLElement).getAttribute('tabindex')).toBe('-1')
    })

    it('al reintentar (errorSorteos vuelve a false) se ve el esqueleto y, al llegar los datos, el resumen', () => {
      const { store } = montar({ sorteos: [], ready: false, errorSorteos: true })
      act(() => store.cambiar({ errorSorteos: false }))
      expect(screen.getByRole('status', { name: 'Cargando resumen' })).toBeTruthy()
      act(() => store.cambiar({ sorteos: SORTEOS, ready: true }))
      expect(screen.getByRole('region', { name: 'Resumen rápido' })).toBeTruthy()
    })

    it('con sorteos ya cargados el error se ignora (un fallo al recargar no tapa el resumen)', () => {
      montar({ errorSorteos: true })
      expect(screen.getByRole('region', { name: 'Resumen rápido' })).toBeTruthy()
      expect(screen.queryByRole('alert')).toBeNull()
    })
  })

  describe('último sorteo', () => {
    it('enseña la categoría, el título y la fecha del primer sorteo de la lista', () => {
      montar()
      const tarjeta = resumen().querySelector('.last-draw-card')!
      const pastilla = tarjeta.querySelector('.cat-pill')!
      expect(pastilla.className).toBe(`cat-pill cat-${ULTIMO.cat}`)
      expect(texto(tarjeta.querySelector('.last-draw-title'))).toContain('Último Sorteo Oficial')
      expect(texto(tarjeta.querySelector('.last-draw-date'))).toBe(formatDate(ULTIMO.fecha))
    })

    it('la etiqueta de la categoría es la de siempre y una desconocida lleva la inicial en mayúscula', () => {
      montar({ sorteos: [sorteo({ cat: 'gordito' }), ...SORTEOS.slice(1)] })
      expect(texto(resumen().querySelector('.cat-pill'))).toBe('Gordito del Zodiaco')
    })

    it('una categoría con marcado no rompe la clase ni el texto', () => {
      montar({ sorteos: [sorteo({ cat: '<b onclick=x>' as never })] })
      const pastilla = resumen().querySelector('.cat-pill')!
      expect(pastilla.className).toBe('cat-pill cat-bonclickx')
      expect(resumen().querySelector('b')).toBeNull()
    })

    it('los tres premios van en esferas medianas: dorada, verde y morada', () => {
      montar({ sorteos: [sorteo({ primero: '9541', segundo: '0074', tercero: '2208' })] })
      for (const [n, variante, valor, titulo] of [
        [1, 'gold', '9541', '1er Premio'],
        [2, 'green', '0074', '2do Premio'],
        [3, 'purple', '2208', '3er Premio'],
      ] as const) {
        expect(caja(n).getAttribute('title')).toBe(titulo)
        expect(texto(caja(n).querySelector('.last-draw-prize-label'))).toBe(titulo)
        expect(bolas(caja(n)).getAttribute('aria-label')).toBe(valor)
        expect(bolas(caja(n)).classList.contains('lotto-balls-md')).toBe(true)
        expect(bolas(caja(n)).querySelectorAll(`.ball-${variante}`)).toHaveLength(valor.length)
      }
    })

    it('los premios se enseñan tal como llegan: 2 cifras, 5 cifras y vacío (guion)', () => {
      montar({ sorteos: [sorteo({ primero: '05309', segundo: '98', tercero: '' })] })
      expect(bolas(caja(1)).getAttribute('aria-label')).toBe('05309')
      expect(bolas(caja(2)).getAttribute('aria-label')).toBe('98')
      expect(caja(3).querySelector('.lotto-balls')).toBeNull()
      expect(texto(caja(3).querySelector('.num-empty'))).toBe('—')
    })

    it('letras, serie y folio, con guion si faltan', () => {
      montar({ sorteos: [sorteo({ letra: 'AB', serie: '12', folio: '34' })] })
      expect(texto(resumen().querySelector('.last-draw-meta'))).toBe('Letras: ABSerie: 12Folio: 34')
    })

    it('sin letras, serie ni folio enseña «—» en los tres', () => {
      montar({ sorteos: [sorteo({ letra: '', serie: '', folio: '' })] })
      expect(texto(resumen().querySelector('.last-draw-meta'))).toBe('Letras: —Serie: —Folio: —')
    })
  })

  describe('indicadores', () => {
    it('Top Recomendación: la primera estadística, en esfera dorada pequeña, con su «×N azar»', () => {
      montar()
      const r = STATS.recommendations[0]!
      const t = kpi('Top Recomendación')
      expect(bolas(t).getAttribute('aria-label')).toBe(r.number)
      expect(bolas(t).classList.contains('lotto-balls-sm')).toBe(true)
      expect(bolas(t).querySelector('.ball-gold')).toBeTruthy()
      expect(texto(t.querySelector('.kpi-sub'))).toBe(`📊 Estadístico · ${fmtLift(r.confidence)}`)
    })

    it('Top ML: la primera de ML, en verde', () => {
      montar()
      const r = STATS.ml_recommendations[0]!
      const t = kpi('Top ML')
      expect(bolas(t).getAttribute('aria-label')).toBe(r.number)
      expect(bolas(t).querySelector('.ball-green')).toBeTruthy()
      expect(texto(t.querySelector('.kpi-sub'))).toBe(`🤖 Machine Learning · ${fmtLift(r.confidence)}`)
    })

    it('sin recomendaciones enseña guion en la esfera y en la confianza', () => {
      montar({ stats: { ...STATS, recommendations: [], ml_recommendations: [] } })
      for (const [rotulo, sub] of [
        ['Top Recomendación', '📊 Estadístico · —'],
        ['Top ML', '🤖 Machine Learning · —'],
      ] as const) {
        expect(texto(kpi(rotulo).querySelector('.num-empty'))).toBe('—')
        expect(texto(kpi(rotulo).querySelector('.kpi-sub'))).toBe(sub)
      }
    })

    it('con el modelo sin entrenar (ml_recommendations ausente) no falla', () => {
      montar({ stats: { ...STATS, ml_recommendations: undefined as never } })
      expect(texto(kpi('Top ML').querySelector('.num-empty'))).toBe('—')
    })

    it('Terminación Caliente: la más repetida del año en curso, en esfera «hot» pequeña', () => {
      const lista = [sorteo({ fecha: '2019-09-22', primero: '1134', segundo: '0034', tercero: '0099' }), sorteo({ fecha: '2018-01-01', primero: '0077', segundo: '0077', tercero: '0077' })]
      montar({ sorteos: lista })
      const t = kpi('Terminación Caliente')
      expect(bolas(t).getAttribute('aria-label')).toBe('34')
      expect(bolas(t).querySelector('.ball-hot')).toBeTruthy()
      expect(bolas(t).classList.contains('lotto-balls-sm')).toBe(true)
      expect(texto(t.querySelector('.kpi-sub'))).toBe('🔥 2 veces en 2019')
    })

    it('el año sale de la fecha de hoy', () => {
      vi.setSystemTime(new Date('2018-03-01T12:00:00'))
      montar({ sorteos: [sorteo({ fecha: '2018-01-01', primero: '0077', segundo: '0000', tercero: '' }), sorteo({ fecha: '2019-01-01', primero: '0099' })] })
      expect(texto(kpi('Terminación Caliente').querySelector('.kpi-sub'))).toBe('🔥 1 veces en 2018')
    })

    it('sin sorteos del año enseña «00» con 0 veces', () => {
      montar({ sorteos: [sorteo({ fecha: '2001-01-01' })] })
      const t = kpi('Terminación Caliente')
      expect(bolas(t).getAttribute('aria-label')).toBe('00')
      expect(texto(t.querySelector('.kpi-sub'))).toBe('🔥 0 veces en 2019')
    })

    it('Total Sorteos: el total de las estadísticas con separador de miles y el historial desde 1919', () => {
      montar({ stats: { ...STATS, total_sorteos: 9296 } })
      const t = kpi('Total Sorteos')
      expect(texto(t.querySelector('.stat-value'))).toBe((9296).toLocaleString())
      expect(texto(t.querySelector('.kpi-sub'))).toBe('Historial desde 1919')
    })

    it('con un total de 0 enseña «0» y sin total enseña «—»', () => {
      montar({ stats: { ...STATS, total_sorteos: 0 } })
      expect(texto(kpi('Total Sorteos').querySelector('.stat-value'))).toBe('0')
    })

    it('sin total en las estadísticas enseña «—»', () => {
      montar({ stats: { ...STATS, total_sorteos: undefined as never } })
      expect(texto(kpi('Total Sorteos').querySelector('.stat-value'))).toBe('—')
    })

    it('hay exactamente cuatro indicadores, en este orden', () => {
      montar()
      expect(Array.from(resumen().querySelectorAll('.kpi-card .kpi-label')).map((l) => texto(l))).toEqual(['Top Recomendación', 'Top ML', 'Terminación Caliente', 'Total Sorteos'])
    })
  })

  it('el marcado conserva las clases de la hoja de estilos', () => {
    montar()
    expect(resumen().querySelector('.dashboard-hero-grid > .last-draw-card')).toBeTruthy()
    expect(resumen().querySelector('.dashboard-hero-grid > .dashboard-kpis')).toBeTruthy()
    expect(within(resumen()).getAllByText(/Premio/).length).toBeGreaterThanOrEqual(3)
  })
})
