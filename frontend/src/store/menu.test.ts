/**
 * Menú lateral (decisión del dueño, 2026-11-11): la barra de pestañas pasa a barra lateral. En pantallas estrechas se
 * esconde y un botón con el icono de menú (☰) la abre. Se prueba contra el `app.js` y la plantilla reales (ver
 * legacyHarness.ts); el aspecto (CSS) se comprueba aparte con un navegador.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { levantarLegacy } from './legacyHarness'

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T
const boton = () => $<HTMLButtonElement>('#menuToggle')
const nav = () => $('#navTabs')
const fondo = () => $('#menuBackdrop')
const tecla = (key: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))

beforeEach(async () => {
  await levantarLegacy().iniciar()
})
afterEach(() => vi.unstubAllGlobals())

describe('marcado del menú', () => {
  it('la barra sigue siendo la lista de pestañas, ahora vertical, con las 14 secciones', () => {
    expect(nav()).toHaveAttribute('role', 'tablist')
    expect(nav()).toHaveAttribute('aria-orientation', 'vertical')
    expect(nav().querySelectorAll('[role="tab"]')).toHaveLength(14)
  })

  it('los grupos se separan con tres marcas (Resultados, Comparador y Precisión abren grupo)', () => {
    const inicios = Array.from(nav().querySelectorAll('.nav-tab-group')).map((t) => (t as HTMLElement).dataset.tab)
    expect(inicios).toEqual(['resultados', 'comparador', 'precision'])
  })

  it('el botón del menú lleva icono (no texto), nombre accesible y apunta a la barra', () => {
    expect(boton()).toHaveAttribute('aria-controls', 'navTabs')
    expect(boton()).toHaveAttribute('aria-expanded', 'false')
    expect(boton()).toHaveAttribute('aria-label', 'Abrir menú de secciones')
    const icono = boton().querySelector('svg')
    expect(icono).not.toBeNull()
    expect(icono).toHaveAttribute('aria-hidden', 'true')
    expect(boton().textContent!.trim()).toBe('')
  })

  it('empieza cerrado: la barra sin la clase open y el fondo oculto', () => {
    expect(nav()).not.toHaveClass('open')
    expect(fondo().hidden).toBe(true)
  })
})

describe('abrir y cerrar', () => {
  it('el botón abre: marca la barra, muestra el fondo, cambia el nombre y manda el foco a la sección activa', () => {
    boton().click()
    expect(nav()).toHaveClass('open')
    expect(fondo().hidden).toBe(false)
    expect(boton()).toHaveAttribute('aria-expanded', 'true')
    expect(boton()).toHaveAttribute('aria-label', 'Cerrar menú de secciones')
    expect(document.body).toHaveClass('menu-open')
    expect(document.activeElement).toBe($('#tab-predicciones'))
  })

  it('el botón de nuevo cierra', () => {
    boton().click()
    boton().click()
    expect(nav()).not.toHaveClass('open')
    expect(fondo().hidden).toBe(true)
    expect(boton()).toHaveAttribute('aria-expanded', 'false')
    expect(boton()).toHaveAttribute('aria-label', 'Abrir menú de secciones')
    expect(document.body).not.toHaveClass('menu-open')
  })

  it('pulsar el fondo cierra', () => {
    boton().click()
    fondo().click()
    expect(nav()).not.toHaveClass('open')
    expect(fondo().hidden).toBe(true)
  })

  it('Escape cierra y devuelve el foco al botón', () => {
    boton().click()
    tecla('Escape')
    expect(nav()).not.toHaveClass('open')
    expect(document.activeElement).toBe(boton())
  })

  it('Escape con el menú cerrado no hace nada (no roba el foco)', () => {
    $('#tab-decenas').focus()
    tecla('Escape')
    expect(document.activeElement).toBe($('#tab-decenas'))
    expect(nav()).not.toHaveClass('open')
  })

  it('otra tecla no cierra', () => {
    boton().click()
    tecla('a')
    expect(nav()).toHaveClass('open')
  })

  it('elegir una sección con el menú abierto la activa, cierra el menú y deja el foco en el botón', () => {
    boton().click()
    $('#tab-gaps').click()
    expect($('#sec-gaps')).toHaveClass('active')
    expect(nav()).not.toHaveClass('open')
    expect(document.activeElement).toBe(boton())
  })

  it('elegir una sección con el menú ya visible (escritorio) no mueve el foco al botón', () => {
    $('#tab-gaps').focus()
    $('#tab-gaps').click()
    expect(document.activeElement).toBe($('#tab-gaps'))
  })

  it('al ensancharse la ventana con el menú abierto se cierra solo', () => {
    let aviso: (e: { matches: boolean }) => void = () => {}
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: (_: string, f: typeof aviso) => (aviso = f) }))
    return levantarLegacy()
      .iniciar()
      .then(() => {
        boton().click()
        expect(nav()).toHaveClass('open')
        aviso({ matches: true })
        expect(nav()).not.toHaveClass('open')
        expect(fondo().hidden).toBe(true)
      })
  })
})
