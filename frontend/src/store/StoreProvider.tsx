// Proveedor del Store (spec frontend-react, T014): las islas reciben el almacén por contexto y no lo importan,
// así las pruebas inyectan un doble y la última etapa cambia `LegacyStore` por `ReactStore` sin tocar pestañas.
import { createContext, useContext, type ReactNode } from 'react'
import type { Store } from './tipos'

const ContextoStore = createContext<Store | null>(null)

export function StoreProvider({ store, children }: { store: Store; children: ReactNode }) {
  return <ContextoStore.Provider value={store}>{children}</ContextoStore.Provider>
}

/** El almacén del proveedor más cercano. Falla con un mensaje claro si no hay ninguno. */
export function useStore(): Store {
  const store = useContext(ContextoStore)
  if (store === null) {
    throw new Error('useStore se usó fuera de un <StoreProvider store={…}>: envuelve la isla con el proveedor.')
  }
  return store
}
