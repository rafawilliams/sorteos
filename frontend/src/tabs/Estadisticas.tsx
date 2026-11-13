// Isla «Estadísticas» (spec frontend-react, T047). Equivale a `renderStatsForPrize`, `renderSeriesLetras`, `renderFormatos`,
// `renderRadarChart`, `renderScatterChart`, `initStatsPrizeTabs` y `selectStatsPrize` de static/app.js: selector de premio,
// frecuencia de dígitos, terminaciones populares, números calientes y fríos, series y letras, radar por categoría,
// dispersión 1.º contra 2.º y el panel de premios de otros formatos (2 y 5 cifras).
// El título y el subtítulo de la sección siguen en la plantilla.
import type { ChartData, ChartOptions } from 'chart.js'
import { useCallback, useMemo, type ReactNode } from 'react'
import type { EstadisticasPremio, FormatoPremio, Premio, Sorteo, Stats } from '../api/types'
import { Barras } from '../components/Barras'
import { CeldasPosicion } from '../components/CeldasPosicion'
import { Chart } from '../components/Chart'
import { Skeleton } from '../components/Skeleton'
import { Tablist } from '../components/Tablist'
import { useReveal } from '../components/useReveal'
import { chartOptions } from '../lib/chartOptions'
import { catLabel } from '../lib/formato'
import { useSorteos, useStats, useStatsPrize } from '../store/hooks'
import type { Tema } from '../store/tipos'

export const nombre = 'estadisticas'

const ID_REGION = 'estadisticas-panel'
const PREMIOS: Array<{ id: Premio; texto: string }> = [
  { id: 'primero', texto: '1er Premio' },
  { id: 'segundo', texto: '2do Premio' },
  { id: 'tercero', texto: '3er Premio' },
]
const esPremio = (id: string): id is Premio => PREMIOS.some((p) => p.id === id)
const controlaRegion = () => ID_REGION

const NOMBRES_FORMATO = { '2': '2 cifras', '5': '5 cifras' } as const
const POSICIONES_FORMATO = { '2': ['Decenas', 'Unidades'], '5': ['Dec. millar', 'Millares', 'Centenas', 'Decenas', 'Unidades'] } as const
const NOMBRES_PREMIO: Record<string, string> = { primero: '1ro', segundo: '2do', tercero: '3ro' }
const CATEGORIAS_RADAR = ['dominical', 'miercolito', 'gordito'] as const
const COLORES_RADAR: Record<string, [string, string]> = {
  dominical: ['#ffd700', 'rgba(255,215,0,0.15)'],
  miercolito: ['#34d399', 'rgba(52,211,153,0.15)'],
  gordito: ['#ff4d4d', 'rgba(255,77,77,0.15)'],
}
const DIGITOS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

const entradas = (f: Record<string, number> | undefined) => Object.entries(f ?? {}).map(([etiqueta, conteo]) => ({ etiqueta, conteo }))

/** Una `.card.reveal` con título e insignia opcional, como las repite la plantilla antigua. */
function Tarjeta({ titulo, insignia, clase, children }: { titulo: string; insignia?: string; clase?: string; children: ReactNode }) {
  const revelar = useReveal()
  return (
    <div className="card reveal" ref={revelar}>
      <div className="card-header">
        <h3 className="card-title">{titulo}</h3>
        {insignia && <span className={`card-badge ${clase}`}>{insignia}</span>}
      </div>
      {children}
    </div>
  )
}

const opcionesRadar = (tema: Tema): ChartOptions => {
  const base = chartOptions(tema)
  const claro = tema === 'light'
  const texto = claro ? '#5c554a' : '#8a8693'
  const rejilla = claro ? 'rgba(139,105,20,0.1)' : 'rgba(212,175,55,0.08)'
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { color: texto, font: { family: 'DM Sans', size: 11 }, boxWidth: 12, padding: 16 } },
      tooltip: { ...base.plugins?.tooltip, callbacks: { label: (c) => `${c.dataset.label}: ${(c.raw as number).toFixed(1)}%` } },
    },
    scales: { r: { angleLines: { color: rejilla }, grid: { color: rejilla }, pointLabels: { color: texto, font: { family: 'DM Sans', size: 11 } }, ticks: { display: false }, beginAtZero: true } },
  } as ChartOptions
}

function Radar({ porCategoria }: { porCategoria: Stats['by_category'] }) {
  const datos = useCallback((): ChartData => {
    const disponibles = CATEGORIAS_RADAR.filter((c) => porCategoria[c]?.digit_frequency)
    return {
      labels: DIGITOS.map((d) => `Dígito ${d}`),
      datasets: disponibles.map((c) => {
        const df = porCategoria[c]!.digit_frequency
        const total = Object.values(df).reduce((a, b) => a + b, 0) || 1
        const [borde, fondo] = COLORES_RADAR[c]!
        return { label: catLabel(c), data: DIGITOS.map((d) => ((df[d] || 0) / total) * 100), borderColor: borde, backgroundColor: fondo, borderWidth: 2, pointRadius: 4, pointHoverRadius: 7, pointBackgroundColor: borde }
      }),
    }
  }, [porCategoria])
  if (!CATEGORIAS_RADAR.some((c) => porCategoria[c]?.digit_frequency)) return null
  return <Chart type="radar" datos={datos} opciones={opcionesRadar} altura={380} etiqueta="Gráfico radar comparación por categoría" />
}

const opcionesDispersion = (tema: Tema): ChartOptions => {
  const claro = tema === 'light'
  const texto = claro ? '#5c554a' : '#8a8693'
  const tenue = claro ? '#9a9189' : '#4a4656'
  const rejilla = claro ? 'rgba(139,105,20,0.08)' : 'rgba(212,175,55,0.06)'
  const base = chartOptions(tema, false)
  const eje = (titulo: string) => ({ title: { display: true, text: titulo, color: texto, font: { family: 'DM Sans', size: 12 } }, ticks: { color: tenue, font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: rejilla } })
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        ...base.plugins?.tooltip,
        callbacks: {
          label: (c) => {
            // Los premios se muestran como llegan (principio 7): sin rellenar con ceros el número ya convertido.
            const p = c.raw as { primero: string; segundo: string }
            return `1ro: ${p.primero} — 2do: ${p.segundo}`
          },
        },
      },
    },
    scales: { x: eje('1er Premio'), y: eje('2do Premio') },
  } as ChartOptions
}

function Dispersion({ sorteos }: { sorteos: Sorteo[] }) {
  const puntos = useMemo(() => sorteos.slice(0, 500).filter((s) => (s.primero || '').length === 4 && (s.segundo || '').length === 4).map((s) => ({ x: parseInt(s.primero) || 0, y: parseInt(s.segundo) || 0, primero: s.primero, segundo: s.segundo })), [sorteos])
  const datos = useCallback(
    (tema: Tema): ChartData => ({
      datasets: [
        {
          label: '1er vs 2do Premio',
          data: puntos,
          backgroundColor: tema === 'light' ? 'rgba(184,134,11,0.35)' : 'rgba(255,215,0,0.3)',
          borderColor: tema === 'light' ? 'rgba(184,134,11,0.6)' : 'rgba(255,215,0,0.5)',
          borderWidth: 1,
          pointRadius: 3,
          pointHoverRadius: 6,
        },
      ],
    }),
    [puntos],
  )
  if (puntos.length === 0) return null
  return <Chart type="scatter" datos={datos} opciones={opcionesDispersion} altura={380} etiqueta="Gráfico de dispersión correlación premios" />
}

function FormatoUno({ ancho, d }: { ancho: '2' | '5'; d: FormatoPremio | undefined }) {
  const nombreFormato = NOMBRES_FORMATO[ancho]
  if (!d || !d.total) {
    return (
      <div>
        <h4 className="card-title">{nombreFormato}</h4>
        <p className="section-subtitle">Sin premios de este formato.</p>
      </div>
    )
  }
  const categorias = Object.entries(d.by_category ?? {}).map(([c, n]) => `${c} (${n})`).join(', ')
  const premios = Object.entries(d.by_prize ?? {}).map(([p, n]) => `${NOMBRES_PREMIO[p] || p}: ${n}`).join(' · ')
  const rango = d.date_range ? `${d.date_range.from} → ${d.date_range.to}` : ''
  const calientes = d.hot_cold?.hot ?? []
  return (
    <div aria-label={`Estadísticas de premios de ${nombreFormato}`}>
      <h4 className="card-title">{`${nombreFormato} — ${d.total} premios`}</h4>
      <p className="section-subtitle">
        {categorias}
        <br />
        {premios}
        <br />
        {rango}
      </p>
      {(d.position_frequency ?? []).map((pos, i) => (
        <div style={{ marginTop: '0.75rem' }} key={i}>
          <small className="section-subtitle">{POSICIONES_FORMATO[ancho][i]}</small>
          <CeldasPosicion frecuencia={pos} posicion={POSICIONES_FORMATO[ancho][i] ?? ''} />
        </div>
      ))}
      <h4 className="card-title" style={{ marginTop: '1rem' }}>Más frecuentes</h4>
      <div className="bar-chart" role="img" aria-label={`Números de ${nombreFormato} más frecuentes`}>
        <Barras datos={calientes.map((h) => ({ etiqueta: h.number, conteo: h.count }))} clase="hot" />
      </div>
    </div>
  )
}

export function Componente() {
  const stats = useStats()
  const sorteos = useSorteos()
  const [premio, elegirPremio] = useStatsPrize()
  const revelar = useReveal()

  const pestañas = (
    <Tablist etiqueta="Seleccionar premio para estadísticas" pestañas={PREMIOS} valor={premio} onCambio={(id) => esPremio(id) && elegirPremio(id)} idPrefijo="statsPrize" clase="prize-tabs" claseTab="prize-tab" controla={controlaRegion} />
  )

  if (!stats) {
    return (
      <>
        {pestañas}
        <div id={ID_REGION} role="status" aria-label="Cargando estadísticas">
          <Skeleton lineas={4} />
        </div>
      </>
    )
  }

  const pd = (stats.prizes?.[premio] ?? {}) as Partial<EstadisticasPremio>
  const df = pd.digit_frequency || stats.digit_frequency || {}
  const ldp = pd.last_digit_pairs || stats.last_digit_pairs || {}
  const hc = pd.hot_cold || stats.hot_cold || { hot: [], cold: [] }
  const series = stats.series_folio?.series ?? []
  const letras = stats.letras ?? []
  const formatos = stats.formatos ?? {}

  return (
    <>
      {pestañas}
      <div id={ID_REGION} role="region" aria-label="Estadísticas del premio elegido">
        <div className="grid-2">
          <Tarjeta titulo="Frecuencia de Dígitos" insignia="0–9" clase="badge-gold">
            <div className="bar-chart" role="img" aria-label="Frecuencia de dígitos 0-9">
              <Barras datos={entradas(df)} clase="gold" />
            </div>
          </Tarjeta>
          <Tarjeta titulo="Terminaciones Populares" insignia="Últimos 2 dígitos" clase="badge-gold">
            <div className="bar-chart" role="img" aria-label="Terminaciones más populares">
              <Barras datos={entradas(ldp).slice(0, 12)} clase="green" />
            </div>
          </Tarjeta>
        </div>
        <div className="grid-2">
          <Tarjeta titulo="Números Calientes" insignia="Hot" clase="badge-hot">
            <div className="bar-chart" role="img" aria-label="Números más frecuentes">
              <Barras datos={(hc.hot ?? []).map((h) => ({ etiqueta: h.number, conteo: h.count }))} clase="hot" />
            </div>
          </Tarjeta>
          <Tarjeta titulo="Números Fríos" insignia="Cold" clase="badge-cold">
            <div className="bar-chart" role="img" aria-label="Números menos frecuentes">
              <Barras datos={(hc.cold ?? []).map((h) => ({ etiqueta: h.number, conteo: h.count }))} clase="cold" />
            </div>
          </Tarjeta>
        </div>
      </div>
      <div className="grid-2">
        <Tarjeta titulo="Series Más Frecuentes">
          <div className="bar-chart" role="img" aria-label="Series más frecuentes">
            <Barras datos={series.map((s) => ({ etiqueta: s.value, conteo: s.count }))} clase="gold" />
          </div>
        </Tarjeta>
        <Tarjeta titulo="Letras Más Frecuentes">
          <div className="bar-chart" role="img" aria-label="Letras más frecuentes">
            <Barras datos={letras.map((l) => ({ etiqueta: l.letra, conteo: l.count }))} clase="green" />
          </div>
        </Tarjeta>
      </div>
      <div className="grid-2">
        <Tarjeta titulo="Comparación por Categoría" insignia="Radar" clase="badge-purple">
          <Radar porCategoria={stats.by_category ?? {}} />
        </Tarjeta>
        <Tarjeta titulo="Correlación 1er vs 2do Premio" insignia="Scatter" clase="badge-green">
          <Dispersion sorteos={sorteos} />
        </Tarjeta>
      </div>
      <div className="card reveal" ref={revelar}>
        <div className="card-header">
          <h3 className="card-title">Premios de Otros Formatos</h3>
          <span className="card-badge badge-purple">2 y 5 cifras</span>
        </div>
        <p className="section-subtitle">El 2º y 3º del Gordito (y el Miercolito de 1962–1966) son de 2 cifras; el Extraordinario es de 5. Se analizan aparte para no distorsionar las estadísticas de 4 cifras.</p>
        <div className="grid-2">
          <FormatoUno ancho="2" d={formatos['2']} />
          <FormatoUno ancho="5" d={formatos['5']} />
        </div>
      </div>
    </>
  )
}
