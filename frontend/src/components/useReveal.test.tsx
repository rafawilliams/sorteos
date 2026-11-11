import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useReveal } from './useReveal'

function Tarjeta() {
  const ref = useReveal()
  return <div ref={ref} className="card reveal" data-testid="t" />
}

afterEach(() => vi.unstubAllGlobals())

describe('useReveal', () => {
  it('sin IntersectionObserver la tarjeta se muestra al montarse', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const { getByTestId } = render(<Tarjeta />)
    expect(getByTestId('t')).toHaveClass('visible')
  })

  it('con IntersectionObserver espera a que la tarjeta entre en pantalla y entonces deja de observarla', () => {
    let aviso: (e: Array<{ isIntersecting: boolean; target: Element }>) => void = () => {}
    const observe = vi.fn()
    const unobserve = vi.fn()
    const disconnect = vi.fn()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: typeof aviso) {
          aviso = cb
        }
        observe = observe
        unobserve = unobserve
        disconnect = disconnect
      },
    )
    const { getByTestId, unmount } = render(<Tarjeta />)
    const el = getByTestId('t')
    expect(observe).toHaveBeenCalledWith(el)
    expect(el).not.toHaveClass('visible')
    aviso([{ isIntersecting: false, target: el }])
    expect(el).not.toHaveClass('visible')
    aviso([{ isIntersecting: true, target: el }])
    expect(el).toHaveClass('visible')
    expect(unobserve).toHaveBeenCalledWith(el)
    expect(disconnect).not.toHaveBeenCalled()
    unmount()
    expect(disconnect).toHaveBeenCalledTimes(1) // sin fugas al desmontar
  })
})
