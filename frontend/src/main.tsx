// Punto de entrada de la interfaz React (spec frontend-react, T016). `static/app.js` se carga antes y publica el
// puente `window.LP`; aquí se descubren las islas de `tabs/` y se montan en sus marcadores `data-react-root`.
import { montarIslas } from './montaje'
import { crearLegacyStore } from './store/legacyStore'

const modulos = import.meta.glob('./tabs/*.tsx', { eager: true })

try {
  montarIslas(modulos, crearLegacyStore())
} catch (error) {
  console.error('No se pudieron montar las islas React', error)
}
