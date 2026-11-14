// Insignia numérica de una pestaña de la barra (`data-badge` de `.nav-tab`, que el CSS pinta como un punto rojo).
// La barra la pinta `shell/Tabs.tsx`, no la isla: la isla le pone su insignia por el `id` del botón (`tab-<id>`). `0` la
// quita, como hacía `tab.dataset.badge=alerts>0?alerts:''` del antiguo static/app.js.
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
