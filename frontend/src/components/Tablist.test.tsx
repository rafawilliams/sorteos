import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Tablist } from './Tablist'

const PESTANAS = [
  { id: 'all', texto: 'Todos' },
  { id: 'dominical', texto: 'Dominical' },
  { id: 'miercolito', texto: 'Miercolito' },
  { id: 'gordito', texto: 'Gordito' },
]

/** Un envoltorio con estado, como lo usan las islas: el valor lo guarda el padre. */
function Controlado({ inicial = 'all', onCambio }: { inicial?: string; onCambio?: (id: string, porTeclado: boolean) => void }) {
  const [valor, setValor] = useState(inicial)
  return (
    <Tablist
      etiqueta="Categoría"
      pestañas={PESTANAS}
      valor={valor}
      idPrefijo="cat"
      onCambio={(id, porTeclado) => {
        setValor(id)
        onCambio?.(id, porTeclado)
      }}
    />
  )
}

const pestana = (nombre: string) => screen.getByRole('tab', { name: nombre })

describe('Tablist: marcado y ARIA', () => {
  it('es un tablist con nombre y una pestaña por elemento', () => {
    render(<Controlado />)
    expect(screen.getByRole('tablist', { name: 'Categoría' })).toBeTruthy()
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Todos', 'Dominical', 'Miercolito', 'Gordito'])
  })

  it('solo la elegida lleva aria-selected, tabindex 0 y la clase active', () => {
    render(<Controlado inicial="miercolito" />)
    for (const t of screen.getAllByRole('tab')) {
      const elegida = t.textContent === 'Miercolito'
      expect(t.getAttribute('aria-selected')).toBe(String(elegida))
      expect(t.getAttribute('tabindex')).toBe(elegida ? '0' : '-1')
      expect(t.classList.contains('active')).toBe(elegida)
    }
  })

  it('cada pestaña tiene id y aria-controls derivados del prefijo', () => {
    render(<Controlado />)
    const t = pestana('Gordito')
    expect(t.id).toBe('cat-tab-gordito')
    expect(t.getAttribute('aria-controls')).toBe('cat-panel-gordito')
  })

  it('con el valor fuera de la lista, la primera pestaña sigue en el orden de Tab', () => {
    render(<Controlado inicial="desaparecida" />)
    expect(screen.getAllByRole('tab').map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1'])
    expect(screen.getAllByRole('tab').every((t) => t.getAttribute('aria-selected') === 'false')).toBe(true)
  })

  it('con una lista vacía pinta el tablist sin fallar', () => {
    render(<Tablist etiqueta="Vacío" pestañas={[]} valor="" idPrefijo="v" onCambio={() => {}} />)
    expect(screen.getByRole('tablist', { name: 'Vacío' })).toBeTruthy()
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
  })

  it('las pestañas son botones de tipo button (no envían formularios)', () => {
    render(<Controlado />)
    expect(screen.getAllByRole('tab').every((t) => t.tagName === 'BUTTON' && t.getAttribute('type') === 'button')).toBe(true)
  })
})

describe('Tablist: ratón y teclado', () => {
  it('un clic llama a onCambio con el id y mueve la selección', async () => {
    const onCambio = vi.fn()
    render(<Controlado onCambio={onCambio} />)
    await userEvent.click(pestana('Dominical'))
    expect(onCambio).toHaveBeenCalledExactlyOnceWith('dominical', false)
    expect(pestana('Dominical').getAttribute('aria-selected')).toBe('true')
    expect(pestana('Todos').getAttribute('aria-selected')).toBe('false')
  })

  it('Flecha derecha pasa a la siguiente, la enfoca y la activa', async () => {
    const onCambio = vi.fn()
    render(<Controlado onCambio={onCambio} />)
    pestana('Todos').focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(pestana('Dominical'))
    expect(onCambio).toHaveBeenLastCalledWith('dominical', true)
    expect(pestana('Dominical').getAttribute('tabindex')).toBe('0')
  })

  it('Flecha derecha en la última vuelve a la primera (circular)', async () => {
    render(<Controlado inicial="gordito" />)
    pestana('Gordito').focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(pestana('Todos'))
    expect(pestana('Todos').getAttribute('aria-selected')).toBe('true')
  })

  it('Flecha izquierda en la primera salta a la última (circular)', async () => {
    render(<Controlado />)
    pestana('Todos').focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(document.activeElement).toBe(pestana('Gordito'))
    expect(pestana('Gordito').getAttribute('aria-selected')).toBe('true')
  })

  it('Inicio va a la primera y Fin a la última', async () => {
    render(<Controlado inicial="miercolito" />)
    pestana('Miercolito').focus()
    await userEvent.keyboard('{End}')
    expect(document.activeElement).toBe(pestana('Gordito'))
    await userEvent.keyboard('{Home}')
    expect(document.activeElement).toBe(pestana('Todos'))
    expect(pestana('Todos').getAttribute('aria-selected')).toBe('true')
  })

  it('las flechas arriba y abajo se comportan como izquierda y derecha, igual que el código antiguo', async () => {
    render(<Controlado />)
    pestana('Todos').focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(pestana('Dominical'))
    await userEvent.keyboard('{ArrowUp}')
    expect(document.activeElement).toBe(pestana('Todos'))
  })

  it('las flechas parten de la pestaña enfocada, no de la elegida', async () => {
    render(<Controlado inicial="all" />)
    pestana('Miercolito').focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(pestana('Gordito'))
  })

  it('el foco llega aunque el padre no cambie el valor', async () => {
    const onCambio = vi.fn()
    render(<Tablist etiqueta="Fija" pestañas={PESTANAS} valor="all" idPrefijo="f" onCambio={onCambio} />)
    pestana('Todos').focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(pestana('Dominical'))
    expect(onCambio).toHaveBeenCalledWith('dominical', true)
  })

  it('las teclas de navegación evitan el desplazamiento de la página y las demás no', () => {
    render(<Controlado />)
    pestana('Todos').focus()
    for (const tecla of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End']) {
      expect(fireEvent.keyDown(document.activeElement!, { key: tecla }), tecla).toBe(false) // false = se llamó a preventDefault
    }
    expect(fireEvent.keyDown(document.activeElement!, { key: 'a' })).toBe(true)
  })

  it('con Alt, Ctrl o Meta las flechas, Inicio y Fin son del navegador y no se tocan', () => {
    const onCambio = vi.fn()
    render(<Controlado onCambio={onCambio} />)
    pestana('Dominical').focus()
    for (const modificador of ['altKey', 'ctrlKey', 'metaKey']) {
      for (const tecla of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
        expect(fireEvent.keyDown(document.activeElement!, { key: tecla, [modificador]: true }), `${modificador}+${tecla}`).toBe(true) // true = sin preventDefault
      }
    }
    expect(onCambio).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(pestana('Dominical'))
  })

  it('una tecla que no es de navegación no hace nada', async () => {
    const onCambio = vi.fn()
    render(<Controlado onCambio={onCambio} />)
    pestana('Todos').focus()
    await userEvent.keyboard('a')
    expect(onCambio).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(pestana('Todos'))
  })

  it('Intro y Espacio activan la pestaña enfocada', async () => {
    const onCambio = vi.fn()
    render(<Controlado onCambio={onCambio} />)
    pestana('Gordito').focus()
    await userEvent.keyboard('{Enter}')
    expect(onCambio).toHaveBeenLastCalledWith('gordito', false)
    pestana('Miercolito').focus()
    await userEvent.keyboard(' ')
    expect(onCambio).toHaveBeenLastCalledWith('miercolito', false)
  })
})

describe('Tablist: variantes de marcado', () => {
  it('usa las clases cat-tabs y cat-tab por defecto', () => {
    const { container } = render(<Controlado />)
    expect(container.querySelector('.cat-tabs')?.getAttribute('role')).toBe('tablist')
    expect(container.querySelectorAll('.cat-tab')).toHaveLength(4)
  })

  it('acepta otras clases (prize-tabs y prize-tab) y un aria-controls propio', () => {
    const { container } = render(
      <Tablist etiqueta="Premio" pestañas={PESTANAS.slice(0, 2)} valor="all" idPrefijo="p" clase="prize-tabs" claseTab="prize-tab" controla={() => 'unico'} onCambio={() => {}} />,
    )
    expect(container.querySelector('.prize-tabs')).toBeTruthy()
    expect(container.querySelectorAll('.prize-tab')).toHaveLength(2)
    expect(screen.getAllByRole('tab').every((t) => t.getAttribute('aria-controls') === 'unico')).toBe(true)
  })

  it('aplica el estilo que se le pasa al contenedor', () => {
    const { container } = render(<Tablist etiqueta="Con estilo" pestañas={PESTANAS.slice(0, 2)} valor="all" idPrefijo="e" estilo={{ marginBottom: 0 }} onCambio={() => {}} />)
    expect((container.querySelector('[role="tablist"]') as HTMLElement).style.marginBottom).toBe('0px')
  })

  it('sin estilo no escribe el atributo style', () => {
    const { container } = render(<Controlado />)
    expect(container.querySelector('[role="tablist"]')?.hasAttribute('style')).toBe(false)
  })

  it('con controla que devuelve undefined no pone aria-controls', () => {
    render(<Tablist etiqueta="Sin panel" pestañas={PESTANAS.slice(0, 2)} valor="all" idPrefijo="s" controla={() => undefined} onCambio={() => {}} />)
    expect(screen.getAllByRole('tab').every((t) => !t.hasAttribute('aria-controls'))).toBe(true)
  })
})

describe('Tablist: origen del cambio, id, orientación y clase por pestaña', () => {
  it('un clic avisa con porTeclado en false y una flecha, Inicio o Fin con true', async () => {
    const onCambio = vi.fn()
    render(<Controlado onCambio={onCambio} />)
    await userEvent.click(pestana('Miercolito'))
    await userEvent.keyboard('{ArrowRight}{Home}{End}')
    expect(onCambio.mock.calls).toEqual([
      ['miercolito', false],
      ['gordito', true],
      ['all', true],
      ['gordito', true],
    ])
  })

  it('Enter y Espacio sobre la pestaña enfocada llegan como clic: porTeclado en false', async () => {
    const onCambio = vi.fn()
    render(<Tablist etiqueta="Fija" pestañas={PESTANAS} valor="all" idPrefijo="f" onCambio={onCambio} />)
    pestana('Dominical').focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    expect(onCambio.mock.calls).toEqual([
      ['dominical', false],
      ['dominical', false],
    ])
  })

  it('sin prefijo los id de las pestañas son tab-<id>; con prefijo, <prefijo>-tab-<id>', () => {
    const { unmount } = render(<Tablist etiqueta="Sin prefijo" pestañas={PESTANAS} valor="all" idPrefijo="" onCambio={() => {}} />)
    expect(screen.getAllByRole('tab').map((t) => t.id)).toEqual(['tab-all', 'tab-dominical', 'tab-miercolito', 'tab-gordito'])
    unmount()
    render(<Tablist etiqueta="Con prefijo" pestañas={PESTANAS} valor="all" idPrefijo="x" onCambio={() => {}} />)
    expect(screen.getAllByRole('tab').map((t) => t.id)).toEqual(['x-tab-all', 'x-tab-dominical', 'x-tab-miercolito', 'x-tab-gordito'])
  })

  it('id y orientación se escriben en el contenedor solo si se piden', () => {
    const { unmount } = render(<Tablist etiqueta="Normal" pestañas={PESTANAS} valor="all" idPrefijo="n" onCambio={() => {}} />)
    const normal = screen.getByRole('tablist', { name: 'Normal' })
    expect(normal.hasAttribute('id')).toBe(false)
    expect(normal.hasAttribute('aria-orientation')).toBe(false)
    unmount()
    render(<Tablist etiqueta="Lateral" pestañas={PESTANAS} valor="all" idPrefijo="l" id="navTabs" orientacion="vertical" onCambio={() => {}} />)
    const lateral = screen.getByRole('tablist', { name: 'Lateral' })
    expect(lateral.id).toBe('navTabs')
    expect(lateral.getAttribute('aria-orientation')).toBe('vertical')
  })

  it('la clase extra de una pestaña va entre la clase base y «active»', () => {
    const conClase = [{ id: 'a', texto: 'A' }, { id: 'b', texto: 'B', clase: 'nav-tab-group' }]
    render(<Tablist etiqueta="Clases" pestañas={conClase} valor="b" idPrefijo="c" claseTab="nav-tab" onCambio={() => {}} />)
    expect(screen.getByRole('tab', { name: 'A' }).className).toBe('nav-tab')
    expect(screen.getByRole('tab', { name: 'B' }).className).toBe('nav-tab nav-tab-group active')
  })
})
