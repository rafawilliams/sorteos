// Opciones de Chart.js por tema (spec frontend-react, T027). Equivale a `chartOpts()` de static/app.js, con sus colores
// literales (plan §0): los gráficos tienen que verse como hoy en los dos temas.
import type { ChartOptions } from 'chart.js'
import type { Tema } from '../store/tipos'

const COLORES = {
  light: { texto: '#5c554a', tenue: '#9a9189', rejilla: 'rgba(139,105,20,0.1)', fondoTooltip: '#ffffff', bordeTooltip: 'rgba(139,105,20,0.2)', tituloTooltip: '#1a1612' },
  dark: { texto: '#8a8693', tenue: '#4a4656', rejilla: 'rgba(212,175,55,0.06)', fondoTooltip: '#111118', bordeTooltip: '#d4af3740', tituloTooltip: '#f0ece2' },
} as const satisfies Record<Tema, Record<string, string>>

/** Un objeto nuevo en cada llamada: quien lo recibe puede ajustarlo (ejes propios, escalas…) sin afectar a otros gráficos. */
export function chartOptions(tema: Tema, leyenda = true): ChartOptions {
  const c = COLORES[tema]
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: leyenda, position: 'bottom', labels: { color: c.texto, font: { family: 'DM Sans', size: 11 }, boxWidth: 12, padding: 16 } },
      tooltip: { backgroundColor: c.fondoTooltip, borderColor: c.bordeTooltip, borderWidth: 1, titleColor: c.tituloTooltip, bodyColor: c.texto },
    },
    scales: {
      x: { ticks: { color: c.tenue, font: { family: 'DM Sans', size: 10 } }, grid: { color: c.rejilla } },
      y: { ticks: { color: c.tenue, font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: c.rejilla } },
    },
  }
}
