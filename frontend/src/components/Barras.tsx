// Barras horizontales (spec frontend-react, T047). Equivale al marcado `.bar-row` que `renderStatsForPrize`,
// `renderSeriesLetras` y `renderFormatos` de static/app.js armaban con cadenas: el ancho es el conteo relativo al máximo.

export interface BarrasProps {
  /** Pares etiqueta-conteo, en el orden en que se pintan. */
  datos: Array<{ etiqueta: string; conteo: number }>
  /** Clase de color de la barra (`gold`, `green`, `hot`, `cold`…). */
  clase: string
}

export function Barras({ datos, clase }: BarrasProps) {
  const maximo = Math.max(...datos.map((d) => d.conteo), 1)
  return (
    <>
      {datos.map((d, i) => (
        <div className="bar-row" key={`${d.etiqueta}-${i}`}>
          <span className="bar-label">{d.etiqueta}</span>
          <div className="bar-track">
            <div className={`bar-fill ${clase}`} style={{ width: `${((d.conteo / maximo) * 100).toFixed(1)}%` }}>
              {d.conteo}
            </div>
          </div>
        </div>
      ))}
    </>
  )
}
