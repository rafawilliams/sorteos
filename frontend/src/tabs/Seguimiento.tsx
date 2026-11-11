// Isla «Seguimiento» (spec frontend-react, T020). Equivale a `loadSeguimiento`/`renderSeguimiento` de static/app.js:
// pide `/api/seguimiento` CADA VEZ que la pestaña pasa a ser la activa (los datos cambian con cada sorteo) y pinta el
// resumen, lo congelado para el próximo sorteo, el marcador frente al azar y el historial.
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { getSeguimiento } from '../api/client'
import type { Metodo, MetodoComparado, RegistroComparado, RegistroPendiente, Seguimiento, Sorteo } from '../api/types'
import { Skeleton } from '../components/Skeleton'
import { useReveal } from '../components/useReveal'
import { catLabel, formatDate } from '../lib/formato'
import { useActiveTab } from '../store/hooks'

export const nombre = 'seguimiento'

type Estado = { fase: 'inactivo' } | { fase: 'cargando' } | { fase: 'error'; mensaje: string } | { fase: 'listo'; datos: Seguimiento }

const METODOS: ReadonlyArray<readonly [Metodo, string]> = [
  ['ml', '🤖 ML'],
  ['estadistico', '📊 Estadístico'],
  ['combinada', '⚖️ Combinada'],
]

const pct = (x: number | null | undefined) => (x == null ? '—' : `${(x * 100).toFixed(0)}%`)
const num = (x: number | null | undefined, decimales = 2) => (x == null ? '—' : Number(x).toFixed(decimales))
const premiosDe = (s: Sorteo) => [s.primero, s.segundo, s.tercero].filter(Boolean).join(' · ')

function Resumen({ datos }: { datos: Seguimiento }) {
  const pw = datos.peso_ml ?? 0.5
  const nota =
    datos.comparados_para_peso < datos.minimo_peso
      ? `50/50 hasta tener ${datos.minimo_peso} sorteos comparados (van ${datos.comparados_para_peso})`
      : `según los últimos ${datos.comparados_para_peso} sorteos comparados`
  return (
    <div className="stat-cards" role="region" aria-label="Resumen del seguimiento">
      <div className="stat-card">
        <div className="stat-value">
          {pct(pw)} / {pct(1 - pw)}
        </div>
        <div className="stat-label">
          Peso Combinada: ML / Estadístico
          <br />
          <small>{nota}</small>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{datos.comparados.length}</div>
        <div className="stat-label">Sorteos comparados</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{datos.pendientes.length}</div>
        <div className="stat-label">Esperando resultado</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{datos.sin_registro.length}</div>
        <div className="stat-label">Sorteos sin registro</div>
      </div>
    </div>
  )
}

function Pendiente({ p }: { p: RegistroPendiente }) {
  const revelar = useReveal()
  const cat = catLabel(p.categoria)
  const conML = !!p.metodos.ml
  const aplican = p.numeros_aplican !== false
  // Sin ML la combinada es la estadística: se muestra una sola vez.
  const metodos = METODOS.filter(([m]) => p.metodos[m] && (conML || m !== 'combinada'))
  return (
    <div className="card reveal" aria-label={`Recomendación congelada para ${cat}`} ref={revelar}>
      <div className="card-header">
        <h3 className="card-title">{cat}</h3>
        <span className="card-badge badge-gold">Registrada {p.registrado_en.replace('T', ' ')}</span>
      </div>
      {p.ultima_fecha && (
        <p className="section-subtitle">
          <small>
            Para el próximo sorteo de {cat} después del {formatDate(p.ultima_fecha)}
            {p.categoria === 'extraordinario' ? ' (se juega en abril, agosto y diciembre)' : ''}.
          </small>
        </p>
      )}
      {metodos.map(([m, etiqueta]) => {
        const congelado = p.metodos[m]!
        return (
          <p className="section-subtitle" key={m}>
            <strong>{etiqueta}</strong>:{' '}
            <span className="num-cell">{aplican && congelado.numeros.length ? congelado.numeros.join(' · ') : <em>sin números (premios de 5 cifras)</em>}</span>
            <br />
            <small>Terminaciones: {congelado.terminaciones.join(' ')}</small>
          </p>
        )
      })}
      {conML ? (
        p.peso_ml != null && <small className="section-subtitle">Peso ML de la combinada: {pct(p.peso_ml)}</small>
      ) : (
        p.metodos.combinada && <small className="section-subtitle">Sin ML para esta categoría: la combinada es igual al estadístico.</small>
      )}
    </div>
  )
}

function Marcador({ datos }: { datos: Seguimiento }) {
  return (
    <div className="table-wrap" role="region" aria-label="Marcador por método" tabIndex={0}>
      <table role="table" aria-label="Marcador acumulado por método">
        <thead>
          <tr>
            <th scope="col">Método</th>
            <th scope="col">Sorteos</th>
            <th scope="col">Números exactos</th>
            <th scope="col">Terminación de números</th>
            <th scope="col">Dígitos en posición (media)</th>
            <th scope="col">Terminaciones acertadas (media)</th>
            <th scope="col">Sorteos con ≥1 terminación</th>
          </tr>
        </thead>
        <tbody>
          {METODOS.map(([k, etiqueta]) => {
            const x = datos.marcador?.[k]
            if (!x?.sorteos) {
              return (
                <tr key={k}>
                  <td>{etiqueta}</td>
                  <td>0</td>
                  <td colSpan={5}>
                    <em>Sin sorteos comparados todavía</em>
                  </td>
                </tr>
              )
            }
            const sinNumeros = x.sorteos_numeros === 0
            return (
              <tr key={k}>
                <td>{etiqueta}</td>
                <td>{x.sorteos || 0}</td>
                <td>{sinNumeros ? '—' : <>{x.exactos ?? 0} <small>(azar {num(x.exactos_azar, 3)})</small></>}</td>
                <td>{sinNumeros ? '—' : <>{x.terminacion_numeros ?? 0} <small>(azar {num(x.terminacion_numeros_azar, 1)})</small></>}</td>
                <td>
                  {num(x.digitos_media, 3)} <small>(azar 0.400)</small>
                </td>
                <td>
                  {num(x.terminaciones_media)} <small>(azar {num(x.terminaciones_media_azar)})</small>
                </td>
                <td>
                  {x.alguna_terminacion_pct == null ? '—' : `${x.alguna_terminacion_pct.toFixed(0)}%`}{' '}
                  <small>(azar {x.alguna_terminacion_pct_azar == null ? '—' : `${x.alguna_terminacion_pct_azar.toFixed(0)}%`})</small>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function CeldaMetodo({ r }: { r: MetodoComparado | undefined }) {
  if (!r) return <td>—</td>
  const numeros = r.numeros.map((n, i) => (
    <span key={`${n}-${i}`}>
      {i > 0 && ' · '}
      {r.numeros_acertados.includes(n) ? (
        <mark style={{ background: '#4ade80', color: '#0b0b0f', borderRadius: 4, padding: '0 4px' }} title="Acierto exacto">
          {n}
        </mark>
      ) : (
        n
      )}
    </span>
  ))
  const acertadas = r.terminaciones_acertadas.length ? ` (${r.terminaciones_acertadas.join(' ')})` : ''
  const info = r.exactos == null ? 'números: no aplica' : `${r.exactos} exactos · dígitos ${num(r.digitos_media)}`
  return (
    <td>
      <span className="num-cell">{numeros.length ? numeros : '—'}</span>
      <br />
      <small>{`${info} · term. ${r.terminaciones_aciertos}/10${acertadas}`}</small>
    </td>
  )
}

type FilaHistorial = { fecha: string; fila: ReactElement }

function Historial({ datos }: { datos: Seguimiento }) {
  const comparada = (c: RegistroComparado): FilaHistorial => {
    const s = c.sorteo
    return {
      fecha: s.fecha,
      fila: (
        <tr key={`c-${s.id}`}>
          <td>
            {formatDate(s.fecha)}
            <br />
            <small>{catLabel(s.cat)}</small>
          </td>
          <td className="num-cell">{premiosDe(s)}</td>
          <CeldaMetodo r={c.metodos.ml} />
          <CeldaMetodo r={c.metodos.estadistico} />
          <CeldaMetodo r={c.metodos.combinada} />
        </tr>
      ),
    }
  }
  const sinRegistro = (s: Sorteo): FilaHistorial => ({
    fecha: s.fecha,
    fila: (
      <tr key={`s-${s.id}`} style={{ opacity: 0.55 }}>
        <td>
          {formatDate(s.fecha)}
          <br />
          <small>{catLabel(s.cat)}</small>
        </td>
        <td className="num-cell">{premiosDe(s)}</td>
        <td colSpan={3}>
          <em>Sin registro: nadie abrió la web entre sorteos</em>
        </td>
      </tr>
    ),
  })
  const filas = [...datos.comparados.map(comparada), ...datos.sin_registro.map(sinRegistro)].sort((a, b) => b.fecha.localeCompare(a.fecha))
  return (
    <div className="table-wrap" role="region" aria-label="Historial del seguimiento" tabIndex={0}>
      <table role="table" aria-label="Recomendado frente a resultado por sorteo">
        <thead>
          <tr>
            <th scope="col">Sorteo</th>
            <th scope="col">Salió</th>
            <th scope="col">ML</th>
            <th scope="col">Estadístico</th>
            <th scope="col">Combinada</th>
          </tr>
        </thead>
        <tbody>
          {filas.length ? (
            filas.map((f) => f.fila)
          ) : (
            <tr>
              <td colSpan={5}>Todavía no hay sorteos comparados.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

const TITULO = { fontSize: '1.2rem', margin: '28px 0 12px' } as const

function Contenido({ datos }: { datos: Seguimiento }) {
  return (
    <>
      <Resumen datos={datos} />

      <h3 className="section-title" style={TITULO}>
        Recomendaciones congeladas para el próximo sorteo
      </h3>
      <p className="section-subtitle">
        Congeladas: no cambian hasta que salga su sorteo, aunque la pestaña Predicciones se recalcule (el ML se reentrena con cada sincronización). Por eso
        pueden no coincidir con lo que ves allí.
      </p>
      <div className="grid-2" role="region" aria-label="Recomendaciones pendientes por categoría">
        {datos.pendientes.length ? (
          datos.pendientes.map((p) => <Pendiente key={p.categoria} p={p} />)
        ) : (
          <p className="section-subtitle">Aún no hay recomendaciones congeladas. Se registran al calcular las estadísticas.</p>
        )}
      </div>

      <h3 className="section-title" style={TITULO}>
        Marcador frente al azar
      </h3>
      <Marcador datos={datos} />

      <h3 className="section-title" style={TITULO}>
        Historial sorteo a sorteo
      </h3>
      <Historial datos={datos} />
    </>
  )
}

/** Como app.js: una lista ausente cuenta como vacía en vez de romper el render. */
const conListas = (d: Seguimiento): Seguimiento => ({ ...d, comparados: d.comparados ?? [], pendientes: d.pendientes ?? [], sin_registro: d.sin_registro ?? [] })

export function Componente() {
  const activa = useActiveTab() === 'seguimiento'
  const [estado, setEstado] = useState<Estado>({ fase: 'inactivo' })
  const ultima = useRef(0) // solo cuenta la respuesta de la petición más reciente
  const regionRef = useRef<HTMLDivElement>(null)

  const cargar = useCallback(async () => {
    const mia = ++ultima.current
    setEstado({ fase: 'cargando' })
    const r = await getSeguimiento()
    if (mia !== ultima.current) return
    setEstado(r.ok ? { fase: 'listo', datos: conListas(r.data) } : { fase: 'error', mensaje: r.mensaje })
  }, [])

  // Cada vez que la pestaña pasa a ser la activa. El doble efecto de StrictMode repite la petición en desarrollo
  // pero la segunda respuesta sustituye a la primera, y en producción no ocurre.
  const yaPedida = useRef(false)
  useEffect(() => {
    if (!activa) {
      yaPedida.current = false
      return
    }
    if (yaPedida.current) return
    yaPedida.current = true
    void cargar()
  }, [activa, cargar])

  return (
    <div role="region" aria-label="Seguimiento de recomendaciones" ref={regionRef} tabIndex={-1} style={{ outline: 'none' }}>
      {estado.fase === 'cargando' && (
        <div role="status" aria-label="Cargando seguimiento">
          <div className="skel-grid">
            <Skeleton lineas={2} />
            <Skeleton lineas={2} />
            <Skeleton lineas={2} />
            <Skeleton lineas={2} />
          </div>
          <Skeleton lineas={5} />
        </div>
      )}
      {estado.fase === 'error' && (
        <div role="alert">
          <p style={{ color: '#f87171' }}>No se pudo cargar el seguimiento. {estado.mensaje}</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              regionRef.current?.focus() // el botón desaparece al reintentar: el foco pasa a la región, no a <body>
              void cargar()
            }}
          >
            Reintentar
          </button>
        </div>
      )}
      {estado.fase === 'listo' && <Contenido datos={estado.datos} />}
    </div>
  )
}
