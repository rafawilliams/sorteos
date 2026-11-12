// Isla «Precisión» (spec frontend-react, T032). Equivale a `loadBacktesting`/`renderBacktesting`/`renderPrecisionTrend` de
// static/app.js: el backtesting del modelo de ML frente al estadístico (`/api/backtesting`), con el resumen, la precisión
// por posición, la comparación entre métodos, la tendencia mensual y una nota para interpretarlo.
//
// Tiene carga propia, al activarse la pestaña, y no lee `stats` (el backtesting no depende de él). Una vez cargado no se
// repite al volver a la pestaña (como `backtestData` en app.js); si falló, se reintenta al volver.
//
// Tres diferencias respecto a app.js (decisions.md): un error se ve con «Reintentar» (antes quedaba una página vacía);
// sin modelo entrenado la API responde `ml_better: true` y aquí no se corona a ninguno de los dos; y el distintivo de lift
// no escribe el `background` que en app.js era `var(--…)20`, CSS inválido que el navegador ya descartaba.
import type { ChartData } from 'chart.js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getBacktesting } from '../api/client'
import type { BacktestEstadistico, BacktestMl, Backtesting } from '../api/types'
import { Chart } from '../components/Chart'
import { Skeleton } from '../components/Skeleton'
import { useReveal } from '../components/useReveal'
import { chartOptions } from '../lib/chartOptions'
import { useActiveTab } from '../store/hooks'
import type { Tema } from '../store/tipos'

export const nombre = 'precision'

type Estado = { fase: 'inactivo' } | { fase: 'cargando' } | { fase: 'error'; mensaje: string } | { fase: 'listo'; datos: Backtesting }

const ULTIMOS = 500
const POSICIONES = ['Millares (pos 0)', 'Centenas (pos 1)', 'Decenas (pos 2)', 'Unidades (pos 3)']
const TITULO_SECCION = { fontSize: '1.2rem', margin: '28px 0 12px' } as const
const NEGRITA = { color: 'var(--gold-300)' } as const
const SIN_SERIE: BacktestMl['rolling_accuracy'] = []

const hay = (o: object | null | undefined) => !!o && Object.keys(o).length > 0

// Constante de módulo: `Chart` recrea el gráfico si cambia la identidad de `opciones` (deuda Q9).
const opcionesTendencia = (tema: Tema) => chartOptions(tema)

function GraficoTendencia({ serie }: { serie: BacktestMl['rolling_accuracy'] }) {
  const datos = useCallback((): ChartData => {
    const meses = serie.map((r) => r.month)
    return {
      labels: meses,
      datasets: [
        { label: 'Top-1 Promedio', data: serie.map((r) => r.top1_avg), borderColor: '#ffd700', backgroundColor: 'rgba(255,215,0,0.1)', tension: 0.4, borderWidth: 2, pointRadius: 3, fill: true },
        { label: 'Top-3 Promedio', data: serie.map((r) => r.top3_avg), borderColor: '#34d399', backgroundColor: 'rgba(52,211,153,0.1)', tension: 0.4, borderWidth: 2, pointRadius: 3, fill: true },
        { label: 'Azar Top-1 (10%)', data: meses.map(() => 10), borderColor: 'rgba(255,77,77,0.5)', borderDash: [6, 4], borderWidth: 1, pointRadius: 0, fill: false },
        { label: 'Azar Top-3 (30%)', data: meses.map(() => 30), borderColor: 'rgba(255,77,77,0.3)', borderDash: [6, 4], borderWidth: 1, pointRadius: 0, fill: false },
      ],
    }
  }, [serie])
  return <Chart type="line" datos={datos} opciones={opcionesTendencia} etiqueta="Gráfico de precisión mensual" />
}

function ComoInterpretarlo() {
  const revelar = useReveal()
  return (
    <div className="card reveal" style={{ marginTop: 20 }} ref={revelar}>
      <div className="card-header">
        <h3 className="card-title">¿Cómo interpretarlo?</h3>
        <span className="card-badge badge-gold">Info</span>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.7 }}>
        El <strong style={NEGRITA}>baseline aleatorio</strong>
        {' para cada posición es 10% (1 de 10 dígitos). Un modelo útil debe superar este umbral consistentemente. '}
        <strong style={NEGRITA}>Top-1</strong>
        {' = ¿el dígito más probable acertó? '}
        <strong style={NEGRITA}>Top-3</strong>
        {' = ¿el dígito real estaba entre los 3 más probables? '}
        <br />
        <br />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          ⚠ Nota: Estas métricas son evaluaciones in-sample. La lotería es un juego de azar puro — ningún modelo puede predecir con certeza.
        </span>
      </p>
    </div>
  )
}

function Contenido({ datos }: { datos: Backtesting }) {
  const revelar = useReveal()
  const ml = (datos.ml ?? {}) as Partial<BacktestMl>
  const st = (datos.statistical ?? {}) as Partial<BacktestEstadistico>
  const hayMl = hay(ml)
  const hayEst = hay(st)

  if (!hayMl && !hayEst) {
    return (
      <>
        <p style={{ color: 'var(--text-muted)' }}>Aún no hay suficientes sorteos para calcular la precisión.</p>
        <ComoInterpretarlo />
      </>
    )
  }

  const posiciones = ml.per_position ?? []
  const posicionesEst = st.per_position ?? []
  // Sin modelo la API responde `ml_better: true` (toma 10 % por defecto): solo se corona a uno si hay datos de los dos y
  // la API ha decidido (un `ml_better` booleano). Sin `comparison`, `!undefined` coronaría al Estadístico sin que nadie lo dijera.
  const ambos = hayMl && hayEst
  const decidido = ambos && typeof datos.comparison?.ml_better === 'boolean'
  const mlMejor = decidido && datos.comparison.ml_better
  const estMejor = decidido && !datos.comparison.ml_better
  const serie = ml.rolling_accuracy ?? SIN_SERIE

  return (
    <>
      <div className="stat-cards" role="region" aria-label="Resumen de precisión">
        <div className="stat-card">
          <div className="stat-value">{`${ml.avg_top1_accuracy || '—'}%`}</div>
          <div className="stat-label">ML Top-1 Precisión</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{`${ml.avg_top3_accuracy || '—'}%`}</div>
          <div className="stat-label">ML Top-3 Precisión</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{`${ml.avg_lift_top1 || '—'}x`}</div>
          <div className="stat-label">ML Lift vs Azar</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{`${ml.total_evaluated || 0}`}</div>
          <div className="stat-label">Sorteos Evaluados</div>
        </div>
      </div>

      <h3 className="section-title" style={TITULO_SECCION}>
        Precisión por Posición
      </h3>
      <div className="grid-4" role="region" aria-label="Precisión por posición de dígito">
        {posiciones.map((p, i) => {
          const t1 = Math.min((p.top1_accuracy / 25) * 100, 100)
          const t3 = Math.min((p.top3_accuracy / 60) * 100, 100)
          const colorLift = p.lift_top1 >= 1.2 ? 'var(--accent-green)' : p.lift_top1 >= 1.0 ? 'var(--gold-300)' : 'var(--accent-hot)'
          return (
            <div className="card reveal" key={i} ref={revelar}>
              <div className="card-header">
                <div className="card-title" style={{ fontSize: '0.95rem' }}>
                  {POSICIONES[i] ?? `Posición ${i}`}
                </div>
                <span className="card-badge" style={{ color: colorLift }}>
                  {`${p.lift_top1}x`}
                </span>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                  <span>Top-1</span>
                  <span style={{ color: 'var(--gold-300)', fontWeight: 600 }}>{`${p.top1_accuracy}%`}</span>
                </div>
                <div className="bar-track" style={{ height: 14, position: 'relative' }}>
                  <div className="bar-fill gold" style={{ width: `${t1}%`, minWidth: 0 }} />
                  <div style={{ position: 'absolute', left: `${(10 / 25) * 100}%`, top: 0, height: '100%', width: 2, background: 'var(--accent-hot)', opacity: 0.7 }} title="Azar: 10%" />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                  <span>Top-3</span>
                  <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{`${p.top3_accuracy}%`}</span>
                </div>
                <div className="bar-track" style={{ height: 14, position: 'relative' }}>
                  <div className="bar-fill green" style={{ width: `${t3}%`, minWidth: 0 }} />
                  <div style={{ position: 'absolute', left: `${(30 / 60) * 100}%`, top: 0, height: '100%', width: 2, background: 'var(--accent-hot)', opacity: 0.7 }} title="Azar: 30%" />
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Prob. prom. dígito real: <strong style={{ color: 'var(--text-secondary)' }}>{`${p.avg_prob_actual}%`}</strong>
              </div>
            </div>
          )
        })}
      </div>

      <h3 className="section-title" style={TITULO_SECCION}>
        ML vs Estadístico
      </h3>
      <div className="grid-2" role="region" aria-label="Comparación ML vs Estadístico">
        <div className="card reveal" ref={revelar}>
          <div className="card-header">
            <div className="card-title">🤖 Machine Learning</div>
            <span className="card-badge badge-green">{mlMejor ? 'Mejor' : '—'}</span>
          </div>
          {!hayMl && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sin modelo entrenado.</div>}
          <div className="bar-chart">
            {posiciones.map((p, i) => (
              <div className="bar-row" key={i}>
                <div className="bar-label">{`P${i}`}</div>
                <div className="bar-track">
                  <div className="bar-fill green" style={{ width: `${Math.min((p.top1_accuracy / 20) * 100, 100)}%` }}>{`${p.top1_accuracy}%`}</div>
                </div>
              </div>
            ))}
            {ml.ending_top10_hit_rate !== undefined && (
              <div className="bar-row">
                <div className="bar-label" style={{ fontSize: '0.7rem' }}>
                  Term
                </div>
                <div className="bar-track">
                  <div className="bar-fill purple" style={{ width: `${Math.min((ml.ending_top10_hit_rate / 20) * 100, 100)}%` }}>{`${ml.ending_top10_hit_rate}%`}</div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="card reveal" ref={revelar}>
          <div className="card-header">
            <div className="card-title">📊 Estadístico</div>
            <span className="card-badge badge-gold">{estMejor ? 'Mejor' : '—'}</span>
          </div>
          {!hayEst && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sin datos suficientes.</div>}
          <div className="bar-chart">
            {posicionesEst.map((p, i) => (
              <div className="bar-row" key={i}>
                <div className="bar-label">{`P${i}`}</div>
                <div className="bar-track">
                  <div className="bar-fill gold" style={{ width: `${Math.min((p.top1_accuracy / 20) * 100, 100)}%` }}>{`${p.top1_accuracy}%`}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card reveal" style={{ marginTop: 28 }} ref={revelar}>
        <div className="card-header">
          <h3 className="card-title">Precisión Mensual (Top-1 por Posición)</h3>
          <span className="card-badge badge-green">Tendencia</span>
        </div>
        {serie.length > 0 && <GraficoTendencia serie={serie} />}
      </div>

      <ComoInterpretarlo />
    </>
  )
}

export function Componente() {
  const activa = useActiveTab() === 'precision'
  const [estado, setEstado] = useState<Estado>({ fase: 'inactivo' })
  const ultima = useRef(0) // solo cuenta la respuesta de la petición más reciente
  const regionRef = useRef<HTMLDivElement>(null)
  const tieneDatos = useRef(false)
  const yaPedida = useRef(false)

  const cargar = useCallback(async () => {
    const mia = ++ultima.current
    setEstado({ fase: 'cargando' })
    const r = await getBacktesting(ULTIMOS)
    if (mia !== ultima.current) return
    if (r.ok) {
      tieneDatos.current = true
      setEstado({ fase: 'listo', datos: r.data })
    } else {
      setEstado({ fase: 'error', mensaje: r.mensaje })
    }
  }, [])

  // Al pasar a ser la activa; con datos ya cargados no se repite. El doble efecto de StrictMode no duplica la petición.
  useEffect(() => {
    if (!activa) {
      yaPedida.current = false
      return
    }
    if (yaPedida.current) return
    yaPedida.current = true
    if (tieneDatos.current) return
    void cargar()
  }, [activa, cargar])

  return (
    // Sin `role="region"`: el panel de la pestaña ya tiene nombre y dentro hay otras tres regiones con el suyo.
    <div ref={regionRef} tabIndex={-1} style={{ outline: 'none' }}>
      {estado.fase === 'cargando' && (
        <div role="status" aria-label="Calculando backtesting">
          <p style={{ color: 'var(--text-muted)' }}>Calculando backtesting…</p>
          <Skeleton lineas={5} />
        </div>
      )}
      {estado.fase === 'error' && (
        <div role="alert">
          <p style={{ color: '#f87171' }}>No se pudo cargar la precisión. {estado.mensaje}</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              regionRef.current?.focus() // el botón desaparece al reintentar: el foco pasa a la región, no a <body>
              void cargar()
            }}
          >
            Reintentar
          </button>
        </div>
      )}
      {estado.fase === 'listo' && <Contenido datos={estado.datos} />}
    </div>
  )
}
