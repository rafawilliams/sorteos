import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Balls } from './Balls'

// Las esferas muestran el premio TAL COMO LLEGA: «98», «0074», «05309» o vacío (principio 7 de la constitución).

function bolas(contenedor: HTMLElement) {
  return Array.from(contenedor.querySelectorAll('.lotto-ball')).map((b) => b.textContent)
}

describe('Balls: una esfera por carácter del premio, sin transformarlo', () => {
  it.each([
    ['98', ['9', '8']],
    ['0074', ['0', '0', '7', '4']],
    ['05309', ['0', '5', '3', '0', '9']],
    ['9614', ['9', '6', '1', '4']],
  ])('el premio %s pinta sus %i caracteres', (premio, esperadas) => {
    const { container } = render(<Balls valor={premio} />)
    expect(bolas(container)).toEqual(esperadas)
  })

  it('un premio de 2 cifras no se rellena hasta 4', () => {
    const { container } = render(<Balls valor="98" />)
    expect(bolas(container)).toHaveLength(2)
  })

  it('un premio sin ceros a la izquierda no se rellena con ellos', () => {
    const { container } = render(<Balls valor="74" />)
    expect(bolas(container)).toEqual(['7', '4'])
  })

  it('quita los espacios de los extremos pero no toca el resto', () => {
    const { container } = render(<Balls valor="  98  " />)
    expect(bolas(container)).toEqual(['9', '8'])
  })
})

describe('Balls: accesibilidad y estructura', () => {
  it('el contenedor lleva el premio completo como etiqueta y las esferas se ocultan a los lectores de pantalla', () => {
    const { container } = render(<Balls valor="0074" />)
    const contenedor = container.querySelector('.lotto-balls')
    expect(contenedor).toHaveAttribute('aria-label', '0074')
    for (const b of container.querySelectorAll('.lotto-ball')) expect(b).toHaveAttribute('aria-hidden', 'true')
  })

  it('usa por defecto la variante dorada y el tamaño grande', () => {
    const { container } = render(<Balls valor="12" />)
    expect(container.querySelector('.lotto-balls')).toHaveClass('lotto-balls-lg')
    expect(container.querySelector('.lotto-ball')).toHaveClass('ball-gold')
  })

  it.each([
    ['green', 'md'],
    ['purple', 'sm'],
    ['hot', 'sm'],
  ] as const)('aplica la variante %s y el tamaño %s a las clases', (variante, tamano) => {
    const { container } = render(<Balls valor="12" variante={variante} tamano={tamano} />)
    expect(container.querySelector('.lotto-balls')).toHaveClass(`lotto-balls-${tamano}`)
    for (const b of container.querySelectorAll('.lotto-ball')) expect(b).toHaveClass(`ball-${variante}`)
  })
})

describe('Balls: valores vacíos', () => {
  it.each([[''], ['   '], [null], [undefined]])('el valor %j se muestra como un guion largo, sin esferas', (valor) => {
    const { container } = render(<Balls valor={valor as string | null | undefined} />)
    expect(container.querySelectorAll('.lotto-ball')).toHaveLength(0)
    const vacio = container.querySelector('.num-empty')
    expect(vacio).toHaveTextContent('—')
  })
})

describe('Balls: el texto se escapa', () => {
  it('un valor con HTML se pinta como texto, no como marcado', () => {
    const { container } = render(<Balls valor="<b>" />)
    expect(container.querySelector('b')).toBeNull()
    expect(bolas(container)).toEqual(['<', 'b', '>'])
    expect(container.querySelector('.lotto-balls')).toHaveAttribute('aria-label', '<b>')
  })
})
