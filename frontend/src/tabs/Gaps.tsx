// Isla «Gaps» (spec frontend-react, T017). Equivale a `loadGaps`/`renderGaps` de static/app.js: pide `/api/gaps` la
// primera vez que la pestaña es la activa y guarda el resultado mientras la página siga abierta.
import { useCallback, useEffect, useRef, useState } from 'react'
import { getGaps } from '../api/client'
import type { GapNumero, Gaps, GapTerminacion } from '../api/types'
import { Skeleton } from '../components/Skeleton'
import { useReveal } from '../components/useReveal'
import { useActiveTab } from '../store/hooks'

export const nombre = 'gaps'

type Estado = { fase: 'inactivo' } | { fase: 'cargando' } | { fase: 'error'; mensaje: string } | { fase: 'listo'; datos: Gaps }

const MONO = "'JetBrains Mono'"

/** Color de gravedad por ratio: ≥ 2 rojo, ≥ 1,5 naranja, el resto amarillo (los mismos umbrales que app.js). */
function gravedad(ratio: number): string {
  return ratio >= 2 ? '#ef4444' : ratio >= 1.5 ? '#f97316' : '#eab308'
}

function TablaVencidos({ numeros }: { numeros: GapNumero[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="heatmap-table" role="table" aria-label="Números vencidos">
        <thead>
          <tr>
            <th>Número</th>
            <th>Gap Actual</th>
            <th>Gap Promedio</th>
            <th>Ratio</th>
            <th>Total</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {numeros.map((g) => {
            const color = gravedad(g.ratio)
            return (
              <tr key={g.number}>
                <td style={{ fontFamily: MONO, fontWeight: 700, color: 'var(--gold-400)' }}>{g.number}</td>
                <td style={{ textAlign: 'center', fontFamily: MONO }}>{g.gap}</td>
                <td style={{ textAlign: 'center', fontFamily: MONO }}>{g.avg_gap}</td>
                <td style={{ textAlign: 'center' }}>
                  <span style={{ background: `${color}30`, color, padding: '2px 8px', borderRadius: 8, fontWeight: 700, fontFamily: MONO }}>{g.ratio}x</span>
                </td>
                <td style={{ textAlign: 'center' }}>{g.count}</td>
                <td>
                  <div style={{ background: 'var(--surface-2)', borderRadius: 4, height: 8, width: 80 }}>
                    <div style={{ background: color, height: '100%', borderRadius: 4, width: `${Math.min((g.ratio / 3) * 100, 100)}%` }} />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TerminacionesVencidas({ terminaciones }: { terminaciones: GapTerminacion[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
      {terminaciones.map((e) => (
        <div
          key={e.ending}
          style={{ background: 'var(--surface-2)', padding: '10px 16px', borderRadius: 12, textAlign: 'center', minWidth: 80, borderLeft: `3px solid ${gravedad(e.ratio)}` }}
        >
          <div style={{ fontFamily: MONO, fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>{e.ending}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Gap: {e.gap}</div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: gravedad(e.ratio) }}>{e.ratio}x</div>
        </div>
      ))}
    </div>
  )
}

function Recientes({ numeros }: { numeros: GapNumero[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {numeros.slice(0, 20).map((g) => (
        <span
          key={g.number}
          style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', padding: '6px 12px', borderRadius: 10, fontFamily: MONO, fontSize: '0.85rem' }}
        >
          {g.number}{' '}
          <small style={{ color: 'var(--text-muted)' }}>
            gap:{g.gap} · {g.ratio}x
          </small>
        </span>
      ))}
    </div>
  )
}

function Contenido({ datos }: { datos: Gaps }) {
  const revelar = useReveal()
  return (
    <>
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-value">{datos.total_sorteos.toLocaleString()}</div>
          <div className="stat-label">Sorteos Analizados</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#f87171' }}>
            {datos.overdue_numbers.length}
          </div>
          <div className="stat-label">Números "Vencidos"</div>
        </div>
      </div>

      <div className="card reveal" ref={revelar}>
        <div className="card-header">
          <h3 className="card-title">Números Vencidos</h3>
          <span className="card-badge badge-hot">Ratio &gt; 1</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 12 }}>
          Números frecuentes (5+ apariciones) cuyo gap actual supera su promedio histórico. <strong>Ratio</strong> = gap actual ÷ gap promedio.
        </p>
        <TablaVencidos numeros={datos.overdue_numbers} />
      </div>

      <div className="card reveal" style={{ marginTop: 20 }} ref={revelar}>
        <div className="card-header">
          <h3 className="card-title">Terminaciones Vencidas</h3>
          <span className="card-badge badge-hot">Ratio &gt; 1</span>
        </div>
        <TerminacionesVencidas terminaciones={datos.overdue_endings} />
      </div>

      <div className="card reveal" style={{ marginTop: 20 }} ref={revelar}>
        <div className="card-header">
          <h3 className="card-title">Números Recientes</h3>
          <span className="card-badge badge-green">Ratio ≤ 1</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 12 }}>
          Números frecuentes que aparecieron recientemente (dentro de su ciclo promedio).
        </p>
        <Recientes numeros={datos.ontime_numbers} />
      </div>
    </>
  )
}

export function Componente() {
  const activa = useActiveTab() === 'gaps'
  const [estado, setEstado] = useState<Estado>({ fase: 'inactivo' })
  const iniciado = useRef(false)
  const regionRef = useRef<HTMLDivElement>(null)

  const cargar = useCallback(async () => {
    setEstado({ fase: 'cargando' })
    const r = await getGaps() // si la isla se desmontó mientras tanto, React ignora el cambio de estado
    setEstado(r.ok ? { fase: 'listo', datos: r.data } : { fase: 'error', mensaje: r.mensaje })
  }, [])

  // Primera vez que la pestaña es la activa. La marca `iniciado` evita la segunda petición del doble efecto de StrictMode.
  useEffect(() => {
    if (activa && !iniciado.current) {
      iniciado.current = true
      void cargar()
    }
  }, [activa, cargar])

  return (
    <div role="region" aria-label="Análisis de gaps" ref={regionRef} tabIndex={-1} style={{ outline: 'none' }}>
      {estado.fase === 'cargando' && (
        <div role="status" aria-label="Calculando gaps...">
          <div className="skel-grid">
            <Skeleton lineas={2} />
            <Skeleton lineas={2} />
          </div>
          <Skeleton lineas={5} />
        </div>
      )}
      {estado.fase === 'error' && (
        <div role="alert">
          <p style={{ color: '#f87171' }}>Error cargando gaps. {estado.mensaje}</p>
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
