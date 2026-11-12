// Interruptor «Estadístico / ML» (spec frontend-react, T044). Equivale al botón `.ml-toggle` de la plantilla y a
// `setUseMLLP` de static/app.js, pero lo pinta React a partir del Store.
// `data-isla` le dice al código antiguo que no lo toque: `setUseMLLP` actualiza solo los `.ml-toggle` sin esa marca (los de
// la plantilla), porque cambiar el texto de un nodo que React gestiona rompería su siguiente actualización.
import { useML } from '../store/hooks'

export function InterruptorML() {
  const [ml, cambiarML] = useML()
  return (
    <button type="button" className={`ml-toggle${ml ? ' active' : ''}`} data-isla="" aria-pressed={ml} aria-label="Alternar entre modelo ML y Estadístico" onClick={() => cambiarML(!ml)}>
      {ml ? '🤖 ML Activo' : '📊 Estadístico'}
    </button>
  )
}
