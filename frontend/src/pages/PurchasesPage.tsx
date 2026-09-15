import { usePurchaseOrders } from '@/hooks/usePurchaseOrders'
import { PurchaseOrderCard } from '@/components/domain/PurchaseOrderCard'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { EmptyState } from '@/components/ui/EmptyState'
import type { PurchaseOrder } from '@/types/domain'

export function PurchasesPage() {
  const { purchaseOrders, loading, error, reload, confirm } = usePurchaseOrders()

  if (loading) return <PageLoading label="Cargando órdenes de compra…" />
  if (error) return <PageError message={error} onRetry={reload} />

  const proposals = purchaseOrders.filter((o) => o.status === 'propuesta')
  const others = purchaseOrders.filter((o) => o.status !== 'propuesta')

  const handleConfirm = (id: string) => (lines: PurchaseOrder['lines']) => confirm(id, lines)

  return (
    <div className="section-stack">
      <section>
        <h3>Propuestas del sistema por revisar</h3>
        <p className="section-subtitle">
          Generadas automáticamente cuando un insumo está por agotarse. Puedes ajustar cantidades antes de confirmar.
        </p>
        {proposals.length === 0 ? (
          <EmptyState title="No hay propuestas pendientes" description="El inventario está en niveles saludables." />
        ) : (
          <div className="card-grid">
            {proposals.map((order) => (
              <PurchaseOrderCard key={order.id} order={order} onConfirm={handleConfirm(order.id)} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3>Historial de órdenes</h3>
        <div className="card-grid card-grid--spaced">
          {others.map((order) => (
            <PurchaseOrderCard key={order.id} order={order} />
          ))}
        </div>
      </section>
    </div>
  )
}
