// Aparición progresiva de las tarjetas `.reveal` (spec frontend-react, T017). Equivale a `triggerReveals` de
// static/app.js: la tarjeta nace con opacidad 0 y recibe `visible` cuando entra en pantalla. Sin
// IntersectionObserver (navegadores muy viejos, pruebas) se muestra de inmediato: una tarjeta nunca se queda en blanco.
import { useCallback } from 'react'

export function useReveal(): (el: HTMLElement | null) => void | (() => void) {
  return useCallback((el: HTMLElement | null) => {
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('visible')
      return
    }
    const observador = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((entrada) => {
          if (entrada.isIntersecting) {
            entrada.target.classList.add('visible')
            observador.unobserve(entrada.target)
          }
        })
      },
      { threshold: 0.1 },
    )
    observador.observe(el)
    return () => observador.disconnect() // React 19: se llama al desmontar (y entre los dos montajes de StrictMode)
  }, [])
}
