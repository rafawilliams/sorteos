// Envoltorio de Chart.js (spec frontend-react, T027; plan §3). Chart.js va empaquetado con el build y solo se registran
// los tipos que usa la interfaz. El gráfico se destruye al desmontar y se destruye y recrea al cambiar el tema, el tipo o
// las funciones de datos y opciones (como `toggleTheme` de static/app.js, que re-renderizaba los gráficos): quien lo
// usa debe memorizarlas (`useCallback`) para no recrearlo en cada render.
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  RadarController,
  RadialLinearScale,
  ScatterController,
  Tooltip,
  type ChartData,
  type ChartOptions,
  type ChartType,
} from 'chart.js'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useTheme } from '../store/hooks'
import type { Tema } from '../store/tipos'

ChartJS.register(BarController, LineController, RadarController, ScatterController, CategoryScale, LinearScale, RadialLinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, Filler)

export interface ChartProps {
  type: ChartType
  /** Datos del gráfico para ese tema. */
  datos: (tema: Tema) => ChartData
  /** Opciones para ese tema (normalmente `chartOptions(tema)` con los ajustes propios del gráfico). */
  opciones: (tema: Tema) => ChartOptions
  /** Altura del contenedor en px; sin ella la fija la hoja de estilos (`.chart-container`). */
  altura?: number
  /** Nombre accesible del gráfico (el canvas es una imagen para los lectores de pantalla). */
  etiqueta?: string
}

const MENOS_MOVIMIENTO = '(prefers-reduced-motion: reduce)'

/** `true` si la persona pide menos movimiento; se actualiza si lo cambia con la página abierta. */
function useMenosMovimiento(): boolean {
  return useSyncExternalStore(
    (aviso) => {
      if (typeof matchMedia !== 'function') return () => {}
      const lista = matchMedia(MENOS_MOVIMIENTO)
      lista.addEventListener?.('change', aviso)
      return () => lista.removeEventListener?.('change', aviso)
    },
    () => typeof matchMedia === 'function' && matchMedia(MENOS_MOVIMIENTO).matches,
    () => false,
  )
}

export function Chart({ type, datos, opciones, altura, etiqueta }: ChartProps) {
  const tema = useTheme()
  const sinMovimiento = useMenosMovimiento()
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const base = opciones(tema)
    const grafico = new ChartJS(el, { type, data: datos(tema), options: sinMovimiento ? { ...base, animation: false } : base })
    return () => grafico.destroy()
  }, [type, datos, opciones, tema, sinMovimiento])

  return (
    <div className="chart-container" style={altura ? { height: altura } : undefined}>
      <canvas ref={canvas} role="img" aria-label={etiqueta} />
    </div>
  )
}
