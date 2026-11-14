// Borde de errores de una sección (spec frontend-react, T055). Es la `FronteraDeIsla` de `montaje.tsx`: una sección que falla
// no debe tumbar las demás ni el armazón. El detalle va a la consola, nunca a la página.
import { Component, type ReactNode } from 'react'

interface Props {
  /** Nombre de la sección, solo para el registro de la consola. */
  nombre: string
  children: ReactNode
}

export class FronteraDeSeccion extends Component<Props, { fallo: boolean }> {
  state = { fallo: false }
  static getDerivedStateFromError() {
    return { fallo: true }
  }
  componentDidCatch(error: unknown) {
    console.error(`La sección «${this.props.nombre}» falló`, error)
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
