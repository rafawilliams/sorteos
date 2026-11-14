// Barra de pestañas principal y menú lateral (spec frontend-react, T053). Equivale a `initTabs`, `activateNavTab`,
// `initTablistKeyboard` e `initMenu` de static/app.js: 14 pestañas en una lista vertical con flechas, Inicio y Fin, y, con la
// ventana estrecha, una barra escondida que abre el botón ☰, con fondo oscuro, foco bien devuelto, Escape y resto de la
// página inerte. `Armazon` las compone; aquí cada pieza es independiente.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Tablist } from '../components/Tablist'
import { useActiveTab, useSetActiveTab } from '../store/hooks'
import { TABS, type TabId } from '../store/tipos'

export const ID_BARRA = 'navTabs'

/** Con este ancho o más la barra es fija y visible; con menos se esconde (el mismo punto de corte que style.css). */
const ANCHO_ESCRITORIO = '(min-width:901px)'

interface PestanaPrincipal {
  id: TabId
  texto: string
  /** Resultados, Comparador y Precisión abren un grupo nuevo de la barra (una línea los separa del anterior). */
  clase?: string
}

/** Los textos y el orden de la plantilla antigua. */
export const PESTANAS_PRINCIPALES: PestanaPrincipal[] = [
  { id: 'predicciones', texto: '★ Predicciones' },
  { id: 'decenas', texto: 'Decenas' },
  { id: 'terminaciones', texto: 'Terminaciones' },
  { id: 'resultados', texto: 'Resultados', clase: 'nav-tab-group' },
  { id: 'estadisticas', texto: 'Estadísticas' },
  { id: 'tendencias', texto: 'Tendencias' },
  { id: 'analisis', texto: 'Análisis' },
  { id: 'comparador', texto: '⚖ Comparador', clase: 'nav-tab-group' },
  { id: 'gaps', texto: '⏳ Gaps' },
  { id: 'simulador', texto: '🎰 Simulador' },
  { id: 'favoritos', texto: '⭐ Mis Números' },
  { id: 'mensual', texto: '📅 Mensual' },
  { id: 'precision', texto: 'Precisión', clase: 'nav-tab-group' },
  { id: 'seguimiento', texto: '🎯 Seguimiento' },
]

const esPestana = (id: string): id is TabId => (TABS as readonly string[]).includes(id)
const controlaSeccion = (id: string) => `sec-${id}`

export interface MenuLateral {
  abierto: boolean
  /** El botón ☰: abre o cierra. */
  alternar(): void
  /** Cierra y devuelve el foco al botón (el fondo oscuro, Escape y elegir una sección lo hacen así). */
  cerrarConFoco(): void
  /** Lo que hay que llamar al elegir una pestaña: con el menú abierto la cierra, salvo si el cambio vino de una flecha. */
  alElegir(porTeclado: boolean): void
  refBoton: React.RefObject<HTMLButtonElement | null>
}

/**
 * Estado y comportamiento del menú lateral. Quien lo use debe poner `inert` en todo lo que no sea la barra, el fondo ni el
 * botón mientras `abierto` sea `true` (el fondo oscuro es modal).
 */
export function useMenuLateral(): MenuLateral {
  const [abierto, setAbierto] = useState(false)
  const refBoton = useRef<HTMLButtonElement | null>(null)
  const activa = useActiveTab()
  const activaAlAbrir = useRef(activa)
  activaAlAbrir.current = activa

  const alternar = useCallback(() => setAbierto((a) => !a), [])
  const cerrarConFoco = useCallback(() => {
    setAbierto(false)
    refBoton.current?.focus()
  }, [])

  // Con el menú abierto no se desplaza la página de debajo.
  useEffect(() => {
    document.body.classList.toggle('menu-open', abierto)
    return () => document.body.classList.remove('menu-open')
  }, [abierto])

  // Al abrir, el foco pasa a la sección activa; la barra ya está visible cuando React termina de pintar.
  useEffect(() => {
    if (abierto) document.getElementById(`tab-${activaAlAbrir.current}`)?.focus()
  }, [abierto])

  // Escape cierra solo con el menú abierto: cerrado no roba el foco a quien lo tenga.
  useEffect(() => {
    if (!abierto) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrarConFoco()
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [abierto, cerrarConFoco])

  // Si la ventana se ensancha con el menú abierto, la barra pasa a ser fija y el menú se cierra solo (sin mover el foco).
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const ancho = matchMedia(ANCHO_ESCRITORIO)
    const alCambiar = (e: { matches: boolean }) => {
      if (e.matches) setAbierto(false)
    }
    ancho.addEventListener?.('change', alCambiar)
    return () => ancho.removeEventListener?.('change', alCambiar)
  }, [])

  const alElegir = useCallback(
    (porTeclado: boolean) => {
      if (abierto && !porTeclado) cerrarConFoco()
    },
    [abierto, cerrarConFoco],
  )

  return { abierto, alternar, cerrarConFoco, alElegir, refBoton }
}

/** El botón ☰ (solo se ve con la ventana estrecha): icono, nombre accesible y estado. */
export function BotonMenu({ abierto, onAlternar, refBoton }: { abierto: boolean; onAlternar: () => void; refBoton: MenuLateral['refBoton'] }) {
  return (
    <button className="menu-toggle" id="menuToggle" type="button" ref={refBoton} aria-label={abierto ? 'Cerrar menú de secciones' : 'Abrir menú de secciones'} aria-expanded={abierto} aria-controls={ID_BARRA} onClick={onAlternar}>
      <svg className="ic-menu" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
      <svg className="ic-close" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  )
}

/** El fondo oscuro que tapa la página con el menú abierto; pulsarlo cierra. */
export function FondoMenu({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  return <div className="menu-backdrop" id="menuBackdrop" hidden={!abierto} onClick={onCerrar} />
}

/** La lista vertical de las 14 secciones. */
export function PestanasPrincipales({ abierto, alElegir }: { abierto: boolean; alElegir: (porTeclado: boolean) => void }) {
  const activa = useActiveTab()
  const elegir = useSetActiveTab()
  return (
    <Tablist
      etiqueta="Secciones principales"
      pestañas={PESTANAS_PRINCIPALES}
      valor={activa}
      idPrefijo=""
      id={ID_BARRA}
      orientacion="vertical"
      clase={`nav-tabs${abierto ? ' open' : ''}`}
      claseTab="nav-tab"
      controla={controlaSeccion}
      onCambio={(id, porTeclado) => {
        if (esPestana(id)) elegir(id)
        alElegir(porTeclado)
      }}
    />
  )
}
