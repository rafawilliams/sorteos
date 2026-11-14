import { readFileSync } from 'node:fs'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Stats } from '../api/types'
import { StoreProvider } from '../store/StoreProvider'
import { crearStoreFalso } from '../store/storeFalso'
import type { Snapshot } from '../store/tipos'
import { Componente, nombre } from './Analisis'

const STATS: Stats = JSON.parse(readFileSync('fixtures/stats.json', 'utf-8'))
const POS = STATS.position_frequency

function montar(estado: Partial<Snapshot> = {}) {
  const store = crearStoreFalso({ activeTab: 'analisis' as never, stats: STATS, ready: true, ...estado })
  return render(
    <StoreProvider store={store}>
      <Componente />
    </StoreProvider>,
  )
}
const texto = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
const rejilla = () => screen.getByRole('region', { name: 'Grids de frecuencia por posición' })
const tabla = () => document.querySelector('table.heatmap-table') as HTMLTableElement
const celdas = () => Array.from(tabla().querySelectorAll('tbody td:not(:first-child)')) as HTMLElement[]

describe('isla Análisis: estados', () => {
  it('se llama «analisis», como el data-tab de su pestaña', () => {
    expect(nombre).toBe('analisis')
  })

  it('sin estadísticas enseña el esqueleto de carga y ninguna tarjeta', () => {
    montar({ stats: null })
    expect(screen.getByRole('status', { name: 'Cargando análisis' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Grids de frecuencia por posición' })).toBeNull()
  })

  it('con la carga de estadísticas fallida dice que no se pudo y ofrece reintentar, sin esqueleto', () => {
    montar({ stats: null, errorStats: true })
    expect(screen.getByRole('alert').textContent).toContain('No se pudieron cargar las estadísticas.')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('sin frecuencias por posición deja la rejilla vacía y la tarjeta del mapa sin tabla', () => {
    montar({ stats: { ...STATS, position_frequency: [] } })
    expect(rejilla().children).toHaveLength(0)
    expect(screen.getByRole('heading', { name: 'Mapa de Calor — Posición vs Dígito' })).toBeTruthy()
    expect(document.querySelector('table')).toBeNull()
  })

  it('con position_frequency ausente tampoco falla', () => {
    montar({ stats: { ...STATS, position_frequency: undefined as never } })
    expect(rejilla().children).toHaveLength(0)
  })
})

describe('isla Análisis: cuadrículas por posición', () => {
  it('hay una tarjeta por posición, con su nombre y su insignia «Pos N»', () => {
    montar()
    const tarjetas = Array.from(rejilla().querySelectorAll('.card.reveal'))
    expect(tarjetas.map((t) => [texto(t.querySelector('.card-title')), texto(t.querySelector('.card-badge'))])).toEqual([
      ['Millares', 'Pos 1'],
      ['Centenas', 'Pos 2'],
      ['Decenas', 'Pos 3'],
      ['Unidades', 'Pos 4'],
    ])
    expect(tarjetas.every((t) => t.querySelector('.card-badge')!.classList.contains('badge-gold'))).toBe(true)
  })

  it('cada tarjeta enseña los dígitos con su conteo y un title con posición, dígito y veces', () => {
    montar()
    const primera = rejilla().querySelector('.card')!
    const cs = Array.from(primera.querySelectorAll('.pos-cell')) as HTMLElement[]
    const esperado = Object.entries(POS[0]!)
    expect(cs).toHaveLength(esperado.length)
    esperado.forEach(([d, c], i) => {
      expect(texto(cs[i])).toBe(`${d}${c}`)
      expect(cs[i]!.title).toBe(`Millares: dígito ${d} — ${c} veces`)
    })
  })

  it('el fondo crece con la frecuencia: la máxima da 0.65 y la mínima se queda por encima de 0.05', () => {
    montar()
    const cs = Array.from(rejilla().querySelector('.card')!.querySelectorAll('.pos-cell')) as HTMLElement[]
    const valores = Object.values(POS[0]!)
    const max = Math.max(...valores)
    const iMax = valores.indexOf(max)
    expect(cs[iMax]!.style.background).toBe('rgba(212, 175, 55, 0.65)')
    expect(cs[iMax]!.style.color).toBe('var(--bg-deep)')
    const iMin = valores.indexOf(Math.min(...valores))
    expect(cs[iMin]!.style.background).toBe(`rgba(212, 175, 55, ${(Math.min(...valores) / max * 0.6 + 0.05).toFixed(2)})`)
  })

  it('en el tema claro el texto de las celdas intensas es blanco', () => {
    montar({ theme: 'light' })
    const cs = Array.from(rejilla().querySelector('.card')!.querySelectorAll('.pos-cell')) as HTMLElement[]
    const valores = Object.values(POS[0]!)
    expect(cs[valores.indexOf(Math.max(...valores))]!.style.color).toBe('rgb(255, 255, 255)')
  })

  it('con menos de cuatro posiciones usa el nombre que haya y no inventa otras', () => {
    montar({ stats: { ...STATS, position_frequency: POS.slice(0, 2) } })
    expect(rejilla().querySelectorAll('.card')).toHaveLength(2)
  })

  it('con más de cuatro posiciones la quinta lleva un nombre genérico', () => {
    montar({ stats: { ...STATS, position_frequency: [...POS, POS[0]!] } })
    const titulos = Array.from(rejilla().querySelectorAll('.card-title')).map((t) => texto(t))
    expect(titulos.at(-1)).toBe('Posición 5')
  })
})

describe('isla Análisis: mapa de calor', () => {
  it('la tabla tiene una columna por dígito y una fila por posición', () => {
    montar()
    expect(Array.from(tabla().querySelectorAll('thead th')).map((t) => texto(t))).toEqual(['Posición', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])
    const filas = Array.from(tabla().querySelectorAll('tbody tr'))
    expect(filas.map((f) => texto(f.querySelector('td')))).toEqual(['Millares', 'Centenas', 'Decenas', 'Unidades'])
    expect(celdas()).toHaveLength(40)
  })

  it('cada celda enseña el conteo (0 si falta) y su title', () => {
    montar()
    const c = celdas()
    POS.forEach((pos, i) => {
      for (let d = 0; d < 10; d++) {
        const v = pos[String(d)] || 0
        expect(texto(c[i * 10 + d])).toBe(String(v))
        expect(c[i * 10 + d]!.title).toBe(`${['Millares', 'Centenas', 'Decenas', 'Unidades'][i]} dígito ${d}: ${v}`)
      }
    })
  })

  it('la leyenda da el máximo global y la clase cell-peak marca el 90 % o más', () => {
    montar()
    const maximo = Math.max(...POS.flatMap((p) => Object.values(p)))
    expect(texto(document.querySelector('.heatmap-legend'))).toBe(`Menor frec.Mayor frec. (máx: ${maximo})`)
    expect(document.querySelector('.heatmap-legend')!.getAttribute('aria-hidden')).toBe('true')
    expect(document.querySelectorAll('.heatmap-swatch')).toHaveLength(3)
    const picos = celdas().filter((c) => c.classList.contains('cell-peak'))
    expect(picos.length).toBeGreaterThan(0)
    picos.forEach((c) => expect(Number(texto(c))).toBeGreaterThanOrEqual(maximo * 0.9))
    celdas().filter((c) => !c.classList.contains('cell-peak')).forEach((c) => expect(Number(texto(c))).toBeLessThan(maximo * 0.9))
  })

  it('el fondo de la celda máxima es rgba(212,175,55,0.53) y el de una celda en 0 es 0.03', () => {
    montar({ stats: { ...STATS, position_frequency: [{ '0': 10, '1': 0 }] } })
    const c = celdas()
    expect(c[0]!.style.background).toBe('rgba(212, 175, 55, 0.53)')
    expect(c[1]!.style.background).toBe('rgba(0, 0, 0, 0.03)')
  })

  it('el color del texto depende de la intensidad y del tema', () => {
    montar({ stats: { ...STATS, position_frequency: [{ '0': 10, '1': 1 }] } })
    expect(celdas()[0]!.style.color).toBe('rgb(10, 10, 15)')
    expect(celdas()[1]!.style.color).toBe('rgb(240, 236, 226)')
  })

  it('en el tema claro la celda intensa es blanca y la tenue oscura', () => {
    montar({ theme: 'light', stats: { ...STATS, position_frequency: [{ '0': 10, '1': 1 }] } })
    expect(celdas()[0]!.style.color).toBe('rgb(255, 255, 255)')
    expect(celdas()[1]!.style.color).toBe('rgb(26, 22, 18)')
  })

  it('todas las frecuencias en 0 no dividen por cero y la leyenda dice máx: 0', () => {
    montar({ stats: { ...STATS, position_frequency: [{ '0': 0, '1': 0 }] } })
    expect(texto(document.querySelector('.heatmap-legend'))).toContain('máx: 0')
    expect(celdas()[0]!.style.background).toBe('rgba(0, 0, 0, 0.03)')
  })

  it('el contenedor del mapa es una imagen con nombre y se puede desplazar en horizontal', () => {
    montar()
    const mapa = screen.getByRole('img', { name: 'Mapa de calor posición vs dígito' })
    expect(mapa.style.overflowX).toBe('auto')
    expect(within(mapa).getByRole('table')).toBeTruthy()
  })
})
