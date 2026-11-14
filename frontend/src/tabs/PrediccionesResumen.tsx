// Isla «Predicciones: resumen» (spec frontend-react, T043). Equivale a `renderDashboard` de static/app.js: la tarjeta del
// último sorteo oficial (con esferas) y los cuatro indicadores (mejor recomendación estadística, mejor de ML, terminación
// caliente del año y total de sorteos). Los premios se muestran tal como llegan (AC4).
import { useRef } from 'react'
import { Balls } from '../components/Balls'
import { EsperaStats } from '../components/EsperaStats'
import { Skeleton } from '../components/Skeleton'
import { catClase, catLabel, fmtLift, formatDate } from '../lib/formato'
import { terminacionCaliente } from '../lib/predicciones'
import { useErrorSorteos, useReload, useSorteos, useStats } from '../store/hooks'

export const nombre = 'predicciones-resumen'

export function Componente() {
  const stats = useStats()
  const sorteos = useSorteos()
  const errorSorteos = useErrorSorteos()
  const recargar = useReload()
  const zonaRef = useRef<HTMLDivElement>(null)
  const ultimo = sorteos[0]
  if (!stats || !ultimo) {
    const reintentar = () => {
      zonaRef.current?.focus() // el botón desaparece al reintentar: el foco pasa al contenedor, no a <body>
      void recargar()
    }
    return (
      <div ref={zonaRef} tabIndex={-1} style={{ outline: 'none' }}>
        {errorSorteos && !ultimo ? (
          <div role="alert">
            <p style={{ color: '#f87171' }}>No se pudo cargar el último sorteo.</p>
            <button type="button" className="btn" onClick={reintentar}>
              Reintentar
            </button>
          </div>
        ) : (
          // Con `errorStats` este panel calla: el aviso con «Reintentar» lo da la lista de recomendaciones, justo debajo.
          <EsperaStats etiqueta="Cargando resumen" avisar={false}>
            <div className="skel-grid">
              <Skeleton lineas={4} />
              <Skeleton lineas={4} />
            </div>
          </EsperaStats>
        )}
      </div>
    )
  }

  const top = stats.recommendations?.[0]
  const topML = stats.ml_recommendations?.[0]
  const anio = new Date().getFullYear()
  const caliente = terminacionCaliente(sorteos, String(anio))
  const total = stats.total_sorteos?.toLocaleString() || '—'

  return (
    <div role="region" aria-label="Resumen rápido">
      <div className="dashboard-hero-grid">
        <div className="last-draw-card">
          <div className="last-draw-header">
            <div className="last-draw-title">
              <span className={`cat-pill cat-${catClase(ultimo.cat)}`}>{catLabel(ultimo.cat || '')}</span>
              <span>Último Sorteo Oficial</span>
            </div>
            <span className="last-draw-date">{formatDate(ultimo.fecha)}</span>
          </div>
          <div className="last-draw-prizes">
            <div className="last-draw-prize-box prize-box-1" title="1er Premio">
              <span className="last-draw-prize-label">1er Premio</span>
              <Balls valor={ultimo.primero} variante="gold" tamano="md" />
            </div>
            <div className="last-draw-prize-box prize-box-2" title="2do Premio">
              <span className="last-draw-prize-label">2do Premio</span>
              <Balls valor={ultimo.segundo} variante="green" tamano="md" />
            </div>
            <div className="last-draw-prize-box prize-box-3" title="3er Premio">
              <span className="last-draw-prize-label">3er Premio</span>
              <Balls valor={ultimo.tercero} variante="purple" tamano="md" />
            </div>
          </div>
          <div className="last-draw-meta">
            <span>
              Letras: <strong>{ultimo.letra || '—'}</strong>
            </span>
            <span>
              Serie: <strong>{ultimo.serie || '—'}</strong>
            </span>
            <span>
              Folio: <strong>{ultimo.folio || '—'}</strong>
            </span>
          </div>
        </div>
        <div className="dashboard-kpis">
          <div className="kpi-card">
            <div className="kpi-label">Top Recomendación</div>
            <div>
              <Balls valor={top?.number} variante="gold" tamano="sm" />
            </div>
            <div className="kpi-sub">{`📊 Estadístico · ${top ? fmtLift(top.confidence) : '—'}`}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Top ML</div>
            <div>
              <Balls valor={topML?.number} variante="green" tamano="sm" />
            </div>
            <div className="kpi-sub">{`🤖 Machine Learning · ${topML ? fmtLift(topML.confidence) : '—'}`}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Terminación Caliente</div>
            <div>
              <Balls valor={caliente.ending} variante="hot" tamano="sm" />
            </div>
            <div className="kpi-sub">{`🔥 ${caliente.count} veces en ${anio}`}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Total Sorteos</div>
            <div className="stat-value" style={{ fontSize: '1.75rem', lineHeight: 1.1 }}>
              {total}
            </div>
            <div className="kpi-sub">Historial desde 1919</div>
          </div>
        </div>
      </div>
    </div>
  )
}
