// Isla «Mis Números» (spec frontend-react, T023). Equivale a `addFavorite`/`removeFavorite`/`renderFavorites`/
// `updateFavBadge` de static/app.js: una lista de números guardada en el navegador (`lp_favorites`) que se cruza con los
// sorteos recientes y con las recomendaciones del modelo, y pone una insignia en la pestaña de la barra.
import { useEffect, useId, useRef, useState } from 'react'
import { Skeleton } from '../components/Skeleton'
import { useInsignia } from '../components/useInsignia'
import { useReveal } from '../components/useReveal'
import { agregarFavorito, apariciones, CLAVE_FAVORITOS, contarAlertas, guardarFavoritos, leerFavoritos, quitarFavorito } from '../lib/favoritos'
import { useSimularNumero, useSorteos, useStats, useToast } from '../store/hooks'
import type { Sorteo, Stats } from '../api/types'

export const nombre = 'favoritos'

const MONO = "'JetBrains Mono'"
const ETIQUETA = { padding: '2px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600 } as const
const VERDE = '#4ade80'

function Favorito({ numero, sorteos, stats, onSimular, onQuitar }: { numero: string; sorteos: Sorteo[]; stats: Stats; onSimular: () => void; onQuitar: () => void }) {
  const revelar = useReveal()
  const salidas = apariciones(numero, sorteos)
  const esReco = (stats.recommendations ?? []).some((r) => r.number === numero)
  const esRecoML = (stats.ml_recommendations ?? []).some((r) => r.number === numero)
  const hayAlerta = salidas.length > 0
  const borde = hayAlerta ? `4px solid ${VERDE}` : esReco || esRecoML ? '4px solid var(--gold-400)' : undefined
  return (
    <div className="card reveal" style={{ marginBottom: 12, ...(borde ? { borderLeft: borde } : {}) }} ref={revelar}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontFamily: MONO, fontSize: '1.6rem', fontWeight: 700, color: 'var(--gold-400)', letterSpacing: 4 }}>{numero}</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {hayAlerta && <span style={{ ...ETIQUETA, background: `${VERDE}30`, color: VERDE }}>✓ SALIÓ RECIENTE</span>}
            {esReco && <span style={{ ...ETIQUETA, background: 'rgba(212,175,55,0.2)', color: 'var(--gold-400)' }}>📊 Recomendado</span>}
            {esRecoML && <span style={{ ...ETIQUETA, background: 'rgba(74,222,128,0.2)', color: VERDE }}>🤖 ML Recomendado</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn" style={{ fontSize: '0.8rem' }} aria-label={`Simular ${numero}`} onClick={onSimular}>
            🔍 Simular
          </button>
          <button type="button" className="btn" style={{ fontSize: '0.8rem', color: '#f87171' }} aria-label={`Eliminar ${numero}`} onClick={onQuitar}>
            ✕
          </button>
        </div>
      </div>
      {hayAlerta && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          {salidas.slice(0, 5).map((a) => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '3px 0' }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                {a.fecha} ·{' '}
                <span className="cat-badge" style={{ fontSize: '0.7rem' }}>
                  {a.cat}
                </span>
              </span>
              <span style={{ color: VERDE, fontWeight: 600 }}>{a.prizes.join(', ')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function Componente() {
  const sorteos = useSorteos()
  const stats = useStats()
  const toast = useToast()
  const simular = useSimularNumero()
  const revelar = useReveal()
  const idCampo = useId()
  const [lista, setLista] = useState<string[]>(() => leerFavoritos())
  const [texto, setTexto] = useState('')
  const regionRef = useRef<HTMLDivElement>(null)

  useInsignia('favoritos', contarAlertas(lista, sorteos))

  // Otra pestaña del navegador cambió la lista: se relee, para no sobrescribir sus cambios con una lista vieja.
  useEffect(() => {
    const alCambiar = (e: StorageEvent) => {
      if (e.key === CLAVE_FAVORITOS || e.key === null) setLista(leerFavoritos())
    }
    window.addEventListener('storage', alCambiar)
    return () => window.removeEventListener('storage', alCambiar)
  }, [])

  /** Guarda y devuelve si se pudo. Si no, avisa (y quien llama NO debe tapar ese aviso con otro). */
  const guardar = (nueva: string[]): boolean => {
    setLista(nueva)
    const guardada = guardarFavoritos(nueva)
    if (!guardada) toast('No se pudo guardar la lista en este navegador', 3000)
    return guardada
  }

  const agregar = () => {
    const r = agregarFavorito(lista, texto)
    if (!r.ok) {
      toast(r.motivo === 'invalido' ? 'Ingresa un número de 4 dígitos' : `${r.numero} ya está en tu lista`, r.motivo === 'invalido' ? 3000 : 2000)
      return
    }
    setTexto('')
    if (guardar(r.lista)) toast(`${r.numero} agregado a favoritos`, 2000)
  }

  return (
    <>
      <div className="card reveal" ref={revelar}>
        <div className="card-header">
          <h3 className="card-title">Agregar Número</h3>
          <span className="card-badge badge-gold">Watchlist</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginTop: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label htmlFor={idCampo} style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>
              Número (4 dígitos)
            </label>
            <input
              id={idCampo}
              className="filter-input"
              type="text"
              maxLength={4}
              pattern="[0-9]{4}"
              placeholder="0042"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              style={{ fontFamily: MONO, fontSize: '1.4rem', textAlign: 'center', letterSpacing: 6 }}
            />
          </div>
          <button type="button" className="btn btn-gold" aria-label="Agregar número favorito" style={{ height: 42 }} onClick={agregar}>
            + Agregar
          </button>
        </div>
      </div>

      <div role="region" aria-label="Lista de números favoritos" aria-live="polite" ref={regionRef} tabIndex={-1} style={{ outline: 'none' }}>
        {stats === null ? (
          <div role="status" aria-label="Cargando favoritos" style={{ marginTop: 20 }}>
            <Skeleton lineas={3} />
          </div>
        ) : lista.length === 0 ? (
          <div className="card reveal" style={{ marginTop: 20, textAlign: 'center', padding: 40 }} ref={revelar}>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
              No tienes números favoritos aún.
              <br />
              Agrega números para rastrear sus apariciones.
            </p>
          </div>
        ) : (
          <div style={{ marginTop: 20 }}>
            {lista.map((n) => (
              <Favorito key={n} numero={n} sorteos={sorteos} stats={stats} onSimular={() => simular(n)} onQuitar={() => {
                  guardar(quitarFavorito(lista, n))
                  regionRef.current?.focus() // la tarjeta se desmonta: el foco pasa a la lista, no a <body>
                }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
