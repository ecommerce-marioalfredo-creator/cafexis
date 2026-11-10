import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { usePlan } from '@/context/PlanContext'
import { SuperUserPanel } from '@/components/superuser/SuperUserPanel'
import { UpgradeNotice } from '@/components/plan/UpgradeNotice'
import { DASHBOARD_POLL_MS, useDashboardData } from '@/hooks/useDashboardData'
import { useCancellationAlerts } from '@/hooks/useCancellationAlerts'
import { useOrders } from '@/hooks/useOrders'
import { CancellationAlerts } from '@/components/domain/CancellationAlerts'
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

/**
 * key: el supervisor técnico puede cambiar de negocio sin salir de esta página.
 * Sin esto seguiría viendo las alertas y comandas del anterior hasta el siguiente refresco.
 *
 * El supervisor técnico (super usuario) tiene además la vista "Plataforma":
 * todos los negocios con su suscripción y sus usuarios, códigos de promoción
 * y planes (0021). Es la vista por defecto; ?vista=negocio muestra el
 * dashboard del negocio que está operando.
 */
export function DashboardPage() {
  const { user, business } = useAuth()
  const [params, setParams] = useSearchParams()

  if (user?.role !== 'supervisor_tecnico') return <DashboardContent key={business?.id} />

  const view = params.get('vista') === 'negocio' ? 'negocio' : 'plataforma'
  const views = [
    { id: 'plataforma', label: 'Plataforma (super usuario)' },
    { id: 'negocio', label: business ? `Negocio: ${business.name}` : 'Negocio' },
  ] as const

  return (
    <div className="su-dashboard">
      <div className="su-dashboard__switch">
        <div className="su-dashboard__segmented" role="tablist" aria-label="Vista del dashboard">
          {views.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={view === v.id}
              onClick={() => setParams(v.id === 'negocio' ? { vista: 'negocio' } : {}, { replace: true })}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
      {view === 'plataforma' ? <SuperUserPanel /> : <DashboardContent key={business?.id} />}
    </div>
  )
}

function DashboardContent() {
  const { data, loading, error, reload, refresh } = useDashboardData()
  const { orders, initialLoading: loadingOrders, error: ordersError, setStatus, confirmPayment, cancel } = useOrders(
    'hoy',
    DASHBOARD_POLL_MS,
  )
  const { alerts, failed: alertsFailed } = useCancellationAlerts()
  const { can } = usePlan()

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
      <CancellationAlerts alerts={alerts} failed={alertsFailed} />

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
          {!can('dashboard_mas_vendidos') ? (
            <UpgradeNotice feature="dashboard_mas_vendidos" />
          ) : data.topProducts.length === 0 ? (
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
