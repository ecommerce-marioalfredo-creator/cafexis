import { useMemo, useState } from 'react'
import { useAsync } from '@/hooks/useAsync'
import { runSalesReport, runStockReport } from '@/services/api/reportsService'
import {
  NAVIGABLE_PERIODS,
  PERIOD_LABEL,
  canGoForward,
  formatBucket,
  isTimeGroupBy,
  resolveGroupBy,
  resolvePeriod,
  shiftAnchor,
  toDateInput,
} from '@/services/api/reportPeriods'
import { PAYMENT_LABEL, currency } from '@/components/domain/paymentMethods'
import { MetricCard } from '@/components/ui/MetricCard'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { ColumnChart, type ChartPoint } from './ColumnChart'
import { BarList } from './BarList'
import type {
  PaymentMethod,
  ReportDefinition,
  ReportGroupBy,
  ReportMetric,
  ReportPeriodKind,
  SalesReportRow,
  StockReportRow,
} from '@/types/domain'
import './ReportViewer.css'

const PERIOD_KINDS: ReportPeriodKind[] = ['dia', 'semana', 'mes', 'ultimos_7', 'ultimos_30', 'rango']
const BAR_LIST_LIMIT = 12

const GROUP_HEADER: Record<Exclude<ReportGroupBy, 'auto'>, string> = {
  producto: 'Producto',
  categoria: 'Categoría',
  metodo_pago: 'Método de pago',
  elemento: 'Elemento',
  hora: 'Hora',
  dia: 'Día',
  semana: 'Semana',
  mes: 'Mes',
}

export const METRIC_LABEL: Record<ReportMetric, string> = {
  dinero: 'Ventas en dinero',
  unidades: 'Unidades vendidas',
  pedidos: 'Pedidos',
  vendido: 'Consumo por ventas',
  entradas: 'Entradas',
  ajustes: 'Ajustes',
  existencia: 'Existencia actual',
  cobertura: 'Días de cobertura',
}

const number = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })
const compactCurrency = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  notation: 'compact',
  maximumFractionDigits: 1,
})
const compactNumber = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 })

const salesValue = (row: SalesReportRow, metric: ReportMetric) =>
  metric === 'unidades' ? row.units : metric === 'pedidos' ? row.orders : row.revenue

const stockValue = (row: StockReportRow, metric: ReportMetric) => {
  switch (metric) {
    case 'entradas':
      return row.received
    case 'ajustes':
      return row.adjusted
    case 'existencia':
      return row.currentQuantity ?? 0
    case 'cobertura':
      return row.daysCoverage ?? 0
    default:
      return row.sold
  }
}

/** Urgencia según días de cobertura: estado con color + texto, nunca solo color. */
function CoverageBadge({ days }: { days?: number }) {
  if (days === undefined) return <Badge tone="neutral">Sin ventas</Badge>
  if (days <= 3) return <Badge tone="error">{number.format(days)} días</Badge>
  if (days <= 7) return <Badge tone="warning">{number.format(days)} días</Badge>
  return <Badge tone="success">{number.format(days)} días</Badge>
}

interface ReportViewerProps {
  report: ReportDefinition
}

export function ReportViewer({ report }: ReportViewerProps) {
  const { config } = report
  const [periodKind, setPeriodKind] = useState<ReportPeriodKind>(config.period)
  const [anchor, setAnchor] = useState(() => new Date())
  const [rangeFrom, setRangeFrom] = useState(config.rangeFrom ?? toDateInput(new Date(Date.now() - 6 * 86_400_000)))
  const [rangeTo, setRangeTo] = useState(config.rangeTo ?? toDateInput(new Date()))

  const period = useMemo(
    () => resolvePeriod(periodKind, anchor, { rangeFrom, rangeTo }),
    [periodKind, anchor, rangeFrom, rangeTo],
  )
  const groupBy = resolveGroupBy(config, period)
  const isSales = config.dataset === 'ventas'
  const rangeInvalid = periodKind === 'rango' && rangeFrom > rangeTo

  const { data, loading, error, reload } = useAsync(async () => {
    if (rangeInvalid) return undefined
    if (isSales) {
      const [main, summary, breakdown] = await Promise.all([
        runSalesReport(config, period, groupBy as Parameters<typeof runSalesReport>[2]),
        runSalesReport(config, period, 'total'),
        config.breakdown ? runSalesReport(config, period, config.breakdown) : Promise.resolve(undefined),
      ])
      return { sales: main, summary: summary[0], breakdown, stock: undefined }
    }
    const stock = await runStockReport(config, period, groupBy as Parameters<typeof runStockReport>[2])
    return { stock, sales: undefined, summary: undefined, breakdown: undefined }
  }, [report.id, JSON.stringify(config), period.from.getTime(), period.to.getTime(), rangeInvalid])

  const navigable = NAVIGABLE_PERIODS.includes(periodKind)
  const timeGroup = isTimeGroupBy(groupBy) ? groupBy : undefined
  const unit = data?.stock?.[0]?.unit ?? ''

  const formatMetric = (value: number): string => {
    if (config.metric === 'dinero') return currency.format(value)
    if (config.metric === 'unidades' || config.metric === 'pedidos') return number.format(value)
    if (config.metric === 'cobertura') return `${number.format(value)} días`
    return `${number.format(value)} ${timeGroup ? unit : ''}`.trim()
  }
  const formatTick = (value: number) =>
    config.metric === 'dinero' ? compactCurrency.format(value) : compactNumber.format(value)

  const rowLabel = (row: { key: string; label: string }, compact = false) => {
    if (timeGroup) return formatBucket(row.key, timeGroup, compact)
    if (groupBy === 'metodo_pago') return PAYMENT_LABEL[row.key as PaymentMethod] ?? row.label
    return row.label
  }

  const points: ChartPoint[] = data
    ? data.sales
      ? data.sales.map((r) => ({
          key: r.key,
          label: rowLabel(r),
          shortLabel: rowLabel(r, true),
          value: salesValue(r, config.metric),
        }))
      : (data.stock ?? []).map((r) => ({
          key: r.key,
          label: rowLabel(r),
          shortLabel: rowLabel(r, true),
          value: stockValue(r, config.metric),
        }))
    : []

  const isEmpty = data
    ? data.sales
      ? (data.summary?.orders ?? 0) === 0
      : (data.stock ?? []).length === 0
    : false

  return (
    <div className="section-stack">
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

      {rangeInvalid && <div className="form-error-banner">La fecha inicial debe ser anterior a la final.</div>}

      {loading && !data ? (
        <PageLoading label="Calculando reporte…" />
      ) : error ? (
        <PageError message={error} onRetry={reload} />
      ) : data ? (
        <div className={['section-stack', loading ? 'report-viewer--refreshing' : ''].join(' ')} aria-busy={loading}>
          {data.summary && (
            <div className="dashboard-page__metrics">
              <MetricCard label="Ventas" value={currency.format(data.summary.revenue)} />
              <MetricCard label="Pedidos" value={number.format(data.summary.orders)} />
              <MetricCard
                label="Ticket promedio"
                value={currency.format(data.summary.orders > 0 ? data.summary.revenue / data.summary.orders : 0)}
              />
              <MetricCard label="Unidades vendidas" value={number.format(data.summary.units)} />
            </div>
          )}

          {isEmpty ? (
            <EmptyState
              title={isSales ? 'Sin ventas en este período' : 'No hay elementos para mostrar'}
              description={isSales ? 'Prueba con otro período o revisa los filtros del reporte.' : undefined}
            />
          ) : (
            <>
              {config.chart === 'barras' && points.length > 0 && (
                <Card
                  title={
                    timeGroup
                      ? `${METRIC_LABEL[config.metric]} por ${GROUP_HEADER[timeGroup].toLowerCase()}`
                      : points.length > BAR_LIST_LIMIT
                        ? `${METRIC_LABEL[config.metric]} · top ${BAR_LIST_LIMIT}`
                        : METRIC_LABEL[config.metric]
                  }
                >
                  {timeGroup ? (
                    <ColumnChart
                      points={points}
                      formatValue={formatMetric}
                      formatTick={formatTick}
                      ariaLabel={`${METRIC_LABEL[config.metric]}, ${period.label}`}
                    />
                  ) : (
                    <BarList
                      points={[...points].sort((a, b) => b.value - a.value).slice(0, BAR_LIST_LIMIT)}
                      formatValue={formatMetric}
                      ariaLabel={`${METRIC_LABEL[config.metric]}, ${period.label}`}
                    />
                  )}
                </Card>
              )}

              <Card title="Detalle">
                {data.sales ? (
                  <SalesTable rows={data.sales} header={GROUP_HEADER[groupBy]} rowLabel={rowLabel} />
                ) : (
                  <StockTable
                    rows={data.stock ?? []}
                    header={config.dataset === 'lotes' ? 'Lote' : timeGroup ? GROUP_HEADER[timeGroup] : 'Insumo'}
                    rowLabel={rowLabel}
                    byElement={!timeGroup}
                  />
                )}
              </Card>

              {data.breakdown && (
                <Card title="Por método de pago">
                  <SalesTable rows={data.breakdown} header="Método de pago" rowLabel={(r) => PAYMENT_LABEL[r.key as PaymentMethod] ?? r.label} />
                </Card>
              )}
            </>
          )}

          {!isSales && (
            <p className="section-subtitle">
              El consumo cuenta solo las salidas por ventas; los ajustes manuales (mermas, correcciones) se muestran
              aparte. La cobertura es cuántos días dura la existencia actual al ritmo de ventas de este período.
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}

interface SalesTableProps {
  rows: SalesReportRow[]
  header: string
  rowLabel: (row: SalesReportRow) => string
}

function SalesTable({ rows, header, rowLabel }: SalesTableProps) {
  const total = rows.reduce((sum, r) => sum + r.revenue, 0)
  return (
    <div className="data-table-wrapper">
      <table className="data-table report-table">
        <thead>
          <tr>
            <th>{header}</th>
            <th className="report-table__num">Unidades</th>
            <th className="report-table__num">Pedidos</th>
            <th className="report-table__num">Ventas</th>
            <th className="report-table__num">% del total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{rowLabel(r)}</td>
              <td className="report-table__num">{number.format(r.units)}</td>
              <td className="report-table__num">{number.format(r.orders)}</td>
              <td className="report-table__num">{currency.format(r.revenue)}</td>
              <td className="report-table__num">{total > 0 ? `${number.format((r.revenue / total) * 100)} %` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface StockTableProps {
  rows: StockReportRow[]
  header: string
  rowLabel: (row: StockReportRow) => string
  byElement: boolean
}

function StockTable({ rows, header, rowLabel, byElement }: StockTableProps) {
  const qty = (value: number | undefined, unit: string) => (value === undefined ? '—' : `${number.format(value)} ${unit}`)
  const signed = (value: number, unit: string) => `${value > 0 ? '+' : ''}${number.format(value)} ${unit}`

  return (
    <div className="data-table-wrapper">
      <table className="data-table report-table">
        <thead>
          <tr>
            <th>{header}</th>
            <th className="report-table__num">Consumo por ventas</th>
            <th className="report-table__num">Entradas</th>
            <th className="report-table__num">Ajustes</th>
            {byElement && (
              <>
                <th className="report-table__num">Existencia</th>
                <th className="report-table__num">Consumo diario</th>
                <th>Cobertura</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{rowLabel(r)}</td>
              <td className="report-table__num">{qty(r.sold, r.unit)}</td>
              <td className="report-table__num">{qty(r.received, r.unit)}</td>
              <td className="report-table__num">{signed(r.adjusted, r.unit)}</td>
              {byElement && (
                <>
                  <td className="report-table__num">{qty(r.currentQuantity, r.unit)}</td>
                  <td className="report-table__num">{qty(r.dailyRate, `${r.unit}/día`)}</td>
                  <td>
                    <CoverageBadge days={r.daysCoverage} />
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
