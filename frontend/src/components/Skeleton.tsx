// Esqueleto de carga (spec frontend-react, T016). Mismo marcado que `skelCard` de static/app.js:
// una línea gruesa de 60 % y después, alternando, 40 % y 80 %.

export interface SkeletonProps {
  lineas?: number
}

export function Skeleton({ lineas = 3 }: SkeletonProps) {
  return (
    <div className="skeleton">
      {Array.from({ length: lineas }, (_, i) => (
        <div key={i} className={`skel-line ${i === 0 ? 'thick w60' : i % 2 === 0 ? 'w80' : 'w40'}`} />
      ))}
    </div>
  )
}
