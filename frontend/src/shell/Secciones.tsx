// Las 14 secciones de la página (spec frontend-react, T055). Equivalen a los `<section>` de la plantilla antigua: cada una lleva su
// título y su subtítulo y, debajo, la pestaña de `tabs/`. Todas están montadas desde el principio y solo la activa se ve
// (`.section.active` en style.css), como antes.
import type { CSSProperties, ReactNode } from 'react'
import { InterruptorML } from '../components/InterruptorML'
import { useReveal } from '../components/useReveal'
import { useActiveTab } from '../store/hooks'
import type { TabId } from '../store/tipos'
import * as Analisis from '../tabs/Analisis'
import * as Comparador from '../tabs/Comparador'
import * as Decenas from '../tabs/Decenas'
import * as Estadisticas from '../tabs/Estadisticas'
import * as Favoritos from '../tabs/Favoritos'
import * as Gaps from '../tabs/Gaps'
import * as Mensual from '../tabs/Mensual'
import * as Precision from '../tabs/Precision'
import * as Predicciones from '../tabs/Predicciones'
import * as PrediccionesResumen from '../tabs/PrediccionesResumen'
import * as Resultados from '../tabs/Resultados'
import * as Seguimiento from '../tabs/Seguimiento'
import * as Simulador from '../tabs/Simulador'
import * as Tendencias from '../tabs/Tendencias'
import * as Terminaciones from '../tabs/Terminaciones'
import { BotonActualizar } from './Actualizar'
import { FronteraDeSeccion } from './FronteraDeSeccion'

function Seccion({ id, children }: { id: TabId; children: ReactNode }) {
  const activa = useActiveTab() === id
  return (
    <section className={`section${activa ? ' active' : ''}`} id={`sec-${id}`} role="tabpanel" aria-labelledby={`tab-${id}`}>
      <FronteraDeSeccion nombre={id}>{children}</FronteraDeSeccion>
    </section>
  )
}

function Titulo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <>
      <h2 className="section-title">{titulo}</h2>
      <p className="section-subtitle">{children}</p>
    </>
  )
}

const ESTILO_RESUMEN: CSSProperties = { marginBottom: 28 }
const ESTILO_ENCABEZADO_ML: CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 8 }
const ESTILO_ACCIONES: CSSProperties = { display: 'flex', gap: 8 }
const ESTILO_RANURA_CSV: CSSProperties = { display: 'contents' }
const ESTILO_TARJETA_METODO: CSSProperties = { marginTop: 28 }
const ESTILO_PARRAFO_METODO: CSSProperties = { color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.7 }
const ESTILO_DORADO: CSSProperties = { color: 'var(--gold-300)' }
const ESTILO_AVISO: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8rem' }

/** La tarjeta «¿Cómo funciona?» del final de Predicciones. */
function TarjetaMetodologia() {
  const revelar = useReveal()
  return (
    <div className="card reveal" style={ESTILO_TARJETA_METODO} ref={revelar}>
      <div className="card-header">
        <h3 className="card-title">¿Cómo funciona?</h3>
        <span className="card-badge badge-gold">Metodología</span>
      </div>
      <p style={ESTILO_PARRAFO_METODO}>
        Nuestro algoritmo analiza la <strong style={ESTILO_DORADO}>frecuencia de dígitos por posición</strong> para cada premio (1ro, 2do, 3ro), aplica <strong style={ESTILO_DORADO}>pesos de recencia</strong> (los sorteos más recientes tienen mayor
        influencia), y ordena los 10.000 números por la <strong style={ESTILO_DORADO}>probabilidad exacta</strong> de sus dígitos, con el historial <strong style={ESTILO_DORADO}>desde 1995 hasta la fecha</strong>. La confianza indica cuántas veces más
        probable es un número que uno al azar (×1.00 = azar).
        <br />
        <br />
        <span style={ESTILO_AVISO}>⚠ Nota: La lotería es un juego de azar. Estas recomendaciones son puramente estadísticas y no garantizan resultados.</span>
      </p>
    </div>
  )
}

export function Secciones() {
  return (
    <>
      <Seccion id="predicciones">
        <div style={ESTILO_RESUMEN}>
          <PrediccionesResumen.Componente />
        </div>
        <Titulo titulo="Números Recomendados">Basado en análisis de frecuencia posicional, tendencias recientes y patrones históricos.</Titulo>
        <Predicciones.Componente />
        <TarjetaMetodologia />
      </Seccion>

      <Seccion id="decenas">
        <Titulo titulo="Decena Recomendada">
          Decena (penúltimo dígito) más frecuente tras el patrón de los últimos sorteos de cada categoría, contando los 3 premios desde 1995. Si el patrón tiene menos de 20 coincidencias, se usa la frecuencia general. Cada tarjeta muestra su prueba
          frente al azar: las decenas aciertan como el azar.
        </Titulo>
        <Decenas.Componente />
      </Seccion>

      <Seccion id="terminaciones">
        <div style={ESTILO_ENCABEZADO_ML}>
          <div>
            <Titulo titulo="Análisis de Últimos 2 Dígitos">Frecuencia, predicción y tendencias de las terminaciones (00–99) de los 3 premios.</Titulo>
          </div>
          <InterruptorML />
        </div>
        <Terminaciones.Componente />
      </Seccion>

      <Seccion id="resultados">
        <div className="section-header">
          <div>
            <Titulo titulo="Resultados Recientes">Historial completo de sorteos de la Lotería de Panamá.</Titulo>
          </div>
          <div style={ESTILO_ACCIONES}>
            {/* La isla Resultados dibuja aquí su botón «Exportar CSV» (un portal), a la izquierda de «Actualizar datos». */}
            <span id="resultadosCsv" style={ESTILO_RANURA_CSV} />
            <BotonActualizar />
          </div>
        </div>
        <Resultados.Componente />
      </Seccion>

      <Seccion id="estadisticas">
        <Titulo titulo="Estadísticas Generales">Frecuencia de dígitos, números calientes y fríos.</Titulo>
        <Estadisticas.Componente />
      </Seccion>

      <Seccion id="tendencias">
        <Titulo titulo="Tendencias Temporales">Evolución de la frecuencia de dígitos a lo largo del tiempo.</Titulo>
        <Tendencias.Componente />
      </Seccion>

      <Seccion id="analisis">
        <Titulo titulo="Análisis por Posición">Probabilidad de cada dígito (0–9) en cada una de las 4 posiciones del número ganador.</Titulo>
        <Analisis.Componente />
      </Seccion>

      <Seccion id="comparador">
        <Titulo titulo="Comparador de Números">Ingresa hasta 5 números y compara su historial, frecuencia, última aparición y meses favorables.</Titulo>
        <Comparador.Componente />
      </Seccion>

      <Seccion id="gaps">
        <Titulo titulo="Análisis de Gaps">¿Cuántos sorteos llevan sin aparecer los números más populares? Los números con gap alto respecto a su promedio están "vencidos".</Titulo>
        <Gaps.Componente />
      </Seccion>

      <Seccion id="simulador">
        <Titulo titulo="Simulador: ¿Cuánto habría ganado?">Ingresa un número y descubre cuántas veces ha salido en toda la historia de la lotería.</Titulo>
        <Simulador.Componente />
      </Seccion>

      <Seccion id="favoritos">
        <Titulo titulo="Mis Números Favoritos">Guarda tus números y recibe alertas cuando salgan en los resultados o sean recomendados por el modelo.</Titulo>
        <Favoritos.Componente />
      </Seccion>

      <Seccion id="mensual">
        <Titulo titulo="Recomendación Mensual">Análisis histórico por mes del año: descubre qué números, dígitos y terminaciones son más frecuentes en cada mes.</Titulo>
        <Mensual.Componente />
      </Seccion>

      <Seccion id="seguimiento">
        <Titulo titulo="Seguimiento de Recomendaciones">
          Lo que la web recomendó <strong>antes</strong> de cada sorteo frente a lo que salió. La recomendación se congela la primera vez que se calcula tras el último sorteo de cada categoría. Los sorteos son independientes: lo esperable es rendir como el
          azar.
        </Titulo>
        <Seguimiento.Componente />
      </Seccion>

      <Seccion id="precision">
        <Titulo titulo="Precisión Histórica">Backtesting: comparamos las predicciones del modelo contra los resultados reales para medir su rendimiento.</Titulo>
        <Precision.Componente />
      </Seccion>
    </>
  )
}
