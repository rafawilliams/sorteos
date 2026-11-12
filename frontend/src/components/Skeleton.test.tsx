import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Skeleton } from './Skeleton'

// Debe producir el mismo marcado que `skelCard` de static/app.js, para que el esqueleto de una isla sea idéntico al antiguo.
function clases(contenedor: HTMLElement) {
  return Array.from(contenedor.querySelectorAll('.skel-line')).map((l) => l.className)
}

describe('Skeleton replica skelCard', () => {
  it('por defecto pinta 3 líneas: gruesa de 60 %, 80 % y 40 %', () => {
    const { container } = render(<Skeleton />)
    expect(container.querySelectorAll('.skeleton')).toHaveLength(1)
    expect(clases(container)).toEqual(['skel-line thick w60', 'skel-line w40', 'skel-line w80'])
  })

  it('con 4 líneas alterna 40 y 80 tras la gruesa', () => {
    const { container } = render(<Skeleton lineas={4} />)
    expect(clases(container)).toEqual(['skel-line thick w60', 'skel-line w40', 'skel-line w80', 'skel-line w40'])
  })

  it('con 1 línea solo pinta la gruesa', () => {
    const { container } = render(<Skeleton lineas={1} />)
    expect(clases(container)).toEqual(['skel-line thick w60'])
  })

  it('con un número negativo de líneas no falla y pinta el contenedor vacío', () => {
    const { container } = render(<Skeleton lineas={-2} />)
    expect(clases(container)).toEqual([])
  })

  it('con 0 líneas pinta el contenedor vacío', () => {
    const { container } = render(<Skeleton lineas={0} />)
    expect(container.querySelectorAll('.skeleton')).toHaveLength(1)
    expect(clases(container)).toEqual([])
  })
})
