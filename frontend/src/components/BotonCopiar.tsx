// Botón «Copiar» de un número (spec frontend-react, T029; lo usan Mensual, Predicciones y Terminaciones). Equivale a
// `copyNumber` y `.copy-btn` del antiguo static/app.js (ya retirado): copia el número al portapapeles, avisa «Copiado: …» y
// se marca «OK» durante 1,5 s.
// Diferencias respecto al código antiguo (decisions.md): el nombre accesible lleva el número y el estado («Copiar 9541»,
// luego «Copiado 9541»; no varios botones «Copiar» iguales), solo se marca el botón pulsado, y si el portapapeles falta o
// rechaza se avisa en vez de lanzar. Lleva `data-numero` y no `data-num`, que era el atributo del botón antiguo.
import { useEffect, useRef, useState } from 'react'
import { useToast } from '../store/hooks'

const MS_MARCADO = 1500

export function BotonCopiar({ numero }: { numero: string }) {
  const toast = useToast()
  const [copiado, setCopiado] = useState(false)
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const vivo = useRef(true)

  useEffect(() => {
    vivo.current = true
    return () => {
      vivo.current = false
      clearTimeout(temporizador.current)
    }
  }, [])

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(numero) // sin portapapeles (`undefined`) lanza TypeError: se trata igual que un rechazo
    } catch {
      toast('No se pudo copiar')
      return
    }
    toast(`Copiado: ${numero}`) // la copia se hizo: se avisa aunque el botón ya no esté (como el aviso de fallo)
    if (!vivo.current) return // el botón ya no está: ni estado ni temporizador
    setCopiado(true)
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setCopiado(false), MS_MARCADO)
  }

  return (
    <button
      type="button"
      className={`copy-btn${copiado ? ' copied' : ''}`}
      data-numero={numero}
      aria-label={`${copiado ? 'Copiado' : 'Copiar'} ${numero}`}
      onClick={() => void copiar()}
    >
      {copiado ? 'OK' : 'Copiar'}
    </button>
  )
}
