import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { EmptyState } from '@/components/ui/EmptyState'
import { OrderCard } from '@/components/domain/OrderCard'
import { getPublicBusiness } from '@/services/api/publicBusinessService'
import { listMyOrders } from '@/services/api/publicOrdersService'
import { createPaymentLink } from '@/services/api/paymentService'
import type { PublicBusiness, Order } from '@/types/domain'
import './CustomerOrdersPage.css'

/**
 * Historial y estado de los pedidos del cliente en un negocio (/c/:slug/pedidos).
 * Reutiliza OrderCard.tsx en modo solo lectura (sin onAdvance, ya opcional).
 */
export function CustomerOrdersPage() {
  const { slug } = useParams()
  const [business, setBusiness] = useState<PublicBusiness>()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [payingOrderId, setPayingOrderId] = useState<string>()
  const [payError, setPayError] = useState<string>()

  const load = () => {
    if (!slug) return
    setLoading(true)
    setError(undefined)
    getPublicBusiness(slug)
      .then(async (b) => {
        setBusiness(b)
        if (b) setOrders(await listMyOrders(b.id))
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudieron cargar tus pedidos.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [slug])

  const handleRetryPayment = async (orderId: string) => {
    setPayError(undefined)
    setPayingOrderId(orderId)
    try {
      const checkoutUrl = await createPaymentLink(orderId)
      window.location.href = checkoutUrl
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'No se pudo iniciar el pago.')
      setPayingOrderId(undefined)
    }
  }

  if (loading) return <PageLoading label="Cargando tus pedidos…" />
  if (error) return <PageError message={error} onRetry={load} />
  if (!business) {
    return (
      <PublicLayout>
        <EmptyState title="Este negocio no existe" />
      </PublicLayout>
    )
  }

  return (
    <PublicLayout business={business}>
      <h1 className="customer-orders__title">Mis pedidos en {business.name}</h1>

      {payError && <div className="form-error-banner">{payError}</div>}

      {orders.length === 0 ? (
        <EmptyState title="Aún no has hecho ningún pedido aquí" />
      ) : (
        <div className="customer-orders__list">
          {orders.map((order) => {
            const pending = order.status === 'pendiente_pago'
            // En efectivo se paga en caja y el negocio confirma el cobro: no hay checkout en línea.
            const payAtCounter = pending && order.paymentMethod === 'efectivo'
            return (
              <OrderCard
                key={order.id}
                order={order}
                notice={payAtCounter ? 'Paga en caja: lo preparan en cuanto el negocio confirme tu pago.' : undefined}
                onRetryPayment={
                  pending && !payAtCounter && payingOrderId !== order.id ? () => handleRetryPayment(order.id) : undefined
                }
              />
            )
          })}
        </div>
      )}
    </PublicLayout>
  )
}
