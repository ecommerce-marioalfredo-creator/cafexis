import { useDashboardData } from '@/hooks/useDashboardData'
import { MetricCard } from '@/components/ui/MetricCard'
import { Card } from '@/components/ui/Card'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { EmptyState } from '@/components/ui/EmptyState'

const currency = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

export function DashboardPage() {
  const { data, loading, error, reload } = useDashboardData()

  if (loading) return <PageLoading label="Cargando el resumen del negocio…" />
  if (error) return <PageError message={error} onRetry={reload} />
  if (!data) return null

  return (
    <div className="dashboard-page">
      <section className="dashboard-page__metrics">
        <MetricCard label="Ventas de hoy" value={currency.format(data.salesToday)} icon="💰" />
        <MetricCard label="Pedidos activos" value={String(data.activeOrders)} icon="🧾" />
        <MetricCard
          label="Alertas de inventario"
          value={String(data.lowStockAlerts)}
          tone={data.lowStockAlerts > 0 ? 'warning' : 'default'}
          icon="⚠️"
        />
      </section>

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
