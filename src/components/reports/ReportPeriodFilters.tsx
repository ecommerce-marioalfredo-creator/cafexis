import { useMemo, useState } from 'react'
import {
  NAVIGABLE_PERIODS,
  PERIOD_LABEL,
  canGoForward,
  resolvePeriod,
  shiftAnchor,
  toDateInput,
} from '@/services/api/reportPeriods'
import type { ReportPeriodKind } from '@/types/domain'

const PERIOD_KINDS: ReportPeriodKind[] = ['dia', 'semana', 'mes', 'ultimos_7', 'ultimos_30', 'rango']

/** Período elegido en un reporte: día/semana/mes navegables, ventanas móviles o un rango de fechas. */
export function useReportPeriod(initialKind: ReportPeriodKind, initialRange?: { from?: string; to?: string }) {
  const [periodKind, setPeriodKind] = useState(initialKind)
  const [anchor, setAnchor] = useState(() => new Date())
  const [rangeFrom, setRangeFrom] = useState(initialRange?.from ?? toDateInput(new Date(Date.now() - 6 * 86_400_000)))
  const [rangeTo, setRangeTo] = useState(initialRange?.to ?? toDateInput(new Date()))

  const period = useMemo(
    () => resolvePeriod(periodKind, anchor, { rangeFrom, rangeTo }),
    [periodKind, anchor, rangeFrom, rangeTo],
  )

  return {
    period,
    rangeInvalid: periodKind === 'rango' && rangeFrom > rangeTo,
    controls: { period, periodKind, setPeriodKind, anchor, setAnchor, rangeFrom, setRangeFrom, rangeTo, setRangeTo },
  }
}

type ReportPeriodControls = ReturnType<typeof useReportPeriod>['controls']

export function ReportPeriodFilters({ controls }: { controls: ReportPeriodControls }) {
  const { period, periodKind, setPeriodKind, anchor, setAnchor, rangeFrom, setRangeFrom, rangeTo, setRangeTo } = controls
  const navigable = NAVIGABLE_PERIODS.includes(periodKind)

  return (
    <div className="report-viewer__filters">
      <div className="page-toolbar__filters" role="group" aria-label="Período">
        {PERIOD_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            className={['filter-chip', kind === periodKind ? 'filter-chip--active' : ''].join(' ')}
            aria-pressed={kind === periodKind}
            onClick={() => {
              setPeriodKind(kind)
              setAnchor(new Date())
            }}
          >
            {PERIOD_LABEL[kind]}
          </button>
        ))}
      </div>

      <div className="report-viewer__period">
        {navigable && (
          <button
            type="button"
            className="report-viewer__nav"
            onClick={() => setAnchor((a) => shiftAnchor(periodKind, a, -1))}
            aria-label="Período anterior"
          >
            ‹
          </button>
        )}
        {periodKind === 'rango' ? (
          <span className="report-viewer__range">
            <input type="date" value={rangeFrom} max={rangeTo} onChange={(e) => setRangeFrom(e.target.value)} aria-label="Desde" />
            <span>a</span>
            <input type="date" value={rangeTo} min={rangeFrom} onChange={(e) => setRangeTo(e.target.value)} aria-label="Hasta" />
          </span>
        ) : (
          <strong className="report-viewer__period-label">{period.label}</strong>
        )}
        {navigable && (
          <button
            type="button"
            className="report-viewer__nav"
            onClick={() => setAnchor((a) => shiftAnchor(periodKind, a, 1))}
            disabled={!canGoForward(periodKind, anchor)}
            aria-label="Período siguiente"
          >
            ›
          </button>
        )}
      </div>
    </div>
  )
}
