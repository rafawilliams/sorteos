import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { actualizar, comparar, getBacktesting, getGaps, getSeguimiento, simular } from './client'

const fixture = (nombre: string) => JSON.parse(readFileSync(`fixtures/${nombre}.json`, 'utf-8'))

const RED = 'Error de conexión'
const SERVIDOR = 'Error del servidor'

type Respuesta = { status?: number; json?: () => Promise<unknown>; cuerpo?: unknown }
function respuesta({ status = 200, cuerpo, json }: Respuesta) {
  return { ok: status >= 200 && status < 300, status, json: json ?? (async () => cuerpo) }
}
function stubFetch(r: Respuesta | Error) {
  const fn = vi.fn(async (..._args: unknown[]) => {
    if (r instanceof Error) throw r
    return respuesta(r)
  })
  vi.stubGlobal('fetch', fn)
  return fn
}
const url = (fn: ReturnType<typeof stubFetch>, i = 0) => String(fn.mock.calls[i]![0])
const jsonRoto = (mensaje: string) => async () => {
  throw new SyntaxError(mensaje)
}

afterEach(() => vi.unstubAllGlobals())

describe.each([
  ['getGaps', () => getGaps(), '/api/gaps', 'gaps'],
  ['getSeguimiento', () => getSeguimiento(), '/api/seguimiento', 'seguimiento'],
  ['getBacktesting', () => getBacktesting(500), '/api/backtesting?last_n=500', 'backtesting'],
  ['comparar', () => comparar(['0074', '1234']), '/api/comparar?numeros=0074,1234', 'comparar'],
  ['simular', () => simular({ numero: '0074' }), '/api/simulador?numero=0074', 'simulador'],
] as const)('%s', (_nombre, llamar, ruta, nombreFixture) => {
  it('pide la ruta correcta y devuelve el cuerpo tal cual', async () => {
    const cuerpo = fixture(nombreFixture)
    const fn = stubFetch({ cuerpo })
    const r = await llamar()
    expect(url(fn)).toBe(ruta)
    expect(r).toEqual({ ok: true, data: cuerpo })
  })

  it('red caída → «Error de conexión», sin el texto de la excepción', async () => {
    stubFetch(new TypeError('Failed to fetch http://interno:3306 traza'))
    expect(await llamar()).toEqual({ ok: false, mensaje: RED })
  })

  it('un 500 que no es JSON (HTML de Flask) → mensaje genérico, sin traza', async () => {
    stubFetch({ status: 500, json: jsonRoto('Unexpected token < in JSON <html>Traceback (most recent call last)') })
    expect(await llamar()).toEqual({ ok: false, mensaje: SERVIDOR })
  })

  it('un 200 con un cuerpo que no es JSON válido → «Error de conexión»', async () => {
    stubFetch({ json: jsonRoto('Unexpected end of JSON input') })
    expect(await llamar()).toEqual({ ok: false, mensaje: RED })
  })

  it('un 200 con un cuerpo que no es un objeto (null o un array) → fallo, no datos', async () => {
    stubFetch({ cuerpo: null })
    expect((await llamar()).ok).toBe(false)
    stubFetch({ cuerpo: [] })
    expect((await llamar()).ok).toBe(false)
  })
})

describe('mensajes públicos del servidor (solo /api/comparar y /api/simulador)', () => {
  it('comparar devuelve el `error` público del 400', async () => {
    stubFetch({ status: 400, cuerpo: { error: 'Máximo 10 números' } })
    expect(await comparar(['1'])).toEqual({ ok: false, mensaje: 'Máximo 10 números' })
  })

  it('simular devuelve el `error` público del 400', async () => {
    stubFetch({ status: 400, cuerpo: { error: 'Número inválido' } })
    expect(await simular({ numero: 'x' })).toEqual({ ok: false, mensaje: 'Número inválido' })
  })

  it('un `error` que no es texto, o demasiado largo, se sustituye por el genérico', async () => {
    stubFetch({ status: 400, cuerpo: { error: { traza: 'x' } } })
    expect(await simular({ numero: '1' })).toEqual({ ok: false, mensaje: SERVIDOR })
    stubFetch({ status: 400, cuerpo: { error: 'x'.repeat(500) } })
    expect(await comparar(['1'])).toEqual({ ok: false, mensaje: SERVIDOR })
  })

  it('un 200 con `error` en el cuerpo (como comprobaba el código antiguo) es un fallo', async () => {
    stubFetch({ cuerpo: { error: 'Algo' } })
    expect(await comparar(['1'])).toEqual({ ok: false, mensaje: 'Algo' })
  })

  it('el resto de endpoints no filtran el `error` del servidor: siempre genérico', async () => {
    stubFetch({ status: 500, cuerpo: { error: 'psycopg2.OperationalError: host=10.0.0.5' } })
    expect(await getSeguimiento()).toEqual({ ok: false, mensaje: SERVIDOR })
    expect(await getGaps()).toEqual({ ok: false, mensaje: SERVIDOR })
    expect(await getBacktesting(500)).toEqual({ ok: false, mensaje: SERVIDOR })
  })

  it('un 429 del limitador es un fallo genérico', async () => {
    stubFetch({ status: 429, cuerpo: '<html>Too Many Requests</html>' })
    expect(await getGaps()).toEqual({ ok: false, mensaje: SERVIDOR })
  })
})

describe('formato de las consultas', () => {
  it('comparar: números separados por comas, cada uno codificado', async () => {
    const fn = stubFetch({ cuerpo: fixture('comparar') })
    await comparar(['0074', '12 4'])
    expect(url(fn)).toBe('/api/comparar?numeros=0074,12%204')
  })

  it('simular: solo los parámetros presentes, codificados y en orden numero, cat, from, to', async () => {
    const fn = stubFetch({ cuerpo: fixture('simulador') })
    await simular({ numero: '0074', cat: 'gordito', from: '2020-01-01', to: '2021-12-31' })
    expect(url(fn, 0)).toBe('/api/simulador?numero=0074&cat=gordito&from=2020-01-01&to=2021-12-31')
    await simular({ numero: '0074', cat: '', from: undefined })
    expect(url(fn, 1)).toBe('/api/simulador?numero=0074')
    await simular({ numero: '1234', cat: 'a&b' })
    expect(url(fn, 2)).toBe('/api/simulador?numero=1234&cat=a%26b')
  })

  it('backtesting: last_n entero', async () => {
    const fn = stubFetch({ cuerpo: fixture('backtesting') })
    await getBacktesting(200.9)
    expect(url(fn)).toBe('/api/backtesting?last_n=200')
  })

  it('backtesting: un last_n no finito se sustituye por 500', async () => {
    const fn = stubFetch({ cuerpo: fixture('backtesting') })
    await getBacktesting(Number.NaN)
    await getBacktesting(Number.POSITIVE_INFINITY)
    expect(url(fn, 0)).toBe('/api/backtesting?last_n=500')
    expect(url(fn, 1)).toBe('/api/backtesting?last_n=500')
  })

  it('las lecturas usan GET: fetch se llama solo con la ruta', async () => {
    const fn = stubFetch({ cuerpo: fixture('gaps') })
    await getGaps()
    expect(fn.mock.calls[0]!.length).toBe(1)
  })
})

describe('actualizar(token)', () => {
  it('envía POST con la cabecera X-Update-Token y devuelve estado, ok y ml_retrained', async () => {
    const fn = stubFetch({
      cuerpo: { ok: true, output: 'traza interna', ml_retrained: false, seguimiento_registrado: [], last_update: '2026-01-15' },
    })
    const r = await actualizar('secreto')
    expect(url(fn)).toBe('/api/actualizar')
    expect(fn.mock.calls[0]![1]).toEqual({ method: 'POST', headers: { 'X-Update-Token': 'secreto' } })
    expect(r).toEqual({ status: 200, ok: true, ml_retrained: false })
    expect(JSON.stringify(r)).not.toContain('traza')
  })

  it.each([
    [401, { ok: false, error: 'Token inválido', auth_required: true }, 'Token inválido'],
    [503, { ok: false, error: 'Actualización no configurada' }, 'Actualización no configurada'],
    [502, { ok: false, error: 'Falló la sincronización' }, 'Falló la sincronización'],
    [500, { ok: false, error: 'Error interno' }, 'Error interno'],
  ])('%i → ok false con el error público', async (status, cuerpo, mensaje) => {
    stubFetch({ status, cuerpo })
    expect(await actualizar('t')).toEqual({ status, ok: false, mensaje })
  })

  it('una respuesta de error sin `error` de texto usa el mensaje genérico', async () => {
    stubFetch({ status: 502, cuerpo: { ok: false } })
    expect(await actualizar('t')).toEqual({ status: 502, ok: false, mensaje: SERVIDOR })
  })

  it('un 500 que no es JSON → genérico, conservando el estado', async () => {
    stubFetch({ status: 500, json: jsonRoto('<html>') })
    expect(await actualizar('t')).toEqual({ status: 500, ok: false, mensaje: SERVIDOR })
  })

  it('red caída → estado 0 y «Error de conexión»', async () => {
    stubFetch(new TypeError('Failed to fetch'))
    expect(await actualizar('t')).toEqual({ status: 0, ok: false, mensaje: RED })
  })

  it('un 200 con ok distinto de true no cuenta como éxito', async () => {
    stubFetch({ cuerpo: { ok: false, error: 'No' } })
    expect(await actualizar('t')).toEqual({ status: 200, ok: false, mensaje: 'No' })
  })

  it('un `ml_retrained` que no es booleano se ignora', async () => {
    stubFetch({ cuerpo: { ok: true, ml_retrained: 'sí' } })
    expect(await actualizar('t')).toEqual({ status: 200, ok: true })
  })
})
