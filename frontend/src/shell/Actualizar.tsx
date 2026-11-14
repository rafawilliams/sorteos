// Botón «Actualizar datos» (spec frontend-react, T054). Equivale a `runUpdate` de static/app.js: pide el token la primera
// vez (`prompt`), lo guarda solo mientras dure la pestaña (`sessionStorage`), llama a `POST /api/actualizar` y, si sale bien,
// avisa y recarga los datos.
//
// Los errores se muestran con el texto público que redacta el servidor (401, 503, 502, 500) o con uno genérico; nunca una traza
// ni el cuerpo de la respuesta (`api/client.ts`). Un 401 olvida el token para volver a pedirlo; una red caída no toca nada.
import { useRef, useState } from 'react'
import { actualizar } from '../api/client'
import { useReload, useToast } from '../store/hooks'

export const CLAVE_TOKEN = 'updateToken'
export const PREGUNTA_TOKEN = 'Token de actualización (ACTUALIZAR_TOKEN):'

const TEXTO_REPOSO = '↻ Actualizar datos'
const TEXTO_OCUPADO = '↻ Actualizando…'

// El almacenamiento de la pestaña puede no estar disponible (datos bloqueados, ventana privada): entonces el token solo vive
// en esa petición y la próxima vez se vuelve a pedir.
function leerToken(): string | null {
  try {
    return sessionStorage.getItem(CLAVE_TOKEN)
  } catch {
    return null
  }
}
function guardarToken(token: string): void {
  try {
    sessionStorage.setItem(CLAVE_TOKEN, token)
  } catch {
    // sin almacenamiento: no se recuerda
  }
}
function olvidarToken(): void {
  try {
    sessionStorage.removeItem(CLAVE_TOKEN)
  } catch {
    // sin almacenamiento: no hay nada que olvidar
  }
}

export function BotonActualizar() {
  const [ocupado, setOcupado] = useState(false)
  const avisar = useToast()
  const recargar = useReload()
  // El estado de React se actualiza tras el repintado: un segundo clic muy rápido entraría antes. La marca lo impide.
  const enCurso = useRef(false)

  async function alPulsar() {
    if (enCurso.current) return
    enCurso.current = true
    setOcupado(true)
    try {
      const token = leerToken() || window.prompt(PREGUNTA_TOKEN)
      if (!token) return // se canceló o se dejó vacío: no se pide nada
      const r = await actualizar(token)
      if (r.status === 401) olvidarToken()
      else if (r.status !== 0) guardarToken(token) // el servidor respondió algo que no es «token inválido»: el token sirve
      if (r.ok) {
        avisar(r.ml_retrained === false ? 'Datos actualizados (el modelo ML no se pudo reentrenar)' : 'Datos actualizados correctamente', 3000)
        await recargar()
      } else if (r.status === 0) {
        avisar(r.mensaje ?? 'Error de conexión', 3000)
      } else {
        avisar(`Error: ${r.mensaje ?? 'desconocido'}`, 4000)
      }
    } catch {
      avisar('Error de conexión', 3000)
    } finally {
      enCurso.current = false
      setOcupado(false)
    }
  }

  return (
    <button type="button" className="btn btn-gold" id="updateBtn" aria-label="Actualizar datos de sorteos" disabled={ocupado} onClick={alPulsar}>
      {ocupado ? TEXTO_OCUPADO : TEXTO_REPOSO}
    </button>
  )
}
