// Isla «Resultados» (spec frontend-react, T035). Equivale a `renderStatCounters`, `renderSorteos`, `renderPagination`,
// `goPage`, `initFilters` y `exportCSV` de static/app.js: los contadores por categoría, los filtros (texto, categoría y
// fechas), la tabla de sorteos con paginación de 50 y la exportación a CSV. Los premios se muestran tal como llegan (AC4).
//
// Lee los sorteos del Store (no necesita `stats`). El botón «Exportar CSV» vive en la cabecera de la pestaña, junto al de
// «↻ Actualizar datos» (que es del armazón y se migra en T054): la isla lo dibuja en la ranura `#resultadosCsv` de la
// plantilla con un portal, y sin ranura (pruebas, otra plantilla) lo pinta en su sitio.
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Skeleton } from '../components/Skeleton'
import { catClase, catLabel, formatDate } from '../lib/formato'
import { aCsv, categoriasDe, contarPorCategoria, filtrarSorteos, nombreArchivoCsv, POR_PAGINA, SIN_FILTROS, totalPaginas, ventanaPaginas, type Filtros } from '../lib/resultados'
import { useErrorSorteos, useReady, useReload, useSorteos, useToast } from '../store/hooks'

export const nombre = 'resultados'

/** Cuánto se espera para liberar la dirección del CSV: antes de eso algunos navegadores cortarían la descarga (FileSaver espera 40 s). */
const MS_LIBERAR_URL = 40_000

const etiqueta = (cat: unknown) => catLabel(String(cat ?? ''))

function Premio({ valor, clase }: { valor: string | null | undefined; clase: string }) {
  return valor ? <span className={`prize-chip ${clase}`}>{valor}</span> : <span className="num-empty">—</span>
}

function Meta({ valor }: { valor: string | null | undefined }) {
  return valor ? <span className="meta-chip">{valor}</span> : <span className="num-empty">—</span>
}

export function Componente() {
  const sorteos = useSorteos()
  const listo = useReady()
  const toast = useToast()
  const errorSorteos = useErrorSorteos()
  const recargar = useReload()
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS)
  const [pagina, setPagina] = useState(1)
  const tablaRef = useRef<HTMLDivElement>(null)
  const zonaRef = useRef<HTMLDivElement>(null)

  const categorias = useMemo(() => categoriasDe(sorteos), [sorteos])
  const contadores = useMemo(() => contarPorCategoria(sorteos), [sorteos])
  // Si tras recargar los datos ya no existe la categoría elegida, el selector y el filtro vuelven a «Todas»: sin esto el
  // selector enseñaría otra opción mientras la tabla seguiría filtrando por una que ya no está.
  const catValida = filtros.cat === 'all' || categorias.includes(filtros.cat) ? filtros.cat : 'all'
  const filtrados = useMemo(() => filtrarSorteos(sorteos, { ...filtros, cat: catValida }), [sorteos, filtros, catValida])

  const total = filtrados.length
  const paginas = totalPaginas(total)
  // Si los datos se reducen y la página actual ya no existe, se enseña la última.
  const actual = Math.min(Math.max(1, pagina), Math.max(1, paginas))
  const visibles = filtrados.slice((actual - 1) * POR_PAGINA, actual * POR_PAGINA)

  const cambiar = (parcial: Partial<Filtros>) => {
    setFiltros((f) => ({ ...f, ...parcial }))
    setPagina(1)
  }
  const ir = (p: number) => {
    setPagina(Math.max(1, Math.min(p, paginas)))
    if (tablaRef.current) tablaRef.current.scrollTop = 0
  }

  const exportar = () => {
    const blob = new Blob([aCsv(filtrados)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = nombreArchivoCsv(new Date())
    enlace.click()
    setTimeout(() => URL.revokeObjectURL(url), MS_LIBERAR_URL)
    toast(`CSV exportado: ${total} registros`)
  }

  const boton = (
    <button type="button" className="btn" aria-label="Exportar resultados a CSV" disabled={!listo} onClick={exportar}>
      ⬇ Exportar CSV
    </button>
  )
  const ranura = document.getElementById('resultadosCsv')
  const accion: ReactNode = ranura ? createPortal(boton, ranura) : <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>{boton}</div>

  if (!listo) {
    const reintentar = () => {
      zonaRef.current?.focus() // el botón desaparece al reintentar: el foco pasa al contenedor, no a <body>
      void recargar()
    }
    return (
      <>
        {accion}
        <div ref={zonaRef} tabIndex={-1} style={{ outline: 'none' }}>
          {errorSorteos ? (
            <div role="alert">
              <p style={{ color: '#f87171' }}>No se pudieron cargar los sorteos.</p>
              <button type="button" className="btn" onClick={reintentar}>
                Reintentar
              </button>
            </div>
          ) : (
            <div role="status" aria-label="Cargando resultados">
              <div className="skel-grid">
                <Skeleton lineas={2} />
                <Skeleton lineas={2} />
                <Skeleton lineas={2} />
                <Skeleton lineas={2} />
              </div>
              <Skeleton lineas={6} />
            </div>
          )}
        </div>
      </>
    )
  }

  const v = ventanaPaginas(actual, paginas)
  const numeros = Array.from({ length: Math.max(0, v.hasta - v.desde + 1) }, (_, i) => v.desde + i)

  return (
    <>
      {accion}

      <div className="stat-cards" role="region" aria-label="Contadores por categoría">
        <div className="stat-card">
          <div className="stat-value">{sorteos.length.toLocaleString()}</div>
          <div className="stat-label">Total Sorteos</div>
        </div>
        {contadores.map(([cat, cuenta]) => (
          <div className="stat-card" key={cat}>
            <div className="stat-value">{cuenta.toLocaleString()}</div>
            <div className="stat-label">{etiqueta(cat)}</div>
          </div>
        ))}
      </div>

      <div className="filter-bar" role="search" aria-label="Filtros de búsqueda">
        <input className="filter-input" type="search" placeholder="Buscar número…" aria-label="Buscar número" value={filtros.q} onChange={(e) => cambiar({ q: e.target.value })} />
        <select className="filter-select" aria-label="Filtrar por categoría" value={catValida} onChange={(e) => cambiar({ cat: e.target.value })}>
          <option value="all">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c} value={c}>
              {etiqueta(c)}
            </option>
          ))}
        </select>
        <input className="filter-date" type="date" aria-label="Fecha desde" value={filtros.desde} onChange={(e) => cambiar({ desde: e.target.value })} />
        <input className="filter-date" type="date" aria-label="Fecha hasta" value={filtros.hasta} onChange={(e) => cambiar({ hasta: e.target.value })} />
      </div>

      <div className="table-wrap" role="region" aria-label="Tabla de resultados" tabIndex={0} ref={tablaRef}>
        <table role="table" aria-label="Sorteos de la Lotería de Panamá">
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Categoría</th>
              <th scope="col">1er Premio</th>
              <th scope="col">2do Premio</th>
              <th scope="col">3er Premio</th>
              <th scope="col">Letras</th>
              <th scope="col">Serie</th>
              <th scope="col">Folio</th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 16px' }}>
                  No hay resultados con esos filtros.
                </td>
              </tr>
            ) : (
              visibles.map((s) => (
                <tr key={s.id}>
                  <td>{formatDate(s.fecha)}</td>
                  <td>
                    <span className={`cat-pill cat-${catClase(s.cat)}`}>{etiqueta(s.cat)}</span>
                  </td>
                  <td className="num-cell">
                    <Premio valor={s.primero} clase="prize-1" />
                  </td>
                  <td className="num-cell">
                    <Premio valor={s.segundo} clase="prize-2" />
                  </td>
                  <td className="num-cell">
                    <Premio valor={s.tercero} clase="prize-3" />
                  </td>
                  <td>
                    <Meta valor={s.letra} />
                  </td>
                  <td>
                    <Meta valor={s.serie} />
                  </td>
                  <td>
                    <Meta valor={s.folio} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <nav className="pagination" role="navigation" aria-label="Paginación de resultados">
        {paginas > 1 && (
          <>
            <button type="button" className="page-btn" aria-label="Primera página" disabled={actual === 1} onClick={() => ir(1)}>
              «
            </button>
            <button type="button" className="page-btn" aria-label="Página anterior" disabled={actual === 1} onClick={() => ir(actual - 1)}>
              ‹
            </button>
            {v.puntosAntes && <span className="page-info">…</span>}
            {numeros.map((n) => (
              <button type="button" key={n} className={`page-btn${n === actual ? ' active' : ''}`} aria-label={`Página ${n}`} aria-current={n === actual ? 'page' : undefined} onClick={() => ir(n)}>
                {n}
              </button>
            ))}
            {v.puntosDespues && <span className="page-info">…</span>}
            <button type="button" className="page-btn" aria-label="Página siguiente" disabled={actual >= paginas} onClick={() => ir(actual + 1)}>
              ›
            </button>
            <button type="button" className="page-btn" aria-label="Última página" disabled={actual >= paginas} onClick={() => ir(paginas)}>
              »
            </button>
            <span className="page-info">{`${total.toLocaleString()} resultados`}</span>
          </>
        )}
      </nav>
    </>
  )
}
