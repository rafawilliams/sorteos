// Isla «Predicciones» (spec frontend-react, T044). Equivale a `renderRecommendations`, `selectPrize`, `initPrizeTabs`,
// `initRecoCatTabs` y `buildCategoryUI` de static/app.js: selector de premio, interruptor Estadístico/ML, selector de
// categoría y las tarjetas de números recomendados con su «×N azar» y su botón de copiar.
// El premio y el modo viven en el Store (los leen también las pestañas que siguen en el código antiguo); la categoría es
// estado local de la isla. El título, el subtítulo y la tarjeta «¿Cómo funciona?» siguen en la plantilla.
import { useMemo, useState } from 'react'
import type { Premio, Stats } from '../api/types'
import { Balls } from '../components/Balls'
import { BotonCopiar } from '../components/BotonCopiar'
import { InterruptorML } from '../components/InterruptorML'
import { Skeleton } from '../components/Skeleton'
import { Tablist } from '../components/Tablist'
import { catLabel, fmtLift, liftBar } from '../lib/formato'
import { categoriasDe } from '../lib/resultados'
import { useML, usePrize, useSorteos, useStats } from '../store/hooks'

export const nombre = 'predicciones'

const ID_REGION = 'predicciones-reco'
const RANGOS = ['1ro', '2do', '3ro', '4to', '5to']
const PREMIOS: Array<{ id: Premio; texto: string }> = [
  { id: 'primero', texto: '1er Premio' },
  { id: 'segundo', texto: '2do Premio' },
  { id: 'tercero', texto: '3er Premio' },
]
const ESTILO_FILA = { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' } as const
const ESTILO_SIN_MARGEN = { marginBottom: 0 } as const

type Reco = { number: string; confidence: number }

const esPremio = (id: string): id is Premio => PREMIOS.some((p) => p.id === id)
const controlaRegion = () => ID_REGION

/** Las recomendaciones de una combinación de modo, premio y categoría, con las mismas reglas de respaldo del código antiguo. */
function elegir(stats: Stats, ml: boolean, premio: Premio, cat: string): Reco[] {
  if (cat !== 'all') {
    const porCategoria = stats.by_category?.[cat as keyof Stats['by_category']]
    return (ml ? porCategoria?.ml_recommendations : porCategoria?.recommendations) || []
  }
  if (ml) {
    // Una lista vacía del premio cuenta como lista: no se vuelve a las generales (igual que el código antiguo).
    const delPremio = stats.ml_prizes?.[premio]
    return delPremio || stats.ml_recommendations || []
  }
  const datosPremio = stats.prizes?.[premio] as { recommendations?: Reco[] } | undefined
  return datosPremio?.recommendations || stats.recommendations || []
}

function Tarjetas({ recos, ml }: { recos: Reco[]; ml: boolean }) {
  return (
    <div className="reco-grid">
      {recos.map((r, i) => (
        <div className={`reco-card${ml ? ' reco-ml' : ''}`} key={i}>
          <BotonCopiar numero={r.number} />
          <div className="reco-rank">{`${RANGOS[i] || `${i + 1}to`} Recomendado`}</div>
          <div className="reco-number">
            <Balls valor={r.number} variante={ml ? 'green' : 'gold'} tamano="lg" />
          </div>
          <div className="reco-confidence" title="Veces más probable que un número al azar (×1.00 = azar)">
            <div className="conf-bar">
              <div className="conf-bar-fill" style={{ width: `${liftBar(r.confidence)}%`, ...(ml ? { background: 'linear-gradient(90deg,var(--accent-green),#6ee7b7)' } : {}) }} />
            </div>
            {fmtLift(r.confidence)}
          </div>
        </div>
      ))}
    </div>
  )
}

export function Componente() {
  const stats = useStats()
  const sorteos = useSorteos()
  const [ml] = useML()
  const [premio, elegirPremio] = usePrize()
  const [cat, setCat] = useState('all')
  const categorias = useMemo(() => categoriasDe(sorteos), [sorteos])
  // Si tras recargar los datos desaparece la categoría elegida, el selector y las tarjetas vuelven a «Todos».
  const catValida = cat === 'all' || categorias.includes(cat) ? cat : 'all'
  const pestañasCategoria = [{ id: 'all', texto: 'Todos' }, ...categorias.map((c) => ({ id: c, texto: catLabel(c) }))]
  const recos = stats ? elegir(stats, ml, premio, catValida) : []
  const para = catValida === 'all' ? PREMIOS.find((p) => p.id === premio)?.texto : 'cualquier premio de 4 cifras'

  return (
    <>
      <div style={ESTILO_FILA}>
        <Tablist etiqueta="Seleccionar premio" pestañas={PREMIOS} valor={premio} onCambio={(id) => esPremio(id) && elegirPremio(id)} idPrefijo="premio" clase="prize-tabs" claseTab="prize-tab" controla={controlaRegion} estilo={ESTILO_SIN_MARGEN} />
        <InterruptorML />
      </div>
      <Tablist etiqueta="Filtrar por categoría" pestañas={pestañasCategoria} valor={catValida} onCambio={setCat} idPrefijo="recoCat" controla={controlaRegion} />
      {!stats ? (
        <div role="status" aria-label="Cargando recomendaciones">
          <div className="skel-grid">
            <Skeleton lineas={4} />
            <Skeleton lineas={4} />
            <Skeleton lineas={4} />
            <Skeleton lineas={4} />
          </div>
        </div>
      ) : (
        <div id={ID_REGION} role="region" aria-label="Números recomendados" aria-live="polite">
          {recos.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>No hay suficientes datos para esta combinación.</p>
          ) : (
            <>
              <div style={{ marginBottom: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Recomendaciones para <strong style={{ color: 'var(--gold-300)' }}>{para}</strong> — <span style={{ color: ml ? 'var(--accent-green)' : 'var(--gold-400)' }}>{ml ? '🤖 Machine Learning' : '📊 Estadístico'}</span>
              </div>
              <Tarjetas recos={recos} ml={ml} />
            </>
          )}
        </div>
      )}
    </>
  )
}
