import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { montarIslas } from './montaje'
import { crearStoreFalso } from './store/storeFalso'
import { useActiveTab, useStats } from './store/hooks'

// El descubrimiento (`import.meta.glob`) vive en main.tsx; aquí se prueba el montaje con módulos escritos a mano.

function Hola() {
  return <p>hola gaps</p>
}
function LeeStore() {
  const tab = useActiveTab()
  const stats = useStats()
  return <p>{`tab=${tab} stats=${stats === null ? 'nulo' : 'datos'}`}</p>
}
function Rota(): never {
  throw new Error('fallo interno con detalles secretos')
}

// `createRoot` real, salvo cuando una prueba pide que falle una vez.
const control = vi.hoisted(() => ({ fallarCreateRoot: false }))
vi.mock('react-dom/client', async (original) => {
  const real = await original<typeof import('react-dom/client')>()
  return {
    ...real,
    createRoot: (...args: Parameters<typeof real.createRoot>) => {
      if (control.fallarCreateRoot) {
        control.fallarCreateRoot = false
        throw new Error('contenedor inválido')
      }
      return real.createRoot(...args)
    },
  }
})

const modulo = (nombre: string, Componente: unknown) => ({ nombre, Componente })

let errores: ReturnType<typeof vi.spyOn>
let avisos: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  document.body.innerHTML = ''
  errores = vi.spyOn(console, 'error').mockImplementation(() => {})
  avisos = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

function marca(nombre: string): HTMLElement {
  const d = document.createElement('div')
  d.setAttribute('data-react-root', nombre)
  document.body.appendChild(d)
  return d
}

async function montar(modulos: Record<string, unknown>, store = crearStoreFalso()) {
  await act(async () => {
    montarIslas(modulos, store)
  })
}

describe('montarIslas', () => {
  it('monta cada isla en su [data-react-root] por nombre', async () => {
    const gaps = marca('gaps')
    const otra = marca('mensual')
    await montar({ './tabs/Gaps.tsx': modulo('gaps', Hola), './tabs/Mensual.tsx': modulo('mensual', () => <p>mensual</p>) })
    expect(gaps.textContent).toBe('hola gaps')
    expect(otra.textContent).toBe('mensual')
  })

  it('la isla recibe el almacén por el proveedor', async () => {
    const el = marca('gaps')
    await montar({ a: modulo('gaps', LeeStore) }, crearStoreFalso({ activeTab: 'gaps' }))
    expect(el.textContent).toBe('tab=gaps stats=nulo')
  })

  it('sin marcador en la página no monta nada y no falla', async () => {
    await montar({ a: modulo('gaps', Hola) })
    expect(document.body.innerHTML).toBe('')
    expect(errores).not.toHaveBeenCalled()
  })

  it('un marcador sin módulo se deja intacto y se avisa', async () => {
    const el = marca('desconocida')
    el.textContent = 'contenido antiguo'
    await montar({ a: modulo('gaps', Hola) })
    expect(el.textContent).toBe('contenido antiguo')
    expect(avisos).toHaveBeenCalledWith(expect.stringContaining('desconocida'))
  })

  it('un módulo sin nombre o sin Componente se descarta con un error y no impide montar los demás', async () => {
    const el = marca('gaps')
    await montar({ a: { nombre: 'x' }, b: { Componente: Hola }, c: modulo('gaps', Hola), d: null })
    expect(el.textContent).toBe('hola gaps')
    expect(errores).toHaveBeenCalled()
  })

  it('un módulo con nombre vacío se descarta (un marcador sin nombre no debe casar con él)', async () => {
    const el = marca('')
    await montar({ a: modulo('', Hola) })
    expect(el.textContent).toBe('')
    expect(errores).toHaveBeenCalled()
  })

  it('dos módulos con el mismo nombre: gana el primero y se avisa', async () => {
    const el = marca('gaps')
    await montar({ a: modulo('gaps', () => <p>primero</p>), b: modulo('gaps', () => <p>segundo</p>) })
    expect(el.textContent).toBe('primero')
    expect(errores).toHaveBeenCalledWith(expect.stringContaining('gaps'))
  })

  it('monta en todos los marcadores con el mismo nombre', async () => {
    const a = marca('gaps')
    const b = marca('gaps')
    await montar({ a: modulo('gaps', Hola) })
    expect(a.textContent).toBe('hola gaps')
    expect(b.textContent).toBe('hola gaps')
  })

  it('llamar dos veces no monta dos veces sobre el mismo marcador', async () => {
    const el = marca('gaps')
    const modulos = { a: modulo('gaps', Hola) }
    const store = crearStoreFalso()
    await montar(modulos, store)
    await montar(modulos, store)
    expect(el.querySelectorAll('p')).toHaveLength(1)
    expect(errores).not.toHaveBeenCalled()
  })

  it('si createRoot lanza, el marcador no queda marcado y un segundo intento lo monta', async () => {
    const el = marca('gaps')
    const modulos = { a: modulo('gaps', Hola) }
    const store = crearStoreFalso()
    control.fallarCreateRoot = true
    await montar(modulos, store)
    expect(errores).toHaveBeenCalledWith(expect.stringContaining('gaps'), expect.any(Error))
    expect(el.hasAttribute('data-react-montado')).toBe(false)
    await montar(modulos, store)
    expect(el.textContent).toBe('hola gaps')
  })

  it('una isla que falla muestra un aviso genérico, sin detalles, y no rompe las demás', async () => {
    const mala = marca('rota')
    const buena = marca('gaps')
    await montar({ a: modulo('rota', Rota), b: modulo('gaps', Hola) })
    expect(buena.textContent).toBe('hola gaps')
    expect(mala.textContent).not.toContain('secretos')
    expect(mala.querySelector('[role="alert"]')).not.toBeNull()
  })
})
