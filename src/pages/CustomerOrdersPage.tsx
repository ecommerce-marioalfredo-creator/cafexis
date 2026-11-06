import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { EmptyState } from '@/components/ui/EmptyState'
import { OrderCard } from '@/components/domain/OrderCard'
import { CancelOrderModal } from '@/components/domain/CancelOrderModal'
import { isCancellableByCustomer } from '@/components/domain/orderStatus'
import { useAsync } from '@/hooks/useAsync'
import { ORDERS_POLL_MS } from '@/hooks/useOrders'
import { getPublicBusiness } from '@/services/api/publicBusinessService'
import { listMyOrders } from '@/services/api/publicOrdersService'
import { cancelOrder } from '@/services/api/salesService'
import type { Order } from '@/types/domain'
import './CustomerOrdersPage.css'

/**
 * Historial y estado de los pedidos del cliente en un negocio (/c/:slug/pedidos),
 * incluidos los cancelados. Se actualiza solo: el negocio puede confirmar o
 * cancelar un pedido mientras el cliente tiene esta pantalla abierta.
 */
export function CustomerOrdersPage() {
  const { slug } = useParams()
  const [cancellingOrder, setCancellingOrder] = useState<Order>()

  const { data, loading, error, reload, refresh } = useAsync(
    async () => {
      const business = slug ? await getPublicBusiness(slug) : undefined
      return { business, orders: business ? await listMyOrders(business.id) : [] }
    },
    [slug],
    { pollMs: ORDERS_POLL_MS },
  )

  if (loading && !data) return <PageLoading label="Cargando tus pedidos…" />
  if (error) return <PageError message={error} onRetry={reload} />
  if (!data?.business) {
    return (
      <PublicLayout>
        <EmptyState title="Este negocio no existe" />
      </PublicLayout>
    )
  }

  const { business, orders } = data

  return (
    <PublicLayout business={business}>
      <h1 className="customer-orders__title">Mis pedidos en {business.name}</h1>

      {orders.length === 0 ? (
        <EmptyState title="Aún no has hecho ningún pedido aquí" />
      ) : (
        <div className="customer-orders__list">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              notice={
                order.status === 'pendiente_pago' ? 'El negocio confirmará tu pedido y empezará a prepararlo.' : undefined
              }
              onCancel={isCancellableByCustomer(order.status) ? () => setCancellingOrder(order) : undefined}
            />
          ))}
        </div>
      )}

      {cancellingOrder && (
        <CancelOrderModal
          order={cancellingOrder}
          audience="cliente"
          onCancel={async (reason) => {
            try {
              await cancelOrder(cancellingOrder.id, reason)
            } finally {
              // También si falla: el negocio pudo haber empezado a prepararlo.
              await refresh()
            }
          }}
          onClose={() => setCancellingOrder(undefined)}
        />
      )}
    </PublicLayout>
  )
}
