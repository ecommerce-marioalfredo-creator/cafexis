import type { ChartPoint } from './ColumnChart'
import './charts.css'

interface BarListProps {
  points: Array<Omit<ChartPoint, 'shortLabel'>>
  formatValue: (value: number) => string
  ariaLabel: string
}

/**
 * Ranking en barras horizontales (una serie), con el valor en la punta de
 * cada barra. Las etiquetas largas se recortan con "…" pero quedan
 * completas en el tooltip nativo y en la tabla del reporte.
 */
export function BarList({ points, formatValue, ariaLabel }: BarListProps) {
  const max = Math.max(0, ...points.map((p) => p.value))

  return (
    <ul className="chart bar-list" aria-label={ariaLabel}>
      {points.map((p) => (
        <li
          key={p.key}
          className="bar-list__row"
          tabIndex={0}
          title={`${p.label}: ${formatValue(p.value)}`}
          aria-label={`${p.label}: ${formatValue(p.value)}`}
        >
          <span className="bar-list__label">{p.label}</span>
          <span className="bar-list__track">
            <span
              className="bar-list__bar"
              style={
                p.value > 0 && max > 0
                  ? { width: `calc(${(p.value / max) * 100}% - 64px)`, minWidth: 2 }
                  : { width: 0 }
              }
            />
            <span className="bar-list__value">{formatValue(p.value)}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
