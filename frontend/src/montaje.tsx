// Montaje de las islas React (spec frontend-react, T016; plan §3 «Isla»).
// Cada módulo de `tabs/` exporta `nombre` (el `data-tab` de su pestaña) y `Componente`; se monta en cada
// `[data-react-root="<nombre>"]` de la página. Añadir una isla no edita ningún registro central.
import { Component, StrictMode, type ComponentType, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { StoreProvider } from './store/StoreProvider'
import type { Store } from './store/tipos'

export interface ModuloIsla {
  nombre: string
  Componente: ComponentType
}

const SELECTOR = '[data-react-root]'
const MARCA_MONTADO = 'data-react-montado'

function esModuloIsla(m: unknown): m is ModuloIsla {
  if (typeof m !== 'object' || m === null) return false
  const { nombre, Componente } = m as Record<string, unknown>
  return typeof nombre === 'string' && nombre !== '' && (typeof Componente === 'function' || (typeof Componente === 'object' && Componente !== null))
}

/** Una isla que falla no debe tumbar las demás ni la parte antigua; el detalle va a la consola, nunca a la página. */
class FronteraDeIsla extends Component<{ nombre: string; children: ReactNode }, { fallo: boolean }> {
  state = { fallo: false }
  static getDerivedStateFromError() {
    return { fallo: true }
  }
  componentDidCatch(error: unknown) {
    console.error(`La isla «${this.props.nombre}» falló`, error)
  }
  render() {
    if (this.state.fallo) {
      return (
        <div role="alert" className="section-subtitle">
          No se pudo mostrar esta sección. Recarga la página para intentarlo de nuevo.
        </div>
      )
    }
    return this.props.children
  }
}

/** Indexa los módulos por nombre. Los inválidos y los repetidos se descartan con un error; no detienen a los demás. */
function indexar(modulos: Record<string, unknown>): Map<string, ModuloIsla> {
  const porNombre = new Map<string, ModuloIsla>()
  for (const [ruta, modulo] of Object.entries(modulos)) {
    if (!esModuloIsla(modulo)) {
      console.error(`El módulo «${ruta}» no exporta \`nombre\` y \`Componente\`: se descarta.`)
      continue
    }
    if (porNombre.has(modulo.nombre)) {
      console.error(`Dos módulos declaran la isla «${modulo.nombre}» (último: «${ruta}»): gana el primero.`)
      continue
    }
    porNombre.set(modulo.nombre, modulo)
  }
  return porNombre
}

/** Monta cada isla en su marcador. Idempotente: un marcador ya montado no se vuelve a montar. */
export function montarIslas(modulos: Record<string, unknown>, store: Store, doc: Document = document): void {
  const porNombre = indexar(modulos)
  doc.querySelectorAll<HTMLElement>(SELECTOR).forEach((marcador) => {
    const nombre = marcador.getAttribute('data-react-root') ?? ''
    const modulo = porNombre.get(nombre)
    if (!modulo) {
      console.warn(`No hay isla para data-react-root="${nombre}": el marcador se deja como está.`)
      return
    }
    if (marcador.hasAttribute(MARCA_MONTADO)) return
    marcador.setAttribute(MARCA_MONTADO, '')
    const { Componente } = modulo
    try {
      createRoot(marcador).render(
        <StrictMode>
          <StoreProvider store={store}>
            <FronteraDeIsla nombre={nombre}>
              <Componente />
            </FronteraDeIsla>
          </StoreProvider>
        </StrictMode>,
      )
    } catch (error) {
      marcador.removeAttribute(MARCA_MONTADO) // sin root no hay isla: que una llamada posterior pueda reintentarlo
      console.error(`No se pudo montar la isla «${nombre}»`, error)
    }
  })
}
