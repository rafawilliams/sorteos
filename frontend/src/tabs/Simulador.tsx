// Isla «Simulador» (spec frontend-react, T028). Equivale a `initSimCats`/`runSimulation`/`renderSimResults` de
// static/app.js: se teclea un número de 4 cifras (con categoría y rango de fechas opcionales) y se ve cuántas veces
// salió en la historia, con su terminación, la última aparición, el reparto por categoría y los últimos aciertos.
//
// El «gráfico» de este Simulador son barras CSS (`.bar-chart`), no Chart.js: así era en app.js y la referencia de
// capturas (AC1) lo exige igual. Además de teclear, el botón «Simular» de Mis Números lo abre con un número: llega por
// el campo `simulacion` del Store (una petición nueva por cada `id`, también al repetir el número).
import { useCallback, useEffect, useRef, useState } from 'react'
import { simular } from '../api/client'
import type { Simulacion } from '../api/types'
import { Skeleton } from '../components/Skeleton'
import { useReveal } from '../components/useReveal'
import { catLabel } from '../lib/formato'
import { validarNumero } from '../lib/numeroSimulador'
import { useSimulacion, useStats, useToast } from '../store/hooks'

export const nombre = 'simulador'

type Consulta = { numero: string; cat: string; from: string; to: string }
type Estado = { fase: 'vacio' } | { fase: 'cargando' } | { fase: 'error'; mensaje: string } | { fase: 'listo'; datos: Simulacion }

const MONO = "'JetBrains Mono'"
const PREMIOS = [
  { clave: 'primero', rotulo: '1er Premio', color: 'var(--gold-400)' },
  { clave: 'segundo', rotulo: '2do Premio', color: '#4ade80' },
  { clave: 'tercero', rotulo: '3er Premio', color: '#c084fc' },
] as const
const ETIQUETA = { display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 } as const

function Premios({ valores }: { valores: Record<(typeof PREMIOS)[number]['clave'], number> }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-around', padding: '12px 0' }}>
      {PREMIOS.map((p) => (
        <div key={p.clave} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: p.color }}>{valores[p.clave]}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.rotulo}</div>
        </div>
      ))}
    </div>
  )
}

function Resultados({ datos: d }: { datos: Simulacion }) {
  const revelar = useReveal()
  const ex = d.exact
  const en = d.ending
  const hayAciertos = ex.total > 0
  const categorias = Object.entries(d.by_category ?? {}).sort((a, b) => b[1] - a[1])
  const maximo = Math.max(...categorias.map(([, n]) => n)) || 1 // con todas a 0 la barra mide 0%, no «NaN%»
  const aciertos = ex.matches ?? []
  return (
    <>
      <div className="stat-cards" style={{ marginTop: 20 }}>
        <div className="stat-card">
          <div className="stat-value" style={{ fontFamily: MONO, fontSize: '2rem', color: 'var(--gold-400)' }}>{d.numero}</div>
          <div className="stat-label">Número buscado</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{d.total_sorteos.toLocaleString()}</div>
          <div className="stat-label">Sorteos analizados</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: hayAciertos ? '#4ade80' : 'var(--text-muted)' }}>{ex.total}</div>
          <div className="stat-label">Veces que salió (exacto)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{en.total}</div>
          <div className="stat-label">{`Coincidencia terminación (${d.terminacion})`}</div>
        </div>
      </div>

      <div className="grid-3" style={{ marginTop: 20 }}>
        <div className="card reveal" ref={revelar}>
          <div className="card-header">
            <h3 className="card-title">Aciertos Exactos</h3>
            <span className={`card-badge ${hayAciertos ? 'badge-hot' : 'badge-cold'}`}>{ex.total}</span>
          </div>
          <Premios valores={ex} />
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>{`Frecuencia: ${ex.frequency_pct}% de sorteos`}</div>
        </div>

        <div className="card reveal" ref={revelar}>
          <div className="card-header">
            <h3 className="card-title">{`Terminación "${d.terminacion}"`}</h3>
            <span className="card-badge badge-green">{en.total}</span>
          </div>
          <Premios valores={en} />
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>{`Frecuencia: ${en.frequency_pct}% de sorteos`}</div>
        </div>

        <div className="card reveal" ref={revelar}>
          <div className="card-header">
            <h3 className="card-title">Última Aparición</h3>
            <span className="card-badge badge-purple">Gap</span>
          </div>
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: '1.1rem', color: 'var(--gold-300)', fontWeight: 600 }}>{ex.last_appearance || 'Nunca ha salido'}</div>
            {ex.gap_draws != null ? (
              <>
                <div style={{ marginTop: 12, fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{ex.gap_draws}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>sorteos sin aparecer</div>
              </>
            ) : (
              <div style={{ marginTop: 12, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Sin registro en el rango seleccionado</div>
            )}
          </div>
        </div>
      </div>

      {categorias.length > 0 && (
        <div className="card reveal" style={{ marginTop: 20 }} ref={revelar}>
          <div className="card-header">
            <h3 className="card-title">Distribución por Categoría</h3>
          </div>
          <div className="bar-chart">
            {categorias.map(([clave, veces]) => (
              <div className="bar-row" key={clave}>
                <span className="bar-label">{clave}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.round((veces / maximo) * 100)}%` }} />
                </div>
                <span className="bar-value">{veces}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {aciertos.length > 0 && (
        <div className="card reveal" style={{ marginTop: 20 }} ref={revelar}>
          <div className="card-header">
            <h3 className="card-title">Historial de Aciertos</h3>
            <span className="card-badge badge-gold">{`Últimos ${aciertos.length}`}</span>
          </div>
          <div className="table-wrap">
            <table role="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Categoría</th>
                </tr>
              </thead>
              <tbody>
                {aciertos.map((m, i) => (
                  <tr key={`${m.fecha}-${i}`}>
                    <td>{m.fecha}</td>
                    <td>
                      <span className="cat-badge">{m.cat}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

export function Componente() {
  const stats = useStats()
  const toast = useToast()
  const peticion = useSimulacion()
  const revelar = useReveal()
  const [texto, setTexto] = useState('')
  const [cat, setCat] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [estado, setEstado] = useState<Estado>({ fase: 'vacio' })
  const ultima = useRef(0) // solo cuenta la respuesta de la petición más reciente
  const pedida = useRef<Consulta | null>(null) // lo que se pidió, para reintentar lo mismo aunque el formulario cambie
  const vista = useRef(peticion?.id ?? null) // última petición de Mis Números ya atendida (una anterior al montaje no cuenta)
  const regionRef = useRef<HTMLDivElement>(null)

  const pedir = useCallback(async (consulta: Consulta) => {
    pedida.current = consulta
    const mia = ++ultima.current
    setEstado({ fase: 'cargando' })
    const r = await simular(consulta)
    if (mia !== ultima.current) return
    setEstado(r.ok ? { fase: 'listo', datos: r.data } : { fase: 'error', mensaje: r.mensaje })
  }, [])

  const lanzar = (entrada: string) => {
    const numero = validarNumero(entrada)
    if (numero === null) return toast('Ingresa un número de 4 dígitos', 3000)
    void pedir({ numero, cat, from: desde, to: hasta })
  }

  // «Simular» de Mis Números: una simulación por cada `id` nuevo, con los filtros que haya en ese momento.
  useEffect(() => {
    if (!peticion || peticion.id === vista.current) return
    vista.current = peticion.id
    const numero = validarNumero(peticion.numero)
    if (numero === null) return toast('Ingresa un número de 4 dígitos', 3000)
    setTexto(numero)
    void pedir({ numero, cat, from: desde, to: hasta })
  }, [peticion, pedir, toast, cat, desde, hasta])

  if (!stats) {
    return (
      <div role="status" aria-label="Cargando simulador">
        <Skeleton lineas={4} />
      </div>
    )
  }

  return (
    <>
      <div className="card reveal" ref={revelar}>
        <div className="card-header">
          <h3 className="card-title">Buscar Número</h3>
          <span className="card-badge badge-gold">Histórico</span>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 12 }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={ETIQUETA}>Número (4 dígitos)</label>
            <input
              className="filter-input"
              type="text"
              maxLength={4}
              pattern="[0-9]{4}"
              placeholder="0042"
              aria-label="Número a simular"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              style={{ fontFamily: MONO, fontSize: '1.4rem', textAlign: 'center', letterSpacing: 6 }}
            />
          </div>
          <div style={{ minWidth: 120 }}>
            <label style={ETIQUETA}>Categoría</label>
            <select className="filter-select" aria-label="Categoría para simulación" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Todas</option>
              {Object.keys(stats.by_category ?? {}).map((c) => (
                <option key={c} value={c}>
                  {catLabel(c)}
                </option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: 120 }}>
            <label style={ETIQUETA}>Desde</label>
            <input className="filter-date" type="date" aria-label="Fecha desde" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div style={{ minWidth: 120 }}>
            <label style={ETIQUETA}>Hasta</label>
            <input className="filter-date" type="date" aria-label="Fecha hasta" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <button type="button" className="btn btn-gold" aria-label="Ejecutar simulación" style={{ height: 42 }} onClick={() => lanzar(texto)}>
            🔍 Simular
          </button>
        </div>
      </div>

      <div role="region" aria-label="Resultados de simulación" aria-live="polite" ref={regionRef} tabIndex={-1} style={{ outline: 'none' }}>
        {estado.fase === 'cargando' && (
          <div role="status" aria-label="Buscando..." style={{ marginTop: 20 }}>
            <Skeleton lineas={5} />
          </div>
        )}
        {estado.fase === 'error' && (
          <div role="alert" style={{ marginTop: 20 }}>
            <p style={{ color: '#f87171' }}>No se pudo simular. {estado.mensaje}</p>
            <button
              type="button"
              className="btn"
              onClick={() => {
                regionRef.current?.focus() // el botón desaparece al reintentar: el foco pasa a la región, no a <body>
                if (pedida.current) void pedir(pedida.current)
              }}
            >
              Reintentar
            </button>
          </div>
        )}
        {estado.fase === 'listo' && <Resultados datos={estado.datos} />}
      </div>
    </>
  )
}
