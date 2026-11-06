import { useDashboardData } from '@/hooks/useDashboardData'
import { useOrders } from '@/hooks/useOrders'
import { OrderCard } from '@/components/domain/OrderCard'
import { useStaffOrderActions } from '@/components/domain/useStaffOrderActions'
import { MetricCard } from '@/components/ui/MetricCard'
import { Card } from '@/components/ui/Card'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { EmptyState } from '@/components/ui/EmptyState'
import type { OrderStatus } from '@/types/domain'

const currency = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

/** Estados con trabajo pendiente, en el orden en que se atienden: lo que falta confirmar va primero. Los cancelados nunca aparecen aquí. */
const ACTIVE_STATUSES: OrderStatus[] = ['pendiente_pago', 'pedido', 'en_preparacion', 'listo']

export function DashboardPage() {
  const { data, loading, error, reload, refresh } = useDashboardData()
  const { orders, initialLoading: loadingOrders, error: ordersError, setStatus, confirmPayment, cancel } = useOrders()

  const activeOrders = ACTIVE_STATUSES.flatMap((status) => orders.filter((o) => o.status === status))

  // Cada acción sobre una comanda cambia las ventas del día, los activos y los más vendidos.
  const refreshingSummary = async (action: () => Promise<void>) => {
    try {
      await action()
    } finally {
      await refresh()
    }
  }

  const { cardProps, actionError, modals } = useStaffOrderActions({
    setStatus: (id, next) => refreshingSummary(() => setStatus(id, next)),
    confirmPayment: (id, method) => refreshingSummary(() => confirmPayment(id, method)),
    cancel: (id, reason) => refreshingSummary(() => cancel(id, reason)),
  })

  if (loading && !data) return <PageLoading label="Cargando el resumen del negocio…" />
  if (error) return <PageError message={error} onRetry={reload} />
  if (!data) return null

  return (
    <div className="dashboard-page">
      <section className="dashboard-page__metrics">
        <MetricCard label="Ventas de hoy" value={currency.format(data.salesToday)} icon="💰" />
        <MetricCard label="Pedidos activos" value={String(activeOrders.length)} icon="🧾" />
        <MetricCard
          label="Alertas de inventario"
          value={String(data.lowStockAlerts)}
          tone={data.lowStockAlerts > 0 ? 'warning' : 'default'}
          icon="⚠️"
        />
      </section>

      <Card title="Comandas activas">
        {ordersError && <div className="form-error-banner">{ordersError}</div>}
        {actionError && <div className="form-error-banner">{actionError}</div>}
        {loadingOrders ? (
          <PageLoading label="Cargando comandas…" />
        ) : activeOrders.length === 0 ? (
          <EmptyState title="No hay comandas activas" />
        ) : (
          <div className="dashboard-page__orders">
            {activeOrders.map((order) => (
              <OrderCard key={order.id} order={order} {...cardProps(order)} />
            ))}
          </div>
        )}
      </Card>
      {modals}

      <section className="dashboard-page__grid">
        <Card title="Bebidas y productos más vendidos">
          {data.topProducts.length === 0 ? (
            <EmptyState title="Aún no hay ventas registradas" />
          ) : (
            <ol className="dashboard-page__ranking">
              {data.topProducts.map((p) => (
                <li key={p.productName}>
                  <span>{p.productName}</span>
                  <strong>{p.unitsSold} und.</strong>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card title="Alertas de inventario">
          {data.inventoryAlerts.length === 0 ? (
            <EmptyState title="Todo el inventario está en niveles saludables" />
          ) : (
            <ul className="dashboard-page__alerts">
              {data.inventoryAlerts.map((a) => (
                <li key={a.itemName}>
                  <span>{a.itemName}</span>
                  <span className="dashboard-page__alerts-value">quedan {a.remaining}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  )
}
