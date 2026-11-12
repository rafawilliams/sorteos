// Esferas de sorteo (spec frontend-react, T013). Equivale a `renderBalls` de `static/app.js`:
// una esfera por carácter y el premio tal como llega, nunca rellenado con ceros (principio 7).

export type VarianteBola = 'gold' | 'green' | 'purple' | 'hot'
export type TamanoBola = 'sm' | 'md' | 'lg'

export interface BallsProps {
  valor: string | null | undefined
  variante?: VarianteBola
  tamano?: TamanoBola
}

export function Balls({ valor, variante = 'gold', tamano = 'lg' }: BallsProps) {
  const texto = String(valor ?? '').trim()
  if (!texto) return <span className="num-empty">—</span>
  return (
    <span className={`lotto-balls lotto-balls-${tamano}`} aria-label={texto}>
      {Array.from(texto).map((caracter, i) => (
        <span key={i} className={`lotto-ball ball-${variante}`} aria-hidden="true">
          {caracter}
        </span>
      ))}
    </span>
  )
}
