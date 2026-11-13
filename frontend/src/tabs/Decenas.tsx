// Isla «Decenas» (spec frontend-react, T039). Equivale a `renderDecenas` de static/app.js: una tarjeta por categoría con el
// triángulo de los 3 últimos sorteos, la decena recomendada, su confianza («×N azar»), la prueba hacia atrás frente al azar,
// los últimos 3 sorteos y la distribución de decenas que siguieron al patrón.
// El título y el subtítulo de la sección siguen en la plantilla; la isla pinta la región `Decenas recomendadas`.
import { EsperaStats } from '../components/EsperaStats'
import { useReveal } from '../components/useReveal'
import type { DecenaCategoria } from '../api/types'
import { catLabel, fmtLift, formatDate } from '../lib/formato'
import { useStats } from '../store/hooks'

export const nombre = 'decenas'

const MINIMO_POR_DEFECTO = 20
const ETIQUETA_METODO: Record<string, string> = {
  triple: 'Patrón de 3 sorteos',
  pair: 'Patrón de 2 sorteos',
  frecuencia: 'Frecuencia general',
  fallback: 'Frecuencia general',
}

const etiquetaMetodo = (metodo: string) => (Object.hasOwn(ETIQUETA_METODO, metodo) ? ETIQUETA_METODO[metodo] : metodo)
const esFrecuencia = (metodo: string) => metodo === 'frecuencia' || metodo === 'fallback'

function Triangulo({ ultimos, recomendada }: { ultimos: string[]; recomendada: string }) {
  const esquina = (cx: number, cy: number, valor: string | undefined) => (
    <>
      <circle cx={cx} cy={cy} r={18} fill="var(--accent-cold)" />
      <text x={cx} y={cy + 6} textAnchor="middle" fill="#fff" fontSize={18} fontWeight={700} fontFamily="var(--font-mono)">
        {valor ?? ''}
      </text>
    </>
  )
  return (
    <div className="triangle-wrap">
      <svg viewBox="0 0 200 190" className="triangle-svg">
        <polygon points="100,10 15,175 185,175" fill="none" stroke="var(--accent-cold)" strokeWidth={3} />
        <polygon points="100,50 45,155 155,155" fill="rgba(212,175,55,0.15)" stroke="var(--gold-400)" strokeWidth={2.5} />
        <polygon points="100,80 70,140 130,140" fill="rgba(212,175,55,0.3)" stroke="var(--gold-300)" strokeWidth={2} />
        {esquina(100, 10, ultimos[2])}
        {esquina(15, 175, ultimos[0])}
        {esquina(185, 175, ultimos[1])}
        <circle cx={100} cy={120} r={24} fill="var(--gold-400)" />
        <text x={100} y={128} textAnchor="middle" fill="var(--bg-deep)" fontSize={24} fontWeight={900} fontFamily="var(--font-mono)">
          {recomendada}
        </text>
      </svg>
      <div className="triangle-label">DECENAS</div>
    </div>
  )
}

function Tarjeta({ cat, d }: { cat: string; d: DecenaCategoria }) {
  const revelar = useReveal()
  const ultimos = d.last_3 ?? []
  const fechas = d.last_3_fechas ?? []
  const dist = Object.entries(d.follower_distribution ?? {})
  const maximo = Math.max(...dist.map(([, n]) => n), 1)
  const muestras = d.muestras ?? '—'
  const coincidencias = esFrecuencia(d.method)
    ? `${d.match_count} sorteos (ningún patrón llega a ${d.minimo || MINIMO_POR_DEFECTO} coincidencias)`
    : `${d.match_count} sorteos coincidentes`
  const prueba = d.backtest
    ? `ℹ Prueba con los últimos ${d.backtest.sorteos} sorteos: la decena recomendada salió en algún premio el ${d.backtest.acierto_pct}% de las veces, frente al ${d.backtest.acierto_pct_azar}% del azar.`
    : 'ℹ Muy pocos sorteos desde 1995 para comprobarlo.'

  return (
    <div className="card reveal decena-card" ref={revelar}>
      <div className="card-header">
        <div className="card-title">{catLabel(cat)}</div>
        <span className="card-badge badge-gold">{etiquetaMetodo(d.method)}</span>
      </div>
      <div className="decena-body">
        <Triangulo ultimos={ultimos} recomendada={d.recommended} />
        <div className="decena-info">
          <div className="decena-main">
            <div className="decena-rec-label">Decena recomendada</div>
            <div className="decena-rec-number">{d.recommended}</div>
            <div className="decena-confidence" title="Veces más probable que una decena al azar (×1.00 = azar)">
              {`${fmtLift(d.confidence)} · ${coincidencias} · ${muestras} decenas`}
            </div>
            <div className="decena-confidence" style={{ opacity: 0.85 }}>
              {prueba}
            </div>
          </div>
          <div className="decena-last3">
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>Últimos 3 sorteos:</div>
            {ultimos.map((dec, i) => (
              <div className="decena-last3-row" key={i}>
                <span className="decena-fecha">{formatDate(fechas[i])}</span>
                <span className="decena-val">{dec}</span>
              </div>
            ))}
          </div>
          <div className="decena-dist">
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>Distribución:</div>
            {dist.map(([digito, conteo]) => (
              <div className="bar-row" style={{ gap: 6 }} key={digito}>
                <span className="bar-label" style={{ width: 20, fontSize: '0.75rem' }}>
                  {digito}
                </span>
                <div className="bar-track" style={{ height: 20 }}>
                  <div className={`bar-fill ${digito === d.recommended ? 'gold' : 'green'}`} style={{ width: `${((conteo / maximo) * 100).toFixed(1)}%` }}>
                    {conteo || ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function Componente() {
  const stats = useStats()
  if (!stats) {
    return <EsperaStats etiqueta="Cargando decenas" />
  }
  const categorias = Object.entries(stats.decena_recomendada ?? {}).filter((par): par is [string, DecenaCategoria] => par[1] !== undefined)
  return (
    <div role="region" aria-label="Decenas recomendadas">
      {categorias.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>No hay suficientes datos para análisis de decenas.</p>
      ) : (
        <div className="decena-grid">
          {categorias.map(([cat, d]) => (
            <Tarjeta key={cat} cat={cat} d={d} />
          ))}
        </div>
      )}
    </div>
  )
}
