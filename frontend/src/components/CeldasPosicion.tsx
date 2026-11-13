// Cuadrícula de dígitos de una posición (spec frontend-react, T047 y T049). Equivale a las `.pos-cell` que
// `renderPositionGrids` y `renderFormatos` de static/app.js armaban con cadenas: el color de fondo crece con la frecuencia.
import type { Frecuencia } from '../api/types'
import { useTheme } from '../store/hooks'

export interface CeldasPosicionProps {
  frecuencia: Frecuencia
  /** Nombre de la posición, para el `title` de cada celda («Millares: dígito 3 — 12 veces»). */
  posicion: string
}

export function CeldasPosicion({ frecuencia, posicion }: CeldasPosicionProps) {
  const claro = useTheme() === 'light'
  const maximo = Math.max(...Object.values(frecuencia), 1)
  return (
    <div className="pos-grid">
      {Object.entries(frecuencia).map(([digito, conteo]) => {
        const intensidad = conteo / maximo
        return (
          <div
            className="pos-cell"
            key={digito}
            style={{ background: `rgba(212,175,55,${(intensidad * 0.6 + 0.05).toFixed(2)})`, color: intensidad > 0.5 ? (claro ? '#fff' : 'var(--bg-deep)') : 'var(--text-primary)' }}
            title={`${posicion}: dígito ${digito} — ${conteo} veces`}
          >
            {digito}
            <br />
            <small style={{ fontSize: '0.6rem', opacity: 0.7 }}>{conteo}</small>
          </div>
        )
      })}
    </div>
  )
}
