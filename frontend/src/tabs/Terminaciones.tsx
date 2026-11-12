// Isla «Terminaciones» (spec frontend-react, T040). Equivale a `renderEndingsSection`, `renderPrizeEndings`,
// `renderEndingsHeatmap`, `renderEndingsTrendChart` y `initEndCatTabs` de static/app.js: selector de categoría, terminaciones
// recomendadas (estadístico o ML, según el interruptor de la cabecera), nota de la prueba hacia atrás, barras calientes y
// frías, tops por premio, mapa de calor 10×10 y tendencia mensual.
// El título, el subtítulo y el interruptor ML siguen en la plantilla (el interruptor es compartido con Predicciones).
import type { ChartData } from 'chart.js'
import { useCallback, useMemo, useState } from 'react'
import type { Stats, TerminacionConteo } from '../api/types'
import { Balls } from '../components/Balls'
import { BotonCopiar } from '../components/BotonCopiar'
import { Chart } from '../components/Chart'
import { Skeleton } from '../components/Skeleton'
import { Tablist } from '../components/Tablist'
import { useReveal } from '../components/useReveal'
import { chartOptions, DIGIT_COLORS } from '../lib/chartOptions'
import { catLabel, fmtLift, liftBar } from '../lib/formato'
import { categoriasDe } from '../lib/resultados'
import { useML, useSorteos, useStats, useTheme } from '../store/hooks'
import type { Tema } from '../store/tipos'

export const nombre = 'terminaciones'

const RANGOS = ['1ro', '2do', '3ro', '4to', '5to', '6to', '7mo', '8vo', '9no', '10mo']
const ID_RECOMENDADAS = 'terminaciones-reco'
const SIN_TERMINACIONES: Stats['endings'] = {
  by_prize: { primero: [], segundo: [], tercero: [] },
  frequency: {},
  hot_cold: { hot: [], cold: [] },
  recommendations: [],
  total_endings: 0,
  trends: [],
}

const opcionesTendencia = (tema: Tema) => chartOptions(tema)

/** Barras horizontales: el ancho es el conteo relativo al máximo de la lista. */
function Barras({ datos, clase }: { datos: TerminacionConteo[]; clase: string }) {
  const maximo = Math.max(...datos.map((d) => d.count), 1)
  return (
    <>
      {datos.map((d) => (
        <div className="bar-row" key={d.ending}>
          <span className="bar-label">{d.ending}</span>
          <div className="bar-track">
            <div className={`bar-fill ${clase}`} style={{ width: `${((d.count / maximo) * 100).toFixed(1)}%` }}>
              {d.count}
            </div>
          </div>
        </div>
      ))}
    </>
  )
}

function TarjetaBarras({ titulo, insignia, clase, etiqueta, datos, clasePista }: { titulo: string; insignia: string; clase: string; etiqueta: string; datos: TerminacionConteo[]; clasePista: string }) {
  const revelar = useReveal()
  return (
    <div className="card reveal" ref={revelar}>
      <div className="card-header">
        <h3 className="card-title">{titulo}</h3>
        <span className={`card-badge ${insignia}`}>{clase}</span>
      </div>
      <div className="bar-chart" role="img" aria-label={etiqueta}>
        <Barras datos={datos} clase={clasePista} />
      </div>
    </div>
  )
}

function MapaDeCalor({ frecuencia }: { frecuencia: Record<string, number> }) {
  const claro = useTheme() === 'light'
  const maximo = Math.max(...Object.values(frecuencia), 1)
  const rotulo = { fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }
  const indices = Array.from({ length: 10 }, (_, i) => i)
  return (
    <div className="ending-heatmap" role="img" aria-label="Mapa de calor de 100 terminaciones">
      <div className="heatmap-legend" aria-hidden="true">
        <span>Menor frec.</span>
        <span className="heatmap-scale">
          {[0.08, 0.28, 0.5, 0.75].map((a) => (
            <span key={a} className="heatmap-swatch" style={{ background: `rgba(212,175,55,${a})` }} />
          ))}
        </span>
        <span>{`Mayor frec. (máx: ${maximo})`}</span>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6, paddingLeft: 28 }}>
        {indices.map((c) => (
          <div key={c} style={{ flex: 1, textAlign: 'center', ...rotulo }}>{`x${c}`}</div>
        ))}
      </div>
      {indices.map((r) => (
        <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          <div style={{ width: 24, textAlign: 'right', ...rotulo }}>{`${r}x`}</div>
          {indices.map((c) => {
            const clave = `${r}${c}`
            const v = frecuencia[clave] || 0
            const intensidad = v / maximo
            const fondo = `rgba(212,175,55,${(intensidad * 0.65 + 0.04).toFixed(2)})`
            const color = intensidad > 0.4 ? (claro ? '#fff' : '#0a0a0f') : claro ? '#1a1612' : '#f0ece2'
            return (
              <div key={clave} className={`ending-cell${intensidad >= 0.85 ? ' cell-peak' : ''}`} style={{ flex: 1, background: fondo, color }} title={`${clave}: ${v} veces`}>
                {clave}
                <small style={{ fontSize: '0.55rem', opacity: 0.75 }}>{v}</small>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function Tendencia({ tendencia }: { tendencia: Stats['endings']['trends'] }) {
  const datos = useCallback((): ChartData => {
    const terminaciones = Object.keys(tendencia[0]?.endings ?? {})
    return {
      labels: tendencia.map((t) => t.month),
      datasets: terminaciones.map((e, i) => ({
        label: e,
        data: tendencia.map((t) => (t.endings ?? {})[e] || 0),
        borderColor: DIGIT_COLORS[i % 10],
        backgroundColor: `${DIGIT_COLORS[i % 10]}20`,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 6,
      })),
    }
  }, [tendencia])
  return <Chart type="line" datos={datos} opciones={opcionesTendencia} etiqueta="Gráfico de tendencia de terminaciones" />
}

export function Componente() {
  const stats = useStats()
  const sorteos = useSorteos()
  const [ml] = useML()
  const revelar = useReveal()
  const [cat, setCat] = useState('all')
  const categorias = useMemo(() => categoriasDe(sorteos), [sorteos])

  if (!stats) {
    return (
      <div role="status" aria-label="Cargando terminaciones">
        <Skeleton lineas={4} />
      </div>
    )
  }

  // Si tras recargar los datos desaparece la categoría elegida, el selector y las recomendaciones vuelven a «Todos».
  const catValida = cat === 'all' || categorias.includes(cat) ? cat : 'all'
  const ed = stats.endings ?? SIN_TERMINACIONES
  const porCategoria = catValida !== 'all' ? (stats.endings_by_category?.[catValida as keyof typeof stats.endings_by_category] ?? null) : null
  const recos =
    catValida === 'all'
      ? (ml ? stats.ml_endings : ed.recommendations) ?? []
      : ((ml ? porCategoria?.ml_recommendations : porCategoria?.recommendations) ?? [])
  const bt = porCategoria?.backtest

  let nota: string
  if (catValida === 'all') nota = 'ℹ En las pruebas por categoría con sorteos reales, las terminaciones aciertan como el azar. Elige una categoría para ver la suya.'
  else if (bt)
    nota = `ℹ Prueba del método estadístico con los últimos ${bt.sorteos} sorteos de ${catLabel(catValida)}, recomendando solo con los sorteos anteriores: ${bt.aciertos} aciertos frente a ${bt.aciertos_azar} del azar; al menos 1 acierto en el ${bt.alguna_pct}% de los sorteos frente al ${bt.alguna_pct_azar}% del azar.${ml ? ' El ML no tiene prueba propia aquí (ver Seguimiento).' : ''}`
  else nota = `ℹ ${catLabel(catValida)} tiene muy pocos sorteos para comprobarlo (${porCategoria?.total_endings || 0} terminaciones): una cifra alta aquí es ruido de muestra pequeña.`

  const pestañas = [{ id: 'all', texto: 'Todos' }, ...categorias.map((c) => ({ id: c, texto: catLabel(c) }))]
  const hc = ed.hot_cold ?? { hot: [], cold: [] }
  const bp = ed.by_prize ?? SIN_TERMINACIONES.by_prize
  const tendencia = ed.trends ?? []

  return (
    <>
      <Tablist etiqueta="Categoría de las terminaciones recomendadas" pestañas={pestañas} valor={catValida} onCambio={setCat} idPrefijo="endCat" controla={() => ID_RECOMENDADAS} />
      <div id={ID_RECOMENDADAS} role="region" aria-label="Terminaciones recomendadas" aria-live="polite">
        <div style={{ marginBottom: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Terminaciones recomendadas — <span style={{ color: ml ? 'var(--accent-green)' : 'var(--gold-400)' }}>{ml ? '🤖 Machine Learning' : '📊 Estadístico'}</span>
        </div>
        {recos.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Aún no hay terminaciones recomendadas.</p>
        ) : (
          <div className="reco-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
            {recos.map((r, i) => (
              <div className={`reco-card${ml ? ' reco-ml' : ''}`} style={{ padding: '20px 16px' }} key={r.ending}>
                <BotonCopiar numero={r.ending} />
                <div className="reco-rank">{`${RANGOS[i] || `${i + 1}to`} Terminación`}</div>
                <div className="reco-number">
                  <Balls valor={r.ending} variante={ml ? 'green' : 'gold'} tamano="md" />
                </div>
                <div className="reco-confidence" title="Veces más probable que una terminación al azar (×1.00 = azar)">
                  <div className="conf-bar">
                    <div className="conf-bar-fill" style={{ width: `${liftBar(r.confidence)}%`, ...(ml ? { background: 'linear-gradient(90deg,var(--accent-green),#6ee7b7)' } : {}) }} />
                  </div>
                  {fmtLift(r.confidence)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="section-subtitle terminaciones-nota" style={{ marginTop: 10, fontSize: '0.82rem' }} aria-live="polite">
        {nota}
      </p>

      <div className="grid-2">
        <TarjetaBarras titulo="Terminaciones Calientes" insignia="badge-hot" clase="Hot" etiqueta="Gráfico de terminaciones calientes" datos={hc.hot ?? []} clasePista="hot" />
        <TarjetaBarras titulo="Terminaciones Frías" insignia="badge-cold" clase="Cold" etiqueta="Gráfico de terminaciones frías" datos={hc.cold ?? []} clasePista="cold" />
      </div>

      <div className="grid-3">
        <TarjetaBarras titulo="Top — 1er Premio" insignia="badge-gold" clase="Primero" etiqueta="Terminaciones frecuentes 1er premio" datos={(bp.primero ?? []).slice(0, 10)} clasePista="gold" />
        <TarjetaBarras titulo="Top — 2do Premio" insignia="badge-green" clase="Segundo" etiqueta="Terminaciones frecuentes 2do premio" datos={(bp.segundo ?? []).slice(0, 10)} clasePista="green" />
        <TarjetaBarras titulo="Top — 3er Premio" insignia="badge-purple" clase="Tercero" etiqueta="Terminaciones frecuentes 3er premio" datos={(bp.tercero ?? []).slice(0, 10)} clasePista="purple" />
      </div>

      <div className="card reveal" ref={revelar}>
        <div className="card-header">
          <h3 className="card-title">Mapa de Calor — 100 Terminaciones</h3>
          <span className="card-badge badge-gold">00–99</span>
        </div>
        <MapaDeCalor frecuencia={ed.frequency ?? {}} />
      </div>

      <div className="card reveal" style={{ marginTop: 20 }} ref={revelar}>
        <div className="card-header">
          <h3 className="card-title">Tendencia de Terminaciones por Mes</h3>
          <span className="card-badge badge-green">Top 10</span>
        </div>
        {tendencia.length > 0 && <Tendencia tendencia={tendencia} />}
      </div>
    </>
  )
}
