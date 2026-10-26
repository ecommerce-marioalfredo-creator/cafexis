import { Badge } from '@/components/ui/Badge'
import { PAYMENT_LABEL, currency } from './paymentMethods'
import { NEXT_ORDER_STATUS, ORDER_STATUS_META } from './orderStatus'
import type { Order, OrderStatus, RecipeIngredient } from '@/types/domain'
import './OrderCard.css'

interface OrderCardProps {
  order: Order
  onAdvance?: (nextStatus: OrderStatus) => void
  /** Receta de cada producto (por id), para mostrarla bajo cada línea del pedido — clave para que quien prepare la bebida sepa qué lleva. */
  recipesByProductId?: Record<string, RecipeIngredient[] | undefined>
  /** Solo en el panel interno (administrador/supervisor), y solo sobre pedidos entregados (Fase 6). */
  onGenerateInvoice?: () => void
  /** Mientras se emite la factura de este pedido. */
  generatingInvoice?: boolean
  /** Solo en el historial del cliente final, y solo sobre pedidos pendientes de pago — reintenta el checkout de Wompi (Fase 6). */
  onRetryPayment?: () => void
  /** Panel interno: el cliente pagó en caja un pedido pendiente de pago. */
  onConfirmPayment?: () => void
  /** Panel interno (administrador/supervisor): cancelar un pedido no entregado. */
  onCancel?: () => void
  /** Aviso corto bajo el pedido (por ejemplo, "Paga en caja"). */
  notice?: string
}

export function OrderCard({
  order,
  onAdvance,
  recipesByProductId,
  onGenerateInvoice,
  generatingInvoice,
  onRetryPayment,
  onConfirmPayment,
  onCancel,
  notice,
}: OrderCardProps) {
  const next = NEXT_ORDER_STATUS[order.status]
  const status = ORDER_STATUS_META[order.status]
  const invoice = order.invoice

  return (
    <article className={['order-card', order.status === 'cancelado' ? 'order-card--cancelled' : ''].join(' ')}>
      <header className="order-card__header">
        <strong>{order.code}</strong>
        <Badge tone={status.tone}>{status.label}</Badge>
      </header>
      <p className="order-card__customer">
        {order.customerName}
        {order.tableOrReference ? ` · ${order.tableOrReference}` : ''}
      </p>
      <ul className="order-card__items">
        {order.items.map((item, index) => {
          const recipe = recipesByProductId?.[item.productId]
          return (
            <li key={`${item.productId}-${index}`}>
              <span className="order-card__item-line">
                {item.quantity}× {item.productName}
              </span>
              {recipe && recipe.length > 0 && (
                <ul className="order-card__recipe">
                  {recipe.map((ingredient) => (
                    <li key={ingredient.inventoryItemId}>
                      {ingredient.inventoryItemName} · {ingredient.quantity} {ingredient.unit}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
      <footer className="order-card__footer">
        <span className="order-card__total">{currency.format(order.total)}</span>
        <span className="order-card__payment">{PAYMENT_LABEL[order.paymentMethod]}</span>
      </footer>

      {order.status === 'cancelado' && order.cancellationReason && (
        <p className="order-card__notice">Motivo: {order.cancellationReason}</p>
      )}
      {notice && <p className="order-card__notice">{notice}</p>}

      {next && onAdvance && (
        <button className="order-card__advance" onClick={() => onAdvance(next)}>
          Marcar como “{ORDER_STATUS_META[next].label}”
        </button>
      )}
      {order.status === 'pendiente_pago' && onConfirmPayment && (
        <button className="order-card__advance" onClick={onConfirmPayment}>
          Confirmar pago recibido
        </button>
      )}
      {order.status === 'pendiente_pago' && onRetryPayment && (
        <button className="order-card__advance" onClick={onRetryPayment}>
          Pagar ahora
        </button>
      )}

      {order.status === 'entregado' && invoice?.status === 'emitida' && (
        <p className="order-card__invoice-status order-card__invoice-status--ok">
          Factura electrónica emitida
          {invoice.pdfUrl && (
            <>
              {' · '}
              <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer">
                Ver PDF
              </a>
            </>
          )}
        </p>
      )}
      {order.status === 'entregado' && invoice?.status === 'error' && (
        <p className="order-card__invoice-status order-card__invoice-status--error">
          No se pudo emitir la factura{invoice.errorMessage ? `: ${invoice.errorMessage}` : '.'}
        </p>
      )}
      {order.status === 'entregado' && onGenerateInvoice && invoice?.status !== 'emitida' && (
        <button className="order-card__invoice" onClick={onGenerateInvoice} disabled={generatingInvoice}>
          {generatingInvoice ? 'Generando factura…' : invoice ? 'Reintentar factura' : 'Generar factura'}
        </button>
      )}

      {onCancel && (
        <button className="order-card__cancel" onClick={onCancel}>
          Cancelar pedido
        </button>
      )}
    </article>
  )
}
