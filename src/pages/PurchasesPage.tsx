import { useState } from 'react'
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders'
import { useSuppliers } from '@/hooks/useSuppliers'
import { useInventory } from '@/hooks/useInventory'
import { PurchaseOrderCard } from '@/components/domain/PurchaseOrderCard'
import { PurchaseOrderModal } from '@/components/domain/PurchaseOrderModal'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'

export function PurchasesPage() {
  const { purchaseOrders, loading, error, reload, generateProposals, create, confirm, receive, cancel } =
    usePurchaseOrders()
  const { suppliers } = useSuppliers()
  const { items: inventoryItems, reload: reloadInventory } = useInventory()
  const [modalOpen, setModalOpen] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [reviewMessage, setReviewMessage] = useState<string>()

  if (loading) return <PageLoading label="Cargando órdenes de compra…" />
  if (error) return <PageError message={error} onRetry={reload} />

  const proposals = purchaseOrders.filter((o) => o.status === 'propuesta')
  const pending = purchaseOrders.filter((o) => o.status === 'confirmada')
  const history = purchaseOrders.filter((o) => o.status === 'recibida' || o.status === 'cancelada')

  const handleReview = async () => {
    setReviewing(true)
    setReviewMessage(undefined)
    try {
      const added = await generateProposals()
      setReviewMessage(
        added === 0
          ? 'No hay insumos nuevos por debajo del umbral: todo lo bajo ya está en una orden abierta.'
          : `Se agregaron ${added} insumo${added === 1 ? '' : 's'} a las propuestas.`,
      )
    } catch (err) {
      setReviewMessage(err instanceof Error ? err.message : 'No se pudo revisar el inventario.')
    } finally {
      setReviewing(false)
    }
  }

  const handleReceive = (id: string) => async () => {
    await receive(id)
    reloadInventory()
  }

  return (
    <div className="section-stack">
      <div className="page-toolbar">
        <p className="section-subtitle">
          Cuando un insumo baja de su umbral, el sistema propone una compra a su proveedor preferido. Al recibir una
          orden, las cantidades se suman al inventario.
        </p>
        <div className="page-toolbar__filters">
          <Button variant="secondary" onClick={handleReview} disabled={reviewing}>
            {reviewing ? 'Revisando…' : 'Revisar inventario'}
          </Button>
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            Nueva orden de compra
          </Button>
        </div>
      </div>

      {reviewMessage && <p className="section-subtitle">{reviewMessage}</p>}

      <section>
        <h3>Propuestas del sistema por revisar</h3>
        <p className="section-subtitle">
          Generadas automáticamente cuando un insumo está por agotarse. Ajusta proveedor y cantidades antes de confirmar.
        </p>
        {proposals.length === 0 ? (
          <EmptyState title="No hay propuestas pendientes" description="El inventario está en niveles saludables." />
        ) : (
          <div className="card-grid">
            {proposals.map((order) => (
              <PurchaseOrderCard
                // La clave incluye las líneas: si "Revisar inventario" agrega un insumo, la tarjeta se reinicia con él.
                key={`${order.id}:${order.lines.map((l) => l.inventoryItemId).join(',')}`}
                order={order}
                suppliers={suppliers}
                onConfirm={(supplierId, lines) => confirm(order.id, supplierId, lines)}
                onCancel={() => cancel(order.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3>Confirmadas, por recibir</h3>
        {pending.length === 0 ? (
          <EmptyState title="No hay órdenes por recibir" />
        ) : (
          <div className="card-grid card-grid--spaced">
            {pending.map((order) => (
              <PurchaseOrderCard
                key={order.id}
                order={order}
                onReceive={handleReceive(order.id)}
                onCancel={() => cancel(order.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3>Historial</h3>
        {history.length === 0 ? (
          <EmptyState title="Aún no hay órdenes recibidas o canceladas" />
        ) : (
          <div className="card-grid card-grid--spaced">
            {history.map((order) => (
              <PurchaseOrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </section>

      {modalOpen && (
        <PurchaseOrderModal
          suppliers={suppliers}
          inventoryItems={inventoryItems}
          onSave={create}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}
