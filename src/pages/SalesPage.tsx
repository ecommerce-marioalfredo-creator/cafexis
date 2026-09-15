import { useOrders } from '@/hooks/useOrders'
import { OrderCard } from '@/components/domain/OrderCard'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { EmptyState } from '@/components/ui/EmptyState'
import type { OrderStatus } from '@/types/domain'

/**
 * El alcance inicial contempla "pedido" y "entregado"; se incorporan aquí
 * "en preparación" y "listo" como columnas intermedias, ya anticipadas en
 * el Design System (sección 13) como ampliación futura del mismo esquema.
 */
const COLUMNS: Array<{ status: OrderStatus; title: string }> = [
  { status: 'pedido', title: 'Pedido' },
  { status: 'en_preparacion', title: 'En preparación' },
  { status: 'listo', title: 'Listo' },
  { status: 'entregado', title: 'Entregado' },
]

export function SalesPage() {
  const { orders, loading, error, reload, setStatus } = useOrders()

  if (loading) return <PageLoading label="Cargando pedidos…" />
  if (error) return <PageError message={error} onRetry={reload} />

  return (
    <div className="orders-board">
      {COLUMNS.map((column) => {
        const columnOrders = orders.filter((o) => o.status === column.status)
        return (
          <div className="orders-board__column" key={column.status}>
            <span className="orders-board__column-title">
              {column.title} ({columnOrders.length})
            </span>
            {columnOrders.length === 0 && <EmptyState title="Sin pedidos aquí" />}
            {columnOrders.map((order) => (
              <OrderCard key={order.id} order={order} onAdvance={(next) => setStatus(order.id, next)} />
            ))}
          </div>
        )
      })}
    </div>
  )
}
