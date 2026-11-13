// Punto de entrada de la interfaz React (spec frontend-react, T055). Crea el almacén, pinta el armazón en `#root` y lanza la
// primera carga de datos. Antes `static/app.js` era el dueño del armazón y de la carga, y aquí se montaban las islas.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Armazon } from './shell/Armazon'
import { StoreProvider } from './store/StoreProvider'
import { crearReactStore } from './store/reactStore'

const raiz = document.getElementById('root')

if (raiz) {
  const store = crearReactStore()
  createRoot(raiz).render(
    <StrictMode>
      <StoreProvider store={store}>
        <Armazon />
      </StoreProvider>
    </StrictMode>,
  )
  void store.cargar()
} else {
  console.error('Falta el elemento #root: no se puede montar la interfaz.')
}
