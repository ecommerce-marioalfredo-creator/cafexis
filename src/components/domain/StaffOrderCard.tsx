import { useState } from 'react'
import { OrderCard } from './OrderCard'
import { ConfirmPaymentModal } from './ConfirmPaymentModal'
import { CancelOrderModal } from './CancelOrderModal'
import { isCancellableOrderStatus } from './orderStatus'
import type { Order, OrderStatus, PaymentMethod, RecipeIngredient } from '@/types/domain'

interface StaffOrderCardProps {
  order: Order
  setStatus: (orderId: string, status: OrderStatus) => Promise<void>
  confirmPayment: (orderId: string, paymentMethod: PaymentMethod) => Promise<void>
  cancel: (orderId: string, reason?: string) => Promise<void>
  recipesByProductId?: Record<string, RecipeIngredient[] | undefined>
  onGenerateInvoice?: () => void
  generatingInvoice?: boolean
}

/**
 * Comanda con las acciones del personal (avanzar, confirmar el pago, cancelar).
 * La misma tarjeta se usa en Ventas y en el dashboard, para que ambos se
 * comporten igual.
 */
export function StaffOrderCard({
  order,
  setStatus,
  confirmPayment,
  cancel,
  recipesByProductId,
  onGenerateInvoice,
  generatingInvoice,
}: StaffOrderCardProps) {
  const [paying, setPaying] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string>()

  const handleAdvance = async (next: OrderStatus) => {
    setError(undefined)
    try {
      await setStatus(order.id, next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el pedido.')
    }
  }

  return (
    <>
      <OrderCard
        order={order}
        onAdvance={handleAdvance}
        recipesByProductId={recipesByProductId}
        onConfirmPayment={() => setPaying(true)}
        onCancel={isCancellableOrderStatus(order.status) ? () => setCancelling(true) : undefined}
        onGenerateInvoice={onGenerateInvoice}
        generatingInvoice={generatingInvoice}
      />
      {error && <div className="form-error-banner">{error}</div>}
      {paying && (
        <ConfirmPaymentModal
          order={order}
          onConfirm={(method) => confirmPayment(order.id, method)}
          onClose={() => setPaying(false)}
        />
      )}
      {cancelling && (
        <CancelOrderModal
          order={order}
          audience="negocio"
          onCancel={(reason) => cancel(order.id, reason)}
          onClose={() => setCancelling(false)}
        />
      )}
    </>
  )
}
