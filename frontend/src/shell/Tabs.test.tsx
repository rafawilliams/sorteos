import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StoreProvider } from '../store/StoreProvider'
import { crearReactStore, CLAVE_TEMA, type ReactStore } from '../store/reactStore'
import { TABS } from '../store/tipos'
import { BotonTema, EnlaceDeSalto } from './Cabecera'
import { BotonMenu, FondoMenu, PESTANAS_PRINCIPALES, PestanasPrincipales, useMenuLateral } from './Tabs'

/** La composición que hará el armazón (T055): botón fuera de `.app`; fondo, cabecera, barra, contenido y pie dentro. */
function Armazon() {
  const menu = useMenuLateral()
  return (
    <>
      <EnlaceDeSalto />
      <BotonMenu abierto={menu.abierto} onAlternar={menu.alternar} refBoton={menu.refBoton} />
      <div className="app">
        <FondoMenu abierto={menu.abierto} onCerrar={menu.cerrarConFoco} />
        <header className="hero" inert={menu.abierto}>
          <BotonTema />
        </header>
        <PestanasPrincipales abierto={menu.abierto} alElegir={menu.alElegir} />
        <main id="content" inert={menu.abierto}>
          contenido
        </main>
        <footer inert={menu.abierto}>pie</footer>
      </div>
    </>
  )
}

let store: ReactStore

function montar() {
  store = crearReactStore()
  return render(
    <StoreProvider store={store}>
      <Armazon />
    </StoreProvider>,
  )
}

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T
const boton = () => $<HTMLButtonElement>('#menuToggle')
const nav = () => $('#navTabs')
const fondo = () => $('#menuBackdrop')
const pestana = (id: string) => $<HTMLButtonElement>(`#tab-${id}`)
const tecla = (key: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
const activa = () => store.getSnapshot().activeTab

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  document.body.className = ''
})
afterEach(() => vi.unstubAllGlobals())

describe('barra de pestañas: marcado', () => {
  it('es una lista de pestañas vertical con nombre y las 14 secciones', () => {
    montar()
    expect(screen.getByRole('tablist', { name: 'Secciones principales' })).toBe(nav())
    expect(nav()).toHaveAttribute('aria-orientation', 'vertical')
    expect(nav()).toHaveClass('nav-tabs')
    expect(within(nav()).getAllByRole('tab')).toHaveLength(14)
  })

  it('las pestañas son las 14 del Store, en su orden y con los textos de la plantilla antigua', () => {
    montar()
    expect(PESTANAS_PRINCIPALES.map((p) => p.id)).toEqual([...TABS])
    expect(within(nav()).getAllByRole('tab').map((t) => t.textContent)).toEqual([
      '★ Predicciones', 'Decenas', 'Terminaciones', 'Resultados', 'Estadísticas', 'Tendencias', 'Análisis',
      '⚖ Comparador', '⏳ Gaps', '🎰 Simulador', '⭐ Mis Números', '📅 Mensual', 'Precisión', '🎯 Seguimiento',
    ])
  })

  it('cada pestaña tiene su id tab-<id> y controla la sección sec-<id>', () => {
    montar()
    for (const id of TABS) {
      expect(pestana(id)).toHaveAttribute('aria-controls', `sec-${id}`)
      expect(pestana(id)).toHaveClass('nav-tab')
      expect(pestana(id)).toHaveAttribute('type', 'button')
    }
  })

  it('tres pestañas abren grupo: Resultados, Comparador y Precisión', () => {
    montar()
    const inicios = Array.from(nav().querySelectorAll('.nav-tab-group')).map((t) => t.id)
    expect(inicios).toEqual(['tab-resultados', 'tab-comparador', 'tab-precision'])
  })

  it('empieza con Predicciones elegida y solo ella en el orden de Tab', () => {
    montar()
    expect(pestana('predicciones')).toHaveAttribute('aria-selected', 'true')
    expect(pestana('predicciones')).toHaveClass('active')
    expect(within(nav()).getAllByRole('tab').filter((t) => t.getAttribute('aria-selected') === 'true')).toHaveLength(1)
    expect(within(nav()).getAllByRole('tab').filter((t) => t.tabIndex === 0)).toEqual([pestana('predicciones')])
  })

  it('el botón del menú lleva icono (no texto), nombre accesible y apunta a la barra', () => {
    montar()
    expect(boton()).toHaveAttribute('aria-controls', 'navTabs')
    expect(boton()).toHaveAttribute('aria-expanded', 'false')
    expect(boton()).toHaveAttribute('aria-label', 'Abrir menú de secciones')
    expect(boton().querySelectorAll('svg')).toHaveLength(2)
    boton().querySelectorAll('svg').forEach((s) => expect(s).toHaveAttribute('aria-hidden', 'true'))
    expect(boton().textContent!.trim()).toBe('')
  })

  it('empieza cerrado: la barra sin la clase open y el fondo oculto', () => {
    montar()
    expect(nav()).not.toHaveClass('open')
    expect(fondo().hidden).toBe(true)
    expect(document.body).not.toHaveClass('menu-open')
  })
})

describe('barra de pestañas: ratón y teclado', () => {
  it('un clic elige la pestaña: el Store la guarda y la barra la marca', async () => {
    montar()
    await userEvent.click(pestana('gaps'))
    expect(activa()).toBe('gaps')
    expect(pestana('gaps')).toHaveAttribute('aria-selected', 'true')
    expect(pestana('predicciones')).toHaveAttribute('aria-selected', 'false')
    expect(pestana('gaps').tabIndex).toBe(0)
    expect(pestana('predicciones').tabIndex).toBe(-1)
  })

  it('un cambio de pestaña hecho desde el Store (el botón «Simular») se refleja en la barra', () => {
    montar()
    act(() => store.actions.simularNumero('0042'))
    expect(pestana('simulador')).toHaveAttribute('aria-selected', 'true')
  })

  it('flecha abajo y derecha avanzan; arriba e izquierda retroceden; con vuelta circular', async () => {
    montar()
    pestana('predicciones').focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(activa()).toBe('decenas')
    await userEvent.keyboard('{ArrowRight}')
    expect(activa()).toBe('terminaciones')
    await userEvent.keyboard('{ArrowUp}')
    await userEvent.keyboard('{ArrowLeft}')
    expect(activa()).toBe('predicciones')
    await userEvent.keyboard('{ArrowUp}')
    expect(activa()).toBe('seguimiento')
    await userEvent.keyboard('{ArrowDown}')
    expect(activa()).toBe('predicciones')
  })

  it('Inicio y Fin van a la primera y a la última, y el foco las sigue', async () => {
    montar()
    pestana('estadisticas').focus()
    await userEvent.keyboard('{End}')
    expect(activa()).toBe('seguimiento')
    expect(document.activeElement).toBe(pestana('seguimiento'))
    await userEvent.keyboard('{Home}')
    expect(activa()).toBe('predicciones')
    expect(document.activeElement).toBe(pestana('predicciones'))
  })

  it('las teclas de navegación no desplazan la página y las demás no se tocan', () => {
    montar()
    pestana('predicciones').focus()
    for (const k of ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End']) expect(fireEvent.keyDown(document.activeElement!, { key: k }), k).toBe(false)
    expect(fireEvent.keyDown(document.activeElement!, { key: 'a' })).toBe(true)
  })

  it('con Alt, Ctrl o Meta la tecla es del navegador y no cambia de pestaña', () => {
    montar()
    pestana('predicciones').focus()
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight', altKey: true })
    fireEvent.keyDown(document.activeElement!, { key: 'Home', ctrlKey: true })
    fireEvent.keyDown(document.activeElement!, { key: 'End', metaKey: true })
    expect(activa()).toBe('predicciones')
  })

  it('Tab entra en la lista por la pestaña elegida', async () => {
    montar()
    await userEvent.click(pestana('mensual'))
    await userEvent.click(document.body)
    pestana('mensual').focus()
    await userEvent.tab({ shift: true })
    await userEvent.tab()
    expect(document.activeElement).toBe(pestana('mensual'))
  })
})

describe('menú lateral: abrir y cerrar', () => {
  it('el botón abre: marca la barra, muestra el fondo, cambia el nombre y manda el foco a la sección activa', () => {
    montar()
    fireEvent.click(boton())
    expect(nav()).toHaveClass('open')
    expect(fondo().hidden).toBe(false)
    expect(boton()).toHaveAttribute('aria-expanded', 'true')
    expect(boton()).toHaveAttribute('aria-label', 'Cerrar menú de secciones')
    expect(document.body).toHaveClass('menu-open')
    expect(document.activeElement).toBe(pestana('predicciones'))
  })

  it('al abrir el foco va a la sección que esté activa en ese momento', async () => {
    montar()
    await userEvent.click(pestana('seguimiento'))
    fireEvent.click(boton())
    expect(document.activeElement).toBe(pestana('seguimiento'))
  })

  it('el botón de nuevo cierra y no toca el foco', () => {
    montar()
    fireEvent.click(boton())
    fireEvent.click(boton())
    expect(nav()).not.toHaveClass('open')
    expect(fondo().hidden).toBe(true)
    expect(boton()).toHaveAttribute('aria-expanded', 'false')
    expect(boton()).toHaveAttribute('aria-label', 'Abrir menú de secciones')
    expect(document.body).not.toHaveClass('menu-open')
  })

  it('pulsar el fondo cierra y devuelve el foco al botón (no lo pierde en <body>)', () => {
    montar()
    fireEvent.click(boton())
    fireEvent.click(fondo())
    expect(nav()).not.toHaveClass('open')
    expect(fondo().hidden).toBe(true)
    expect(document.activeElement).toBe(boton())
  })

  it('Escape cierra y devuelve el foco al botón', () => {
    montar()
    fireEvent.click(boton())
    act(() => tecla('Escape'))
    expect(nav()).not.toHaveClass('open')
    expect(document.activeElement).toBe(boton())
  })

  it('Escape con el menú cerrado no hace nada (no roba el foco)', () => {
    montar()
    pestana('decenas').focus()
    act(() => tecla('Escape'))
    expect(document.activeElement).toBe(pestana('decenas'))
    expect(nav()).not.toHaveClass('open')
  })

  it('otra tecla no cierra', () => {
    montar()
    fireEvent.click(boton())
    act(() => tecla('a'))
    expect(nav()).toHaveClass('open')
  })

  it('tras cerrar, Escape ya no tiene escucha: no vuelve a enfocar el botón', () => {
    montar()
    fireEvent.click(boton())
    fireEvent.click(boton())
    pestana('decenas').focus()
    act(() => tecla('Escape'))
    expect(document.activeElement).toBe(pestana('decenas'))
  })

  it('elegir una sección con el menú abierto la activa, cierra el menú y deja el foco en el botón', async () => {
    montar()
    fireEvent.click(boton())
    await userEvent.click(pestana('gaps'))
    expect(activa()).toBe('gaps')
    expect(nav()).not.toHaveClass('open')
    expect(document.activeElement).toBe(boton())
  })

  it('elegir la sección que ya está activa también cierra el menú', async () => {
    montar()
    fireEvent.click(boton())
    await userEvent.click(pestana('predicciones'))
    expect(nav()).not.toHaveClass('open')
  })

  it('Intro sobre una sección con el menú abierto también la elige y cierra', async () => {
    montar()
    fireEvent.click(boton())
    pestana('decenas').focus()
    await userEvent.keyboard('{Enter}')
    expect(activa()).toBe('decenas')
    expect(nav()).not.toHaveClass('open')
    expect(document.activeElement).toBe(boton())
  })

  it('elegir una sección con el menú ya visible (escritorio) no mueve el foco al botón', async () => {
    montar()
    pestana('gaps').focus()
    await userEvent.click(pestana('gaps'))
    expect(document.activeElement).toBe(pestana('gaps'))
  })

  it('las flechas recorren las secciones CON el menú abierto, sin cerrarlo ni quitar el foco de la lista', async () => {
    montar()
    fireEvent.click(boton())
    pestana('predicciones').focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(nav()).toHaveClass('open')
    expect(document.activeElement).toBe(pestana('decenas'))
    expect(activa()).toBe('decenas')
    await userEvent.keyboard('{End}')
    expect(nav()).toHaveClass('open')
    expect(document.activeElement).toBe(pestana('seguimiento'))
    await userEvent.keyboard('{ArrowUp}')
    expect(document.activeElement).toBe(pestana('precision'))
    expect(nav()).toHaveClass('open')
  })

  it('tras recorrer con flechas, un clic en una sección sí cierra (nada queda pegado)', async () => {
    montar()
    fireEvent.click(boton())
    pestana('predicciones').focus()
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.click(pestana('gaps'))
    expect(nav()).not.toHaveClass('open')
    expect(document.activeElement).toBe(boton())
  })

  it('abierto, el resto de la página es inerte; cerrado, deja de serlo', () => {
    montar()
    const resto = () => Array.from(document.querySelector('.app')!.children).filter((el) => el !== nav() && el !== fondo())
    expect(resto().map((el) => el.tagName)).toEqual(["HEADER", "MAIN", "FOOTER"])
    fireEvent.click(boton())
    resto().forEach((el) => expect(el).toHaveAttribute('inert'))
    expect(nav()).not.toHaveAttribute('inert')
    expect(boton()).not.toHaveAttribute('inert')
    fireEvent.click(boton())
    resto().forEach((el) => expect(el).not.toHaveAttribute('inert'))
  })

  it('al ensancharse la ventana con el menú abierto se cierra solo', () => {
    let aviso: (e: { matches: boolean }) => void = () => {}
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: (_: string, f: typeof aviso) => (aviso = f), removeEventListener: () => {} }))
    montar()
    fireEvent.click(boton())
    expect(nav()).toHaveClass('open')
    act(() => aviso({ matches: true }))
    expect(nav()).not.toHaveClass('open')
    expect(fondo().hidden).toBe(true)
  })

  it('al estrecharse la ventana (matches false) el menú abierto no se cierra', () => {
    let aviso: (e: { matches: boolean }) => void = () => {}
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: (_: string, f: typeof aviso) => (aviso = f), removeEventListener: () => {} }))
    montar()
    fireEvent.click(boton())
    act(() => aviso({ matches: false }))
    expect(nav()).toHaveClass('open')
  })

  it('al desmontar se quita la marca del cuerpo y las escuchas', () => {
    const vista = montar()
    fireEvent.click(boton())
    expect(document.body).toHaveClass('menu-open')
    vista.unmount()
    expect(document.body).not.toHaveClass('menu-open')
  })

  it('sin matchMedia en el navegador no falla', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(() => montar()).not.toThrow()
  })
})

describe('botón de tema', () => {
  const tema = () => $<HTMLButtonElement>('#themeToggle')

  it('de partida enseña «Claro» con el sol, nombre accesible y el icono oculto a los lectores', () => {
    montar()
    expect(tema()).toHaveAttribute('aria-label', 'Cambiar tema claro/oscuro')
    expect(tema().querySelector('#themeIcon')!.textContent).toBe('☀️')
    expect(tema().querySelector('#themeIcon')).toHaveAttribute('aria-hidden', 'true')
    expect(tema().querySelector('#themeLabel')!.textContent).toBe('Claro')
    expect(tema()).toHaveAttribute('type', 'button')
  })

  it('pulsarlo pasa al tema claro: el documento, el Store y el navegador lo recuerdan, y el botón ofrece volver', async () => {
    montar()
    await userEvent.click(tema())
    expect(store.getSnapshot().theme).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('light')
    expect(tema().querySelector('#themeIcon')!.textContent).toBe('🌙')
    expect(tema().querySelector('#themeLabel')!.textContent).toBe('Oscuro')
  })

  it('pulsarlo otra vez vuelve al oscuro', async () => {
    montar()
    await userEvent.click(tema())
    await userEvent.click(tema())
    expect(store.getSnapshot().theme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('dark')
    expect(tema().querySelector('#themeLabel')!.textContent).toBe('Claro')
  })

  it('el tema elegido persiste: una página nueva arranca con él', async () => {
    const primera = montar()
    await userEvent.click(tema())
    primera.unmount()
    montar()
    expect(store.getSnapshot().theme).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(tema().querySelector('#themeLabel')!.textContent).toBe('Oscuro')
  })

  it('un cambio de tema hecho desde el Store se refleja en el botón', () => {
    montar()
    act(() => store.actions.setTheme('light'))
    expect(tema().querySelector('#themeLabel')!.textContent).toBe('Oscuro')
  })
})

describe('enlace de salto', () => {
  it('apunta al contenido y lleva el texto de siempre', () => {
    montar()
    const enlace = screen.getByRole('link', { name: 'Saltar al contenido principal' })
    expect(enlace).toHaveAttribute('href', '#content')
    expect(enlace).toHaveClass('skip-link')
    expect(document.getElementById('content')).not.toBeNull()
  })

  it('es lo primero que se alcanza con Tab, antes que el botón del menú y que la barra', async () => {
    montar()
    await userEvent.tab()
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Saltar al contenido principal' }))
  })
})
