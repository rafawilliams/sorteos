// El número de 4 cifras que teclea el usuario (Simulador y Mis Números). Es el ÚNICO sitio de `frontend/src` donde se
// rellena con ceros (principio 7 de la constitución y plan §0): un premio que llega de la API se muestra tal cual,
// pero «74» tecleado por la persona significa «0074», como hoy en static/app.js.

/** Recorta los espacios y rellena con ceros a la izquierda hasta 4 cifras. No recorta lo que ya es más largo. */
export function normalizarNumero(texto: string): string {
  return texto.trim().padStart(4, '0')
}

/**
 * El número normalizado si es de exactamente 4 cifras (0-9 ASCII); `null` si no. Un campo vacío es inválido
 * (`app.js` lo rellenaba hasta «0000» y lo daba por bueno: un clic sin querer añadía un favorito «0000»).
 */
export function validarNumero(texto: string): string | null {
  if (texto.trim() === '') return null
  const numero = normalizarNumero(texto)
  return /^[0-9]{4}$/.test(numero) ? numero : null
}
