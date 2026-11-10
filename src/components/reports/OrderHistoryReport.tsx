import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAsync } from '@/hooks/useAsync'
import { listOrderHistory } from '@/services/api/reportsService'
import { ORDER_STATUS_META } from '@/components/domain/orderStatus'
import { PAYMENT_LABEL, currency } from '@/components/domain/paymentMethods'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { ReportPeriodFilters, useReportPeriod } from './ReportPeriodFilters'
import type { Order } from '@/types/domain'
import './ReportViewer.css'

const PAGE_SIZE = 50
const dateFormat = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' })

function CancellationDetail({ order }: { order: Order }) {
  const by =
    order.cancelledBySide === 'cliente' ? 'el cliente' : (order.cancelledByName ?? 'el negocio')
  return (
    <span className="order-history__detail">
      Por {by}
      {order.cancelledAt ? ` · ${dateFormat.format(new Date(order.cancelledAt))}` : ''}
      {order.cancellationReason && (
        <>
          <br />
          Motivo: {order.cancellationReason}
        </>
      )}
    </span>
  )
}

/**
 * Histórico de pedidos del negocio: todos los del período con su estado,
 * incluidos los cancelados y quién los canceló. A diferencia de los reportes de
 * ventas, no agrega cifras: es la lista de lo que pasó, pedido por pedido.
 *
 * historyDays: el plan Básica (0019) solo consulta los últimos N días; el
 * período elegido se recorta a esa ventana.
 */
export function OrderHistoryReport({ historyDays }: { historyDays?: number }) {
  const { period: chosenPeriod, rangeInvalid, controls } = useReportPeriod('mes')
  const minFrom = useMemo(() => {
    if (historyDays === undefined) return undefined
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), today.getDate() - (historyDays - 1))
  }, [historyDays])
  const outOfPlan = minFrom !== undefined && chosenPeriod.to <= minFrom
  const clipped = minFrom !== undefined && !outOfPlan && chosenPeriod.from < minFrom
  const period = clipped ? { ...chosenPeriod, from: minFrom } : chosenPeriod
  const [onlyCancelled, setOnlyCancelled] = useState(false)
  const [moreOrders, setMoreOrders] = useState<Order[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string>()

  const from = period.from.getTime()
  const to = period.to.getTime()

  const { data, loading, error, reload } = useAsync(
    async () => (rangeInvalid || outOfPlan ? undefined : listOrderHistory(period, onlyCancelled, 0, PAGE_SIZE)),
    [from, to, onlyCancelled, rangeInvalid, outOfPlan],
  )

  useEffect(() => {
    setMoreOrders([])
    setMoreError(undefined)
  }, [from, to, onlyCancelled])

  const orders = [...(data?.orders ?? []), ...moreOrders]

  const loadMore = async () => {
    setLoadingMore(true)
    setMoreError(undefined)
    try {
      const next = await listOrderHistory(period, onlyCancelled, orders.length, PAGE_SIZE)
      setMoreOrders((prev) => [...prev, ...next.orders])
    } catch (err) {
      setMoreError(err instanceof Error ? err.message : 'No se pudieron cargar más pedidos.')
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="section-stack">
      <ReportPeriodFilters controls={controls} />

      {rangeInvalid && <div className="form-error-banner">La fecha inicial debe ser anterior a la final.</div>}
      {(outOfPlan || clipped) && (
        <p className="section-subtitle" role="status">
          {outOfPlan ? 'Este período queda fuera de tu plan: ' : ''}
          Tu plan muestra los pedidos de los últimos {historyDays} días. <Link to="/suscripcion">Ver planes</Link>
        </p>
      )}

      <div className="page-toolbar__filters" role="group" aria-label="Qué pedidos ver">
        <button
          type="button"
          className={['filter-chip', !onlyCancelled ? 'filter-chip--active' : ''].join(' ')}
          aria-pressed={!onlyCancelled}
          onClick={() => setOnlyCancelled(false)}
        >
          Todos
        </button>
        <button
          type="button"
          className={['filter-chip', onlyCancelled ? 'filter-chip--active' : ''].join(' ')}
          aria-pressed={onlyCancelled}
          onClick={() => setOnlyCancelled(true)}
        >
          Cancelados{data ? ` (${data.cancelled})` : ''}
        </button>
      </div>

      {loading && !data ? (
        <PageLoading label="Cargando pedidos…" />
      ) : error ? (
        <PageError message={error} onRetry={reload} />
      ) : data ? (
        orders.length === 0 ? (
          <EmptyState title={onlyCancelled ? 'No hay pedidos cancelados en este período' : 'No hay pedidos en este período'} />
        ) : (
          <Card title={`Mostrando ${orders.length} de ${data.total} pedidos`}>
            <div className="data-table-wrapper">
              <table className="data-table report-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Pedido</th>
                    <th>Cliente</th>
                    <th>Productos</th>
                    <th>Pago</th>
                    <th className="report-table__num">Total</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const status = ORDER_STATUS_META[order.status]
                    const cancelled = order.status === 'cancelado'
                    return (
                      <tr key={order.id} className={cancelled ? 'order-history__row--cancelled' : undefined}>
                        <td>{dateFormat.format(new Date(order.createdAt))}</td>
                        <td>
                          <strong>{order.code}</strong>
                        </td>
                        <td>
                          {order.customerName}
                          {order.tableOrReference ? ` · ${order.tableOrReference}` : ''}
                        </td>
                        <td>{order.items.map((item) => `${item.quantity}× ${item.productName}`).join(', ')}</td>
                        <td>{PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}</td>
                        <td className="report-table__num order-history__total">{currency.format(order.total)}</td>
                        <td>
                          <Badge tone={status.tone}>{status.label}</Badge>
                          {cancelled && <CancellationDetail order={order} />}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {moreError && <div className="form-error-banner">{moreError}</div>}
            {orders.length < data.total && (
              <Button variant="secondary" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Cargando…' : 'Ver más'}
              </Button>
            )}
            <p className="section-subtitle">Los pedidos cancelados y los que siguen por confirmar no cuentan en los reportes de ventas.</p>
          </Card>
        )
      ) : null}
    </div>
  )
}
