// Botón «Copiar» de un número (spec frontend-react, T029; lo reutiliza T044). Equivale a `copyNumber` y `.copy-btn` de
// static/app.js: copia el número al portapapeles, avisa «Copiado: …» y se marca «OK» durante 1,5 s.
// Diferencias respecto a app.js (decisions.md): el nombre accesible lleva el número («Copiar 9541», no varios botones
// «Copiar» iguales), solo se marca el botón pulsado, y si el portapapeles falta o rechaza se avisa en vez de lanzar.
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
    if (!vivo.current) return // el botón ya no está: ni aviso ni temporizador
    toast(`Copiado: ${numero}`)
    setCopiado(true)
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setCopiado(false), MS_MARCADO)
  }

  return (
    <button type="button" className={`copy-btn${copiado ? ' copied' : ''}`} data-num={numero} aria-label={`Copiar ${numero}`} onClick={() => void copiar()}>
      {copiado ? 'OK' : 'Copiar'}
    </button>
  )
}
