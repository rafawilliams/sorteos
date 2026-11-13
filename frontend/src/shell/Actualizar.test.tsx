import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StoreProvider } from '../store/StoreProvider'
import { crearStoreFalso, type StoreFalso } from '../store/storeFalso'
import { BotonActualizar, CLAVE_TOKEN, PREGUNTA_TOKEN } from './Actualizar'

let store: StoreFalso
let prompt: ReturnType<typeof vi.fn>

type Guion = { status?: number; cuerpo?: unknown; texto?: string; red?: boolean; esperar?: Promise<void> }

/** Una red falsa para `/api/actualizar`: devuelve lo que diga el guion y guarda las llamadas. */
function red(guion: Guion = {}) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => {
    if (guion.esperar) await guion.esperar
    if (guion.red) throw new TypeError('Failed to fetch')
    const status = guion.status ?? 200
    const cuerpo = guion.texto ?? JSON.stringify(guion.cuerpo ?? { ok: true })
    return new Response(cuerpo, { status })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

function montar() {
  store = crearStoreFalso()
  return render(
    <StoreProvider store={store}>
      <BotonActualizar />
    </StoreProvider>,
  )
}
const boton = () => screen.getByRole('button', { name: 'Actualizar datos de sorteos' }) as HTMLButtonElement
const avisos = () => store.llamadas.filter((l) => l.accion === 'toast').map((l) => l.args)
const recargas = () => store.llamadas.filter((l) => l.accion === 'reload').length
const pulsar = () => userEvent.click(boton())

beforeEach(() => {
  sessionStorage.clear()
  prompt = vi.fn(() => 'secreto')
  vi.stubGlobal('prompt', prompt)
})
afterEach(() => vi.unstubAllGlobals())

describe('botón de actualizar: marcado', () => {
  it('es el botón dorado de siempre, con su id, nombre accesible y texto', () => {
    montar()
    expect(boton().id).toBe('updateBtn')
    expect(boton().className).toBe('btn btn-gold')
    expect(boton().textContent).toBe('↻ Actualizar datos')
    expect(boton().type).toBe('button')
    expect(boton().disabled).toBe(false)
  })

  it('montarlo no pide nada ni abre el diálogo del token', () => {
    const fn = red()
    montar()
    expect(fn).not.toHaveBeenCalled()
    expect(prompt).not.toHaveBeenCalled()
  })
})

describe('botón de actualizar: token', () => {
  it('sin token guardado lo pide con la pregunta de siempre y lo manda en la cabecera X-Update-Token', async () => {
    const fn = red()
    montar()
    await pulsar()
    expect(prompt).toHaveBeenCalledExactlyOnceWith(PREGUNTA_TOKEN)
    expect(PREGUNTA_TOKEN).toBe('Token de actualización (ACTUALIZAR_TOKEN):')
    expect(fn).toHaveBeenCalledExactlyOnceWith('/api/actualizar', { method: 'POST', headers: { 'X-Update-Token': 'secreto' } })
  })

  it('con un token ya guardado no vuelve a preguntar', async () => {
    sessionStorage.setItem(CLAVE_TOKEN, 'guardado')
    const fn = red()
    montar()
    await pulsar()
    expect(prompt).not.toHaveBeenCalled()
    expect(fn.mock.calls[0]![1]).toEqual({ method: 'POST', headers: { 'X-Update-Token': 'guardado' } })
  })

  it('un token aceptado se guarda solo en la sesión de la pestaña (sessionStorage, no localStorage)', async () => {
    red()
    montar()
    await pulsar()
    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBe('secreto')
    expect(localStorage.getItem(CLAVE_TOKEN)).toBeNull()
    expect(CLAVE_TOKEN).toBe('updateToken')
  })

  it.each([[null], ['']])('cancelar el diálogo (%j) no pide nada, no avisa, no guarda y deja el botón libre', async (respuesta) => {
    prompt.mockReturnValue(respuesta)
    const fn = red()
    montar()
    await pulsar()
    expect(fn).not.toHaveBeenCalled()
    expect(avisos()).toEqual([])
    expect(recargas()).toBe(0)
    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBeNull()
    expect(boton().disabled).toBe(false)
    expect(boton().textContent).toBe('↻ Actualizar datos')
  })

  it('un 401 olvida el token guardado y la próxima vez se vuelve a preguntar', async () => {
    sessionStorage.setItem(CLAVE_TOKEN, 'viejo')
    red({ status: 401, cuerpo: { ok: false, error: 'Token inválido' } })
    montar()
    await pulsar()
    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBeNull()
    prompt.mockReturnValue('nuevo')
    await pulsar()
    expect(prompt).toHaveBeenCalledTimes(1)
  })

  it('un 401 con un token recién escrito tampoco lo guarda', async () => {
    red({ status: 401, cuerpo: { ok: false, error: 'Token inválido' } })
    montar()
    await pulsar()
    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBeNull()
  })

  it.each([[503], [502], [500]])('un %i conserva el token: el servidor lo aceptó y falló por otra causa', async (status) => {
    red({ status, cuerpo: { ok: false, error: 'algo' } })
    montar()
    await pulsar()
    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBe('secreto')
  })

  it('una red caída no guarda un token recién escrito', async () => {
    red({ red: true })
    montar()
    await pulsar()
    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBeNull()
  })

  it('una red caída no borra un token ya guardado', async () => {
    sessionStorage.setItem(CLAVE_TOKEN, 'guardado')
    red({ red: true })
    montar()
    await pulsar()
    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBe('guardado')
  })

  it('si el navegador no deja usar sessionStorage pregunta cada vez y no falla', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    red()
    montar()
    await pulsar()
    await pulsar()
    expect(prompt).toHaveBeenCalledTimes(2)
    expect(avisos()).toEqual([['Datos actualizados correctamente', 3000], ['Datos actualizados correctamente', 3000]])
    vi.restoreAllMocks()
  })

  it('el token no aparece en la página ni en los avisos', async () => {
    red({ status: 401, cuerpo: { ok: false, error: 'Token inválido' } })
    const { container } = montar()
    await pulsar()
    expect(container.innerHTML).not.toContain('secreto')
    expect(JSON.stringify(avisos())).not.toContain('secreto')
  })
})

describe('botón de actualizar: respuestas', () => {
  it('un éxito avisa 3 s, recarga los datos y devuelve el botón a su texto', async () => {
    red({ cuerpo: { ok: true, ml_retrained: true } })
    montar()
    await pulsar()
    expect(avisos()).toEqual([['Datos actualizados correctamente', 3000]])
    expect(recargas()).toBe(1)
    expect(boton().disabled).toBe(false)
    expect(boton().textContent).toBe('↻ Actualizar datos')
  })

  it('un éxito sin ml_retrained dice lo mismo', async () => {
    red({ cuerpo: { ok: true } })
    montar()
    await pulsar()
    expect(avisos()).toEqual([['Datos actualizados correctamente', 3000]])
  })

  it('un éxito con el modelo sin reentrenar lo dice', async () => {
    red({ cuerpo: { ok: true, ml_retrained: false } })
    montar()
    await pulsar()
    expect(avisos()).toEqual([['Datos actualizados (el modelo ML no se pudo reentrenar)', 3000]])
    expect(recargas()).toBe(1)
  })

  it.each([
    [401, 'Token inválido'],
    [503, 'Actualización no configurada'],
    [502, 'Falló la sincronización'],
    [500, 'Error interno'],
  ])('un %i avisa 4 s con el texto público del servidor, no recarga y deja el botón libre', async (status, error) => {
    red({ status, cuerpo: { ok: false, error } })
    montar()
    await pulsar()
    expect(avisos()).toEqual([[`Error: ${error}`, 4000]])
    expect(recargas()).toBe(0)
    expect(boton().disabled).toBe(false)
    expect(boton().textContent).toBe('↻ Actualizar datos')
  })

  it('un error sin texto público usa el genérico', async () => {
    red({ status: 502, cuerpo: { ok: false } })
    montar()
    await pulsar()
    expect(avisos()).toEqual([['Error: Error del servidor', 4000]])
  })

  it('un error que no es JSON (el HTML del limitador, un 500 de Flask) usa el genérico y no filtra el cuerpo', async () => {
    red({ status: 500, texto: '<html>Traceback (most recent call last): secreto_interno</html>' })
    montar()
    await pulsar()
    expect(avisos()).toEqual([['Error: Error del servidor', 4000]])
    expect(JSON.stringify(avisos())).not.toContain('Traceback')
  })

  it('un error con un texto demasiado largo no se muestra', async () => {
    red({ status: 500, cuerpo: { ok: false, error: 'x'.repeat(500) } })
    montar()
    await pulsar()
    expect(avisos()).toEqual([['Error: Error del servidor', 4000]])
  })

  it('el campo output del servidor (la salida del script) no llega al aviso', async () => {
    red({ cuerpo: { ok: true, output: 'ruta interna C:\\apps\\secreto.py', ml_retrained: true } })
    montar()
    await pulsar()
    expect(JSON.stringify(avisos())).not.toContain('secreto')
  })

  it('una red caída avisa «Error de conexión» 3 s y no recarga', async () => {
    red({ red: true })
    montar()
    await pulsar()
    expect(avisos()).toEqual([['Error de conexión', 3000]])
    expect(recargas()).toBe(0)
    expect(boton().disabled).toBe(false)
  })

  it('un 200 con ok distinto de true no cuenta como éxito', async () => {
    red({ cuerpo: { ok: false, error: 'No' } })
    montar()
    await pulsar()
    expect(avisos()).toEqual([['Error: No', 4000]])
    expect(recargas()).toBe(0)
  })

  it('si algo inesperado lanza dentro, avisa «Error de conexión» y el botón queda libre', async () => {
    red()
    store = crearStoreFalso()
    store.actions.reload = async () => {
      throw new Error('boom')
    }
    render(
      <StoreProvider store={store}>
        <BotonActualizar />
      </StoreProvider>,
    )
    await pulsar()
    expect(avisos().at(-1)).toEqual(['Error de conexión', 3000])
    expect(boton().disabled).toBe(false)
    expect(boton().textContent).toBe('↻ Actualizar datos')
  })
})

describe('botón de actualizar: mientras trabaja', () => {
  it('se desactiva con el texto «Actualizando…» hasta que termina la petición y la recarga', async () => {
    let terminar!: () => void
    const espera = new Promise<void>((r) => (terminar = r))
    red({ esperar: espera })
    montar()
    const pulso = pulsar()
    await waitFor(() => expect(boton().disabled).toBe(true))
    expect(boton().textContent).toBe('↻ Actualizando…')
    terminar()
    await pulso
    await waitFor(() => expect(boton().disabled).toBe(false))
    expect(boton().textContent).toBe('↻ Actualizar datos')
  })

  it('sigue ocupado mientras recarga los datos tras un éxito', async () => {
    red()
    store = crearStoreFalso()
    let terminarRecarga!: () => void
    store.actions.reload = () => new Promise<void>((r) => (terminarRecarga = r))
    render(
      <StoreProvider store={store}>
        <BotonActualizar />
      </StoreProvider>,
    )
    const pulso = pulsar()
    await waitFor(() => expect(avisos()).toHaveLength(1))
    expect(boton().disabled).toBe(true)
    expect(boton().textContent).toBe('↻ Actualizando…')
    await act(async () => terminarRecarga())
    await pulso
    await waitFor(() => expect(boton().disabled).toBe(false))
  })

  it('un segundo clic mientras trabaja no lanza otra petición ni otro diálogo', async () => {
    let terminar!: () => void
    const espera = new Promise<void>((r) => (terminar = r))
    const fn = red({ esperar: espera })
    montar()
    const primero = pulsar()
    await waitFor(() => expect(boton().disabled).toBe(true))
    boton().click() // el botón desactivado no responde
    boton().dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(fn).toHaveBeenCalledTimes(1)
    expect(prompt).toHaveBeenCalledTimes(1)
    terminar()
    await primero
  })

  it('dos clics en el mismo turno, antes de que React repinte el botón desactivado, lanzan una sola petición', async () => {
    const fn = red()
    montar()
    await act(async () => {
      boton().click()
      boton().click()
    })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(prompt).toHaveBeenCalledTimes(1)
  })

  it('terminada una actualización se puede lanzar otra', async () => {
    const fn = red()
    montar()
    await pulsar()
    await pulsar()
    expect(fn).toHaveBeenCalledTimes(2)
    expect(prompt).toHaveBeenCalledTimes(1) // el token de la primera quedó guardado
  })
})
