// Insignia numérica de una pestaña de la barra (`data-badge` de `.nav-tab`, que el CSS pinta como un punto rojo).
// La barra todavía es del código antiguo (se migra con el armazón, T052): mientras tanto una isla puede ponerle su
// insignia. `0` la quita, como `tab.dataset.badge=alerts>0?alerts:''` de static/app.js.
import { useEffect } from 'react'
import type { TabId } from '../store/tipos'

export function useInsignia(pestana: TabId, valor: number): void {
  useEffect(() => {
    const boton = document.getElementById(`tab-${pestana}`)
    if (!boton) return
    boton.dataset.badge = valor > 0 ? String(valor) : ''
    return () => {
      boton.dataset.badge = ''
    }
  }, [pestana, valor])
}
