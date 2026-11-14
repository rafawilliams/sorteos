// Espera de las estadísticas (cierra Q16 de la migración a React). Una isla que lee `stats` lo usa mientras `stats` es
// `null`: pinta su esqueleto (`children`, o cuatro líneas por defecto) y, si la carga ha fallado tras sus reintentos
// (`errorStats`), dice que no se pudo y ofrece «Reintentar». Es el mismo aviso que Resultados da para los sorteos.
import { useRef, type CSSProperties, type ReactNode } from 'react'
import { useErrorStats, useReload } from '../store/hooks'
import { Skeleton } from './Skeleton'

export interface EsperaStatsProps {
  /** Nombre accesible del esqueleto (`aria-label` de la región «status»), p. ej. «Cargando decenas». */
  etiqueta: string
  /** Se pone en el contenedor en los dos estados: algunas islas lo usan como destino de `aria-controls`. */
  id?: string
  estilo?: CSSProperties
  /** El esqueleto propio de la isla; sin él, cuatro líneas. */
  children?: ReactNode
  /**
   * `false` para una isla que comparte sección con otra que ya da el aviso con «Reintentar»: con `errorStats` no pinta
   * nada (ni aviso ni esqueleto, que quedaría cargando para siempre). Sin error se comporta igual. Por defecto `true`.
   */
  avisar?: boolean
}

export function EsperaStats({ etiqueta, id, estilo, children, avisar = true }: EsperaStatsProps) {
  const error = useErrorStats()
  const recargar = useReload()
  const zonaRef = useRef<HTMLDivElement>(null)

  const reintentar = () => {
    zonaRef.current?.focus() // el botón desaparece al reintentar: el foco pasa al contenedor, no a <body>
    void recargar()
  }

  return (
    <div id={id} ref={zonaRef} tabIndex={-1} style={{ outline: 'none', ...estilo }}>
      {error && !avisar ? null : error ? (
        <div role="alert">
          <p style={{ color: '#f87171' }}>No se pudieron cargar las estadísticas.</p>
          <button type="button" className="btn" onClick={reintentar}>
            Reintentar
          </button>
        </div>
      ) : (
        <div role="status" aria-label={etiqueta}>
          {children ?? <Skeleton lineas={4} />}
        </div>
      )}
    </div>
  )
}
