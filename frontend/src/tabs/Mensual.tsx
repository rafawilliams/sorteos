// Isla «Mensual» (spec frontend-react, T029). Equivale a `renderMonthlySection` de static/app.js: la recomendación para
// el próximo mes, la ventaja de cada dígito por posición, el perfil de los 12 meses y una tarjeta por mes. No tiene carga
// propia: lee `stats.monthly_reco` del Store.
//
// `Chart` recrea el gráfico si cambia la identidad de `datos` u `opciones`: aquí van memorizadas (`useCallback`) y como
// constante de módulo (deuda Q9 de T027).
import type { ChartData, ChartOptions } from 'chart.js'
import { useCallback } from 'react'
import type { PerfilMensual } from '../api/types'
import { Balls } from '../components/Balls'
import { BotonCopiar } from '../components/BotonCopiar'
import { Chart } from '../components/Chart'
import { EsperaStats } from '../components/EsperaStats'
import { useReveal } from '../components/useReveal'
import { chartOptions, DIGIT_COLORS } from '../lib/chartOptions'
import { fmtLift, liftBar } from '../lib/formato'
import { useStats } from '../store/hooks'
import type { Tema } from '../store/tipos'

export const nombre = 'mensual'

const MONO = "'JetBrains Mono'"
const BORDE_OBJETIVO = '2px solid var(--gold-400)'
const SIN_PERFILES: PerfilMensual[] = []
const CHIP = { background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 8, fontFamily: MONO, fontSize: '0.85rem' } as const
const ROTULO = { fontSize: '0.8rem', color: 'var(--text-muted)' } as const

const rango = (i: number) => (i === 0 ? '1RO' : i === 1 ? '2DO' : i === 2 ? '3RO' : `${i + 1}TO`)

/** Barras apiladas en los dos ejes y con leyenda: es `chartOptions(tema)` más lo propio de este gráfico. */
const opcionesPerfil = (tema: Tema): ChartOptions => {
  const o = chartOptions(tema)
  return { ...o, scales: { x: { ...o.scales?.x, stacked: true }, y: { ...o.scales?.y, stacked: true } } } as ChartOptions
}

/** Color de una celda de la tabla de ventaja: verde si el dígito sale más que el promedio, rojo si menos. */
function colorVentaja(v: number): string {
  const intensidad = Math.min(Math.abs(v) / 5, 1) * 0.7
  return v > 0 ? `rgba(74,222,128,${intensidad})` : v < 0 ? `rgba(248,113,113,${intensidad})` : 'transparent'
}

function TablaVentaja({ ventaja }: { ventaja: Array<Record<string, number>> }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      {/* Una tabla con nombre, no un `role="img"` que la envuelva: `img` vuelve presentacional todo su contenido (ARIA). */}
      <table className="heatmap-table" role="table" aria-label="Tabla de ventaja de dígitos por posición">
        <thead>
          <tr>
            <th>Pos</th>
            {Array.from({ length: 10 }, (_, d) => (
              <th key={d}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ventaja.map((fila, pos) => (
            <tr key={pos}>
              <td style={{ fontWeight: 700 }}>{`P${pos + 1}`}</td>
              {Array.from({ length: 10 }, (_, d) => {
                const v = fila[String(d)] || 0
                return (
                  <td key={d} style={{ background: colorVentaja(v), textAlign: 'center', fontFamily: MONO, fontSize: '0.8rem' }}>
                    {`${v > 0 ? '+' : ''}${v}`}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GraficoPerfil({ perfiles }: { perfiles: PerfilMensual[] }) {
  const datos = useCallback(
    (): ChartData => ({
      labels: perfiles.map((p) => p.name.substring(0, 3)),
      datasets: Array.from({ length: 10 }, (_, d) => ({
        label: `Dígito ${d}`,
        // Media de las 4 posiciones; un mes sin frecuencias cuenta 0.
        data: perfiles.map((p) => {
          if (!p.position_freq || !p.position_freq.length) return 0
          let suma = 0
          p.position_freq.forEach((pf) => {
            suma += pf[String(d)] || 0
          })
          return Math.round((suma / 4) * 10) / 10
        }),
        backgroundColor: `${DIGIT_COLORS[d]}99`,
        borderColor: DIGIT_COLORS[d],
        borderWidth: 1,
        borderRadius: 3,
      })),
    }),
    [perfiles],
  )
  return <Chart type="bar" datos={datos} opciones={opcionesPerfil} etiqueta="Gráfico comparativo de perfil mensual" />
}

function TarjetaMes({ perfil: p, esObjetivo }: { perfil: PerfilMensual; esObjetivo: boolean }) {
  const revelar = useReveal()
  return (
    <div className="card reveal" style={esObjetivo ? { border: BORDE_OBJETIVO } : undefined} ref={revelar}>
      <div className="card-header">
        <h3 className="card-title">{p.name}</h3>
        {esObjetivo && <span className="card-badge badge-gold">Próximo</span>}
      </div>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 8 }}>{`${p.draws} sorteos · ${p.numbers.toLocaleString()} números`}</div>
      {p.hot && p.hot.length > 0 && (
        <>
          <div style={{ ...ROTULO, marginBottom: 4 }}>Top números:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {p.hot.slice(0, 5).map((n) => (
              <span key={n.number} style={CHIP}>
                {`${n.number} `}
                <small style={{ color: 'var(--text-muted)' }}>{`(${n.count})`}</small>
              </span>
            ))}
          </div>
        </>
      )}
      {p.top_endings && p.top_endings.length > 0 && (
        <>
          <div style={{ ...ROTULO, marginTop: 8, marginBottom: 4 }}>Top terminaciones:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {p.top_endings.slice(0, 5).map((e) => (
              <span key={e.ending} style={CHIP}>
                {`${e.ending} `}
                <small style={{ color: 'var(--text-muted)' }}>{`(${e.count})`}</small>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function Componente() {
  const stats = useStats()
  const revelar = useReveal()
  if (!stats) {
    return <EsperaStats etiqueta="Cargando recomendación mensual" />
  }
  const mr = stats.monthly_reco
  if (!mr) return <p style={{ color: 'var(--text-muted)' }}>Aún no hay datos mensuales.</p>

  const objetivo = mr.target_month_name
  const recomendaciones = mr.recommendations || []
  const ventaja = mr.digit_advantage || []
  const perfiles = mr.monthly_profiles || SIN_PERFILES

  return (
    <>
      <div role="region" aria-label="Recomendación para el próximo mes">
        <div className="card reveal" style={{ border: BORDE_OBJETIVO }} ref={revelar}>
          <div className="card-header">
            <h3 className="card-title">{`📅 ${objetivo} ${mr.target_year}`}</h3>
            <span className="card-badge badge-gold">{`${mr.target_draws_historical} sorteos históricos`}</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 16 }}>
            Basado en <strong style={{ color: 'var(--gold-300)' }}>{mr.target_numbers_historical.toLocaleString()}</strong> números que salieron en{' '}
            <strong style={{ color: 'var(--gold-300)' }}>{objetivo}</strong> desde 1995.
          </p>
          {recomendaciones.length > 0 && (
            <div className="reco-grid">
              {recomendaciones.map((r, i) => (
                <div className="reco-card" key={i}>
                  <BotonCopiar numero={r.number} />
                  <div className="reco-rank">{`${rango(i)} RECOMENDADO`}</div>
                  <div className="reco-number">
                    <Balls valor={r.number} variante="gold" tamano="lg" />
                  </div>
                  <div className="reco-confidence" title="Veces más probable que un número al azar (×1.00 = azar)">
                    <div className="conf-bar">
                      <div className="conf-bar-fill" style={{ width: `${liftBar(r.confidence)}%` }} />
                    </div>
                    {fmtLift(r.confidence)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card reveal" style={{ marginTop: 24 }} ref={revelar}>
        <div className="card-header">
          <h3 className="card-title">Ventaja de Dígitos por Posición</h3>
          <span className="card-badge badge-gold">vs Promedio</span>
        </div>
        <p className="section-subtitle" style={{ marginBottom: 12 }}>
          Diferencia porcentual de cada dígito en el mes objetivo respecto al promedio general. <span style={{ color: '#4ade80' }}>Verde</span> = más frecuente,{' '}
          <span style={{ color: '#f87171' }}>Rojo</span> = menos frecuente.
        </p>
        {ventaja.length === 4 && <TablaVentaja ventaja={ventaja} />}
      </div>

      <div className="card reveal" style={{ marginTop: 24 }} ref={revelar}>
        <div className="card-header">
          <h3 className="card-title">Perfil de los 12 Meses</h3>
          <span className="card-badge badge-purple">Histórico</span>
        </div>
        {perfiles.length === 12 && <GraficoPerfil perfiles={perfiles} />}
      </div>

      <div className="grid-3" role="region" aria-label="Perfiles mensuales detallados" style={{ marginTop: 24 }}>
        {perfiles.map((p) => (
          <TarjetaMes key={p.month} perfil={p} esObjetivo={p.month === mr.target_month} />
        ))}
      </div>
    </>
  )
}
