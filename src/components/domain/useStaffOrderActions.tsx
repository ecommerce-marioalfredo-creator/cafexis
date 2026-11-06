import { useState } from 'react'
import { ConfirmPaymentModal } from './ConfirmPaymentModal'
import { CancelOrderModal } from './CancelOrderModal'
import { isCancellableOrderStatus } from './orderStatus'
import type { Order, OrderStatus, PaymentMethod } from '@/types/domain'

interface StaffOrderActionsInput {
  setStatus: (orderId: string, status: OrderStatus) => Promise<void>
  confirmPayment: (orderId: string, paymentMethod: PaymentMethod) => Promise<void>
  cancel: (orderId: string, reason?: string) => Promise<void>
}

/**
 * Acciones del personal sobre una comanda (avanzar, confirmar el pago, cancelar),
 * iguales en Ventas y en el dashboard.
 *
 * Las ventanas y el error viven en la página, no en la tarjeta: al fallar una
 * acción el tablero se actualiza, y si otra persona ya canceló el pedido su
 * tarjeta desaparece. El mensaje de por qué falló debe seguir a la vista.
 */
export function useStaffOrderActions({ setStatus, confirmPayment, cancel }: StaffOrderActionsInput) {
  const [payingOrder, setPayingOrder] = useState<Order>()
  const [cancellingOrder, setCancellingOrder] = useState<Order>()
  const [actionError, setActionError] = useState<string>()

  const handleAdvance = async (orderId: string, next: OrderStatus) => {
    setActionError(undefined)
    try {
      await setStatus(orderId, next)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo actualizar el pedido.')
    }
  }

  /** Props de OrderCard para las acciones del personal sobre este pedido. */
  const cardProps = (order: Order) => ({
    onAdvance: (next: OrderStatus) => handleAdvance(order.id, next),
    onConfirmPayment: () => setPayingOrder(order),
    onCancel: isCancellableOrderStatus(order.status) ? () => setCancellingOrder(order) : undefined,
  })

  const modals = (
    <>
      {payingOrder && (
        <ConfirmPaymentModal
          order={payingOrder}
          onConfirm={(method) => confirmPayment(payingOrder.id, method)}
          onClose={() => setPayingOrder(undefined)}
        />
      )}
      {cancellingOrder && (
        <CancelOrderModal
          order={cancellingOrder}
          audience="negocio"
          onCancel={(reason) => cancel(cancellingOrder.id, reason)}
          onClose={() => setCancellingOrder(undefined)}
        />
      )}
    </>
  )

  return { cardProps, actionError, modals }
}
