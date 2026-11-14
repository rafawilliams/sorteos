// Isla «Análisis» (spec frontend-react, T049). Equivale a `renderPositionGrids` y `renderHeatmap` de static/app.js:
// una tarjeta por posición del número ganador (millares, centenas, decenas y unidades) con la cuadrícula de dígitos, y el
// mapa de calor posición contra dígito. El título y el subtítulo de la sección siguen en la plantilla.
import { CeldasPosicion } from '../components/CeldasPosicion'
import { EsperaStats } from '../components/EsperaStats'
import { useReveal } from '../components/useReveal'
import type { Frecuencia } from '../api/types'
import { useStats, useTheme } from '../store/hooks'

export const nombre = 'analisis'

const POSICIONES = ['Millares', 'Centenas', 'Decenas', 'Unidades']
const DIGITOS = Array.from({ length: 10 }, (_, d) => d)
const ROTULO = { padding: 10, color: 'var(--text-muted)', fontSize: '0.72rem' } as const

function TarjetaPosicion({ indice, frecuencia }: { indice: number; frecuencia: Frecuencia }) {
  const revelar = useReveal()
  const posicion = POSICIONES[indice] ?? `Posición ${indice + 1}`
  return (
    <div className="card reveal" ref={revelar}>
      <div className="card-header">
        <div className="card-title">{posicion}</div>
        <span className="card-badge badge-gold">{`Pos ${indice + 1}`}</span>
      </div>
      <CeldasPosicion frecuencia={frecuencia} posicion={posicion} />
    </div>
  )
}

function MapaDeCalor({ posiciones }: { posiciones: Frecuencia[] }) {
  const claro = useTheme() === 'light'
  const maximo = Math.max(...posiciones.flatMap((p) => Object.values(p)), 0)
  return (
    <>
      <div className="heatmap-legend" aria-hidden="true">
        <span>Menor frec.</span>
        <span className="heatmap-scale">
          {[0.08, 0.3, 0.6].map((a) => (
            <span key={a} className="heatmap-swatch" style={{ background: `rgba(212,175,55,${a})` }} />
          ))}
        </span>
        <span>{`Mayor frec. (máx: ${maximo})`}</span>
      </div>
      <table className="heatmap-table">
        <thead>
          <tr>
            <th style={ROTULO}>Posición</th>
            {DIGITOS.map((d) => (
              <th key={d} style={{ ...ROTULO, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {posiciones.map((pos, i) => (
            <tr key={i}>
              <td style={{ padding: 10, color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 600 }}>{POSICIONES[i]}</td>
              {DIGITOS.map((d) => {
                const v = pos[String(d)] || 0
                const intensidad = v / (maximo || 1)
                return (
                  <td
                    key={d}
                    className={intensidad >= 0.9 ? 'cell-peak' : ''}
                    style={{
                      padding: 10,
                      textAlign: 'center',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      background: `rgba(${Math.round(212 * intensidad)},${Math.round(175 * intensidad)},${Math.round(55 * intensidad)},${(intensidad * 0.5 + 0.03).toFixed(2)})`,
                      borderRadius: 8,
                      color: intensidad > 0.4 ? (claro ? '#fff' : '#0a0a0f') : claro ? '#1a1612' : '#f0ece2',
                      cursor: 'default',
                    }}
                    title={`${POSICIONES[i]} dígito ${d}: ${v}`}
                  >
                    {v}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

export function Componente() {
  const stats = useStats()
  const revelar = useReveal()

  if (!stats) {
    return <EsperaStats etiqueta="Cargando análisis" />
  }
  const posiciones = stats.position_frequency ?? []

  return (
    <>
      <div className="grid-4" role="region" aria-label="Grids de frecuencia por posición">
        {posiciones.map((pos, i) => (
          <TarjetaPosicion key={i} indice={i} frecuencia={pos} />
        ))}
      </div>
      <div className="card reveal" ref={revelar}>
        <div className="card-header">
          <h3 className="card-title">Mapa de Calor — Posición vs Dígito</h3>
        </div>
        <div style={{ overflowX: 'auto' }} role="img" aria-label="Mapa de calor posición vs dígito">
          {posiciones.length > 0 && <MapaDeCalor posiciones={posiciones} />}
        </div>
      </div>
    </>
  )
}
