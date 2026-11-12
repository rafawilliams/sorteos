// Isla «Comparador» (spec frontend-react, T024). Equivale a `addCompNumber`/`removeCompNumber`/`clearCompNumbers`/
// `runComparison`/`renderCompResults` de static/app.js: hasta 5 números de 4 cifras que se comparan por su historial,
// frecuencia, última aparición y mes favorable, con una tabla y un gráfico de distribución mensual.
import { useCallback, useRef, useState } from 'react'
import { comparar } from '../api/client'
import type { Comparacion } from '../api/types'
import { Chart } from '../components/Chart'
import { Skeleton } from '../components/Skeleton'
import { useReveal } from '../components/useReveal'
import { chartOptions } from '../lib/chartOptions'
import { validarNumero } from '../lib/numeroSimulador'
import { useToast } from '../store/hooks'
import type { Tema } from '../store/tipos'

export const nombre = 'comparador'

type Estado = { fase: 'vacio' } | { fase: 'cargando' } | { fase: 'error'; mensaje: string } | { fase: 'listo'; datos: Comparacion }

const MAXIMO = 5
const COLORES = ['#ffd700', '#4ade80', '#c084fc', '#4dabff', '#ff9f43']
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MONO = "'JetBrains Mono'"

type Fila = { rotulo: string; valor: (n: Comparacion['numbers'][number]) => string | number }
const FILAS: Fila[] = [
  { rotulo: 'Aciertos Exactos', valor: (n) => n.total_exact ?? '—' },
  { rotulo: '1er Premio', valor: (n) => n.exact.primero },
  { rotulo: '2do Premio', valor: (n) => n.exact.segundo },
  { rotulo: '3er Premio', valor: (n) => n.exact.tercero },
  { rotulo: 'Coincid. Terminación', valor: (n) => n.ending_matches ?? '—' },
  { rotulo: 'Frecuencia %', valor: (n) => `${n.frequency_pct ?? '—'}%` },
  // Como app.js: un valor ausente se muestra con raya y «Nunca» solo sale si llega vacío.
  { rotulo: 'Última Aparición', valor: (n) => (n.last_appearance ?? '—') || 'Nunca' },
  { rotulo: 'Gap (sorteos)', valor: (n) => n.gap ?? '—' },
  { rotulo: 'Mejor Mes', valor: (n) => `${n.best_month} (${n.best_month_count})` },
]

const opcionesGrafico = (tema: Tema) => chartOptions(tema)
const SIN_NUMEROS: Comparacion['numbers'] = []

function Resultados({ datos }: { datos: Comparacion }) {
  const revelar = useReveal()
  const numeros = datos.numbers ?? SIN_NUMEROS // constante: una lista nueva en cada render recrearía el gráfico
  // Memorizadas: el gráfico se destruye y se recrea cuando cambia la identidad de estas funciones.
  const datosGrafico = useCallback(
    () => ({
      labels: MESES,
      datasets: numeros.map((n, i) => ({
        label: n.number,
        data: MESES.map((m) => n.monthly[m] || 0),
        backgroundColor: `${COLORES[i]}60`,
        borderColor: COLORES[i],
        borderWidth: 2,
        borderRadius: 4,
      })),
    }),
    [numeros],
  )
  if (!numeros.length) return null
  return (
    <>
      <div className="card reveal" style={{ marginTop: 20 }} ref={revelar}>
        <div className="card-header">
          <h3 className="card-title">Comparación</h3>
          <span className="card-badge badge-gold">{numeros.length} números</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="heatmap-table" role="table">
            <thead>
              <tr>
                <th>Métrica</th>
                {numeros.map((n, i) => (
                  <th key={n.number} style={{ color: COLORES[i], fontFamily: MONO }}>
                    {n.number}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FILAS.map((f) => (
                <tr key={f.rotulo}>
                  <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{f.rotulo}</td>
                  {numeros.map((n) => (
                    <td key={n.number} style={{ textAlign: 'center', fontFamily: MONO }}>
                      {f.valor(n)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card reveal" style={{ marginTop: 20 }} ref={revelar}>
        <div className="card-header">
          <h3 className="card-title">Distribución Mensual</h3>
          <span className="card-badge badge-green">Por Mes</span>
        </div>
        <Chart type="bar" datos={datosGrafico} opciones={opcionesGrafico} etiqueta="Distribución mensual comparativa" />
      </div>
    </>
  )
}

export function Componente() {
  const toast = useToast()
  const revelar = useReveal()
  const [numeros, setNumeros] = useState<string[]>([])
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState<Estado>({ fase: 'vacio' })
  const ultima = useRef(0) // solo cuenta la respuesta de la petición más reciente
  const regionRef = useRef<HTMLDivElement>(null)

  const pedir = useCallback(async (lista: string[]) => {
    const mia = ++ultima.current
    setEstado({ fase: 'cargando' })
    const r = await comparar(lista)
    if (mia !== ultima.current) return
    setEstado(r.ok ? { fase: 'listo', datos: r.data } : { fase: 'error', mensaje: r.mensaje })
  }, [])

  const vaciar = () => {
    ultima.current += 1 // lo que aún esté en vuelo ya no cuenta
    setEstado({ fase: 'vacio' })
  }

  const agregar = () => {
    const numero = validarNumero(texto)
    if (numero === null) return toast('Ingresa un número de 4 dígitos', 3000)
    if (numeros.includes(numero)) return toast(`${numero} ya está en la lista`, 2000)
    if (numeros.length >= MAXIMO) return toast('Máximo 5 números', 2000)
    const nueva = [...numeros, numero]
    setNumeros(nueva)
    setTexto('')
    void pedir(nueva)
  }

  const quitar = (numero: string) => {
    const nueva = numeros.filter((n) => n !== numero)
    setNumeros(nueva)
    if (nueva.length) void pedir(nueva)
    else vaciar()
  }

  const limpiar = () => {
    setNumeros([])
    vaciar()
  }

  return (
    <>
      <div className="card reveal" ref={revelar}>
        <div className="card-header">
          <h3 className="card-title">Números a Comparar</h3>
          <span className="card-badge badge-gold">Máx 5</span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 12 }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <input
              className="filter-input"
              type="text"
              maxLength={4}
              placeholder="Número…"
              aria-label="Agregar número a comparar"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              style={{ fontFamily: MONO, fontSize: '1.2rem', textAlign: 'center', letterSpacing: 4 }}
            />
          </div>
          <button type="button" className="btn btn-gold" style={{ height: 42 }} onClick={agregar}>
            + Agregar
          </button>
          <button type="button" className="btn" style={{ height: 42 }} onClick={limpiar}>
            Limpiar
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {numeros.map((n, i) => (
            <span
              key={n}
              data-etiqueta={n}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: `${COLORES[i]}20`,
                border: `1px solid ${COLORES[i]}`,
                color: COLORES[i],
                padding: '4px 12px',
                borderRadius: 20,
                fontFamily: MONO,
                fontWeight: 600,
              }}
            >
              {n}{' '}
              <button type="button" aria-label={`Quitar ${n}`} onClick={() => quitar(n)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>
                ✕
              </button>
            </span>
          ))}
        </div>
      </div>

      <div role="region" aria-label="Resultados de comparación" aria-live="polite" ref={regionRef} tabIndex={-1} style={{ outline: 'none' }}>
        {estado.fase === 'cargando' && (
          <div role="status" aria-label="Comparando..." style={{ marginTop: 20 }}>
            <Skeleton lineas={5} />
          </div>
        )}
        {estado.fase === 'error' && (
          <div role="alert" style={{ marginTop: 20 }}>
            <p style={{ color: '#f87171' }}>No se pudo comparar. {estado.mensaje}</p>
            <button
              type="button"
              className="btn"
              onClick={() => {
                regionRef.current?.focus() // el botón desaparece al reintentar: el foco pasa a la región, no a <body>
                void pedir(numeros)
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
