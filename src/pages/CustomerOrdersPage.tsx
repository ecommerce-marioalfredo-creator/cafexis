import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { EmptyState } from '@/components/ui/EmptyState'
import { OrderCard } from '@/components/domain/OrderCard'
import { getPublicBusiness } from '@/services/api/publicBusinessService'
import { listMyOrders } from '@/services/api/publicOrdersService'
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

      {orders.length === 0 ? (
        <EmptyState title="Aún no has hecho ningún pedido aquí" />
      ) : (
        <div className="customer-orders__list">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </PublicLayout>
  )
}
