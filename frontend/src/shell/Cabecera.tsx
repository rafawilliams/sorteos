// Enlace de salto y botón de tema (spec frontend-react, T053). Equivalen al `<a class="skip-link">` de la plantilla y a
// `toggleTheme`/`applyTheme` de static/app.js. El tema vive en el Store (que lo aplica al documento y lo recuerda); aquí solo
// se pinta el botón, que enseña a qué tema se pasa al pulsarlo.
import { useSetTheme, useTheme } from '../store/hooks'

/** Primer elemento enfocable de la página: salta la barra lateral y va al contenido (`<main id="content">`). */
export function EnlaceDeSalto() {
  return (
    <a href="#content" className="skip-link">
      Saltar al contenido principal
    </a>
  )
}

export function BotonTema() {
  const tema = useTheme()
  const cambiarTema = useSetTheme()
  const claro = tema === 'light'
  return (
    <button type="button" className="theme-toggle" id="themeToggle" aria-label="Cambiar tema claro/oscuro" onClick={() => cambiarTema(claro ? 'dark' : 'light')}>
      <span id="themeIcon" aria-hidden="true">
        {claro ? '🌙' : '☀️'}
      </span>{' '}
      <span className="label" id="themeLabel">
        {claro ? 'Oscuro' : 'Claro'}
      </span>
    </button>
  )
}
