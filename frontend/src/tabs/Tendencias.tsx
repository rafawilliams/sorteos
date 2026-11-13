// Isla «Tendencias» (spec frontend-react, T048). Equivale a `renderTrendChart` y `renderVolumeChart` de static/app.js:
// frecuencia de cada dígito por mes (líneas) y sorteos por mes (barras), con los datos de `stats.trends`.
// El título y el subtítulo de la sección siguen en la plantilla.
import type { ChartData } from 'chart.js'
import { useCallback } from 'react'
import type { Stats } from '../api/types'
import { Chart } from '../components/Chart'
import { Skeleton } from '../components/Skeleton'
import { useReveal } from '../components/useReveal'
import { chartOptions, DIGIT_COLORS } from '../lib/chartOptions'
import { useStats } from '../store/hooks'
import type { Tema } from '../store/tipos'

export const nombre = 'tendencias'

const opcionesLineas = (tema: Tema) => chartOptions(tema)
const opcionesBarras = (tema: Tema) => chartOptions(tema, false)

type Tendencia = Stats['trends']

function GraficoDigitos({ tendencia }: { tendencia: Tendencia }) {
  const datos = useCallback(
    (): ChartData => ({
      labels: tendencia.map((t) => t.month),
      datasets: DIGIT_COLORS.map((color, d) => ({
        label: `Dígito ${d}`,
        data: tendencia.map((t) => t.digits[String(d)] || 0),
        borderColor: color,
        backgroundColor: `${color}20`,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 6,
      })),
    }),
    [tendencia],
  )
  return <Chart type="line" datos={datos} opciones={opcionesLineas} etiqueta="Gráfico de tendencia de dígitos por mes" />
}

function GraficoVolumen({ tendencia }: { tendencia: Tendencia }) {
  const datos = useCallback((): ChartData => {
    const valores = tendencia.map((t) => t.sorteos)
    return {
      labels: tendencia.map((t) => t.month),
      datasets: [
        {
          label: 'Sorteos por mes',
          data: valores,
          // El degradado va del dorado al azul según la posición del mes, igual que el código antiguo.
          backgroundColor: valores.map((_, i) => `rgba(${Math.round(212 - (50 * i) / valores.length)},${Math.round(175 - (30 * i) / valores.length)},${Math.round(55 + (100 * i) / valores.length)},0.7)`),
          borderColor: 'rgba(212,175,55,0.3)',
          borderWidth: 1,
          borderRadius: 6,
        },
      ],
    }
  }, [tendencia])
  return <Chart type="bar" datos={datos} opciones={opcionesBarras} etiqueta="Gráfico de volumen de sorteos por mes" />
}

export function Componente() {
  const stats = useStats()
  const revelarDigitos = useReveal()
  const revelarVolumen = useReveal()

  if (!stats) {
    return (
      <div role="status" aria-label="Cargando tendencias">
        <Skeleton lineas={4} />
      </div>
    )
  }
  const tendencia = stats.trends ?? []

  return (
    <>
      <div className="card reveal" style={{ marginBottom: 28 }} ref={revelarDigitos}>
        <div className="card-header">
          <h3 className="card-title">Frecuencia de Dígitos por Mes</h3>
          <span className="card-badge badge-green">Últimos 24 meses</span>
        </div>
        {tendencia.length > 0 && <GraficoDigitos tendencia={tendencia} />}
      </div>
      <div className="card reveal" ref={revelarVolumen}>
        <div className="card-header">
          <h3 className="card-title">Sorteos por Mes</h3>
          <span className="card-badge badge-purple">Volumen</span>
        </div>
        {tendencia.length > 0 && <GraficoVolumen tendencia={tendencia} />}
      </div>
    </>
  )
}
