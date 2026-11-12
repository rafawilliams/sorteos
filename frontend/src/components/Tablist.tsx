// Lista de pestañas accesible (spec frontend-react, T038). Equivale a `initTablistKeyboard` y `_setAriaTab` de static/app.js
// aplicadas a `.cat-tabs` y `.prize-tabs`: `role="tablist"`/`tab`, `aria-selected`, orden de Tab móvil (solo la elegida está
// en él) y navegación con flechas, Inicio y Fin. Como en el código antiguo, las flechas enfocan la pestaña y la activan, y
// las flechas arriba y abajo hacen lo mismo que derecha e izquierda.
import { useRef, type KeyboardEvent } from 'react'

export interface PestanaDeLista {
  id: string
  texto: string
}

export interface TablistProps {
  etiqueta: string
  pestañas: PestanaDeLista[]
  valor: string
  onCambio: (id: string) => void
  /** Prefijo de los `id`: cada pestaña es `${idPrefijo}-tab-${id}` y, por defecto, controla `${idPrefijo}-panel-${id}`. */
  idPrefijo: string
  /** Clase del contenedor (`cat-tabs` por defecto; `prize-tabs` en los selectores de premio). */
  clase?: string
  /** Clase de cada pestaña (`cat-tab` por defecto; `prize-tab`). */
  claseTab?: string
  /** `aria-controls` de cada pestaña; `undefined` lo omite (para listas que no controlan ningún panel con ese `id`). */
  controla?: (id: string) => string | undefined
}

export function Tablist({ etiqueta, pestañas, valor, onCambio, idPrefijo, clase = 'cat-tabs', claseTab = 'cat-tab', controla }: TablistProps) {
  const botones = useRef<Array<HTMLButtonElement | null>>([])
  // Si el valor ya no está en la lista, la primera pestaña conserva el acceso con Tab: sin esto la lista quedaría inalcanzable.
  const hayElegida = pestañas.some((p) => p.id === valor)

  const alTeclear = (e: KeyboardEvent<HTMLDivElement>) => {
    // Con Alt, Ctrl o Meta la tecla es del navegador (Alt+← es «atrás», Ctrl+Inicio va al principio de la página): no se secuestra.
    if (e.altKey || e.ctrlKey || e.metaKey) return
    const actual = botones.current.findIndex((b) => b !== null && b === document.activeElement)
    if (actual < 0 || pestañas.length === 0) return
    let siguiente = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') siguiente = (actual + 1) % pestañas.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') siguiente = (actual - 1 + pestañas.length) % pestañas.length
    else if (e.key === 'Home') siguiente = 0
    else if (e.key === 'End') siguiente = pestañas.length - 1
    const destino = pestañas[siguiente]
    if (!destino) return
    e.preventDefault()
    botones.current[siguiente]?.focus()
    onCambio(destino.id)
  }

  return (
    <div className={clase} role="tablist" aria-label={etiqueta} onKeyDown={alTeclear}>
      {pestañas.map((p, i) => {
        const elegida = p.id === valor
        const panel = controla ? controla(p.id) : `${idPrefijo}-panel-${p.id}`
        return (
          <button
            type="button"
            key={p.id}
            id={`${idPrefijo}-tab-${p.id}`}
            ref={(el) => {
              botones.current[i] = el
            }}
            className={`${claseTab}${elegida ? ' active' : ''}`}
            role="tab"
            aria-selected={elegida}
            aria-controls={panel}
            tabIndex={elegida || (!hayElegida && i === 0) ? 0 : -1}
            onClick={() => onCambio(p.id)}
          >
            {p.texto}
          </button>
        )
      })}
    </div>
  )
}
