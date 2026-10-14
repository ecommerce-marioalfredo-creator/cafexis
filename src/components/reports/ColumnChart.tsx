import { useEffect, useRef, useState } from 'react'
import './charts.css'

export interface ChartPoint {
  key: string
  /** Etiqueta completa (tooltip y lectores de pantalla). */
  label: string
  /** Etiqueta corta para el eje X. */
  shortLabel: string
  value: number
}

interface ColumnChartProps {
  points: ChartPoint[]
  formatValue: (value: number) => string
  /** Formato compacto para el eje Y (ej. $1,2 M). */
  formatTick?: (value: number) => string
  ariaLabel: string
}

/** Máximo "redondo" para el eje (1, 2, 3, 4, 5, 6, 8 × 10^n): con 4 divisiones da marcas limpias. */
function niceMax(max: number): number {
  if (max <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(max))
  const normalized = max / magnitude
  const step = [1, 2, 3, 4, 5, 6, 8, 10].find((s) => normalized <= s) ?? 10
  return step * magnitude
}

/** Ancho mínimo por etiqueta del eje X, para que no se encimen en pantallas angostas. */
const PX_PER_X_LABEL = 64

/**
 * Columnas para series de tiempo (una serie). Cada tramo es su propio
 * objetivo de hover/foco con tooltip; valores negativos se dibujan en 0
 * (el generador no permite graficar métricas con signo).
 */
export function ColumnChart({ points, formatValue, formatTick = formatValue, ariaLabel }: ColumnChartProps) {
  const [active, setActive] = useState<number>()
  const plotRef = useRef<HTMLDivElement>(null)
  const [plotWidth, setPlotWidth] = useState(600)

  useEffect(() => {
    const el = plotRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setPlotWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const top = niceMax(Math.max(0, ...points.map((p) => p.value)))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * top)
  const maxLabels = Math.max(2, Math.floor(plotWidth / PX_PER_X_LABEL))
  const labelEvery = Math.max(1, Math.ceil(points.length / maxLabels))
  const activePoint = active !== undefined ? points[active] : undefined

  return (
    <div className="chart column-chart" role="group" aria-label={ariaLabel}>
      <div className="column-chart__y-axis" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} className="column-chart__y-tick" style={{ bottom: `${(t / top) * 100}%` }}>
            {formatTick(t)}
          </span>
        ))}
      </div>

      <div className="column-chart__plot" ref={plotRef}>
        {ticks.slice(1).map((t) => (
          // La de 100% se dibuja 1px por dentro para que no quede fuera del área.
          <div key={t} className="column-chart__grid" style={{ bottom: t === top ? 'calc(100% - 1px)' : `${(t / top) * 100}%` }} />
        ))}
        <div className="column-chart__columns">
          {points.map((p, i) => (
            <div
              key={p.key}
              className="column-chart__slot"
              tabIndex={0}
              aria-label={`${p.label}: ${formatValue(p.value)}`}
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(undefined)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(undefined)}
            >
              <div className="column-chart__column" style={{ height: `${(Math.max(0, p.value) / top) * 100}%` }} />
            </div>
          ))}
        </div>
        {activePoint && active !== undefined && (
          <div
            className="chart-tooltip"
            role="status"
            style={{
              left: `${((active + 0.5) / points.length) * 100}%`,
              top: `${100 - (Math.max(0, activePoint.value) / top) * 100}%`,
            }}
          >
            <strong>{formatValue(activePoint.value)}</strong>
            {activePoint.label}
          </div>
        )}
      </div>

      <div className="column-chart__x-axis" aria-hidden="true">
        {points.map((p, i) => (
          <span key={p.key} className="column-chart__x-label">
            {i % labelEvery === 0 ? p.shortLabel : ''}
          </span>
        ))}
      </div>
    </div>
  )
}
