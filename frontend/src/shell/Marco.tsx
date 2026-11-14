// Cabecera y pie de la página (spec frontend-react, T055). Equivalen al `<header class="hero">`, a `renderLastUpdate` y al
// `<footer id="footerText">` de la plantilla y de static/app.js: título, interruptor de tema, fecha de la última actualización
// y, abajo, el número de sorteos históricos.
import { formatDate } from '../lib/formato'
import { useSorteos, useStats } from '../store/hooks'
import { BotonTema } from './Cabecera'

const PIE_BASE = 'Lotería de Panamá — Análisis Estadístico © 2026'

/**
 * La fecha del último sorteo: la que dice `/api/stats` y, mientras no llegan las estadísticas, la del primer sorteo de la lista
 * (que viene ordenada del más reciente al más antiguo). Vacía si no hay ninguna de las dos.
 */
function useUltimaActualizacion(): string {
  const stats = useStats()
  const sorteos = useSorteos()
  return stats?.last_update || sorteos[0]?.fecha || ''
}

export function Cabecera({ inert }: { inert: boolean }) {
  const fecha = useUltimaActualizacion()
  return (
    <header className="hero" style={{ position: 'relative' }} inert={inert}>
      <BotonTema />
      <div className="hero-badge" aria-hidden="true">
        <span className="dot" /> En vivo — Lotería de Panamá
      </div>
      <h1>Sorteos &amp; Predicciones</h1>
      <p>Consulta resultados, analiza tendencias estadísticas y descubre los números con mayor probabilidad para el próximo sorteo.</p>
      <div className="last-update" id="lastUpdate" role="status" aria-live="polite">
        {fecha ? `Última actualización: ${formatDate(fecha)}` : ''}
      </div>
    </header>
  )
}

export function Pie({ inert }: { inert: boolean }) {
  const fecha = useUltimaActualizacion()
  const total = useSorteos().length
  // Los espacios duros (U+00A0) alrededor de «·» son los `&nbsp;` de la plantilla antigua.
  const texto = fecha ? `${PIE_BASE}  ·  ${total.toLocaleString()} sorteos históricos  ·  Actualizado: ${formatDate(fecha)}` : PIE_BASE
  return (
    <footer className="footer" id="footerText" role="contentinfo" inert={inert}>
      {texto}
    </footer>
  )
}
