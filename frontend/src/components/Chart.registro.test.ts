// Sin dobles: el módulo REAL de chart.js, para que falte un registro y se note. El doble de `Chart.test.tsx` no puede
// saberlo, y en el navegador Chart.js lanzaría «"bar" is not a registered controller» y el gráfico no se pintaría.
import { Chart as ChartJS } from 'chart.js'
import { describe, expect, it } from 'vitest'
import './Chart' // importar el componente registra los tipos

const { registry } = ChartJS

describe('Chart.js real: lo que la interfaz dibuja está registrado', () => {
  it.each(['bar', 'line', 'radar', 'scatter'])('controlador «%s»', (tipo) => {
    expect(() => registry.getController(tipo)).not.toThrow()
  })

  it.each(['category', 'linear', 'radialLinear'])('escala «%s»', (escala) => {
    expect(() => registry.getScale(escala)).not.toThrow()
  })

  it.each(['bar', 'line', 'point'])('elemento «%s»', (elemento) => {
    expect(() => registry.getElement(elemento)).not.toThrow()
  })

  it.each(['tooltip', 'legend', 'filler'])('complemento «%s»', (plugin) => {
    expect(registry.getPlugin(plugin)).toBeTruthy()
  })

  it('un tipo que no se usa no está registrado (la prueba puede fallar)', () => {
    expect(() => registry.getController('doughnut')).toThrow()
  })
})
