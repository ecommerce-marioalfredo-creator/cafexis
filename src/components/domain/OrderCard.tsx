import { Link } from 'react-router-dom'
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
  /** Panel interno: productos con video o PDF de preparación; cada línea enlaza a /preparacion?producto=<id>. */
  guideProductIds?: ReadonlySet<string>
  /** Solo en el panel interno (administrador/supervisor), y solo sobre pedidos entregados (Fase 6). */
  onGenerateInvoice?: () => void
  /** Mientras se emite la factura de este pedido. */
  generatingInvoice?: boolean
  /** Panel interno: confirmar que el cliente pagó un pedido por confirmar. */
  onConfirmPayment?: () => void
  /** Cancelar el pedido: el personal, o el cliente mientras no se esté preparando. */
  onCancel?: () => void
  /** Aviso corto bajo el pedido (por ejemplo, "Paga en caja"). */
  notice?: string
}

export function OrderCard({
  order,
  onAdvance,
  recipesByProductId,
  guideProductIds,
  onGenerateInvoice,
  generatingInvoice,
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
              {guideProductIds?.has(item.productId) && (
                <Link className="order-card__guide-link" to={`/preparacion?producto=${item.productId}`}>
                  🎬 Cómo se prepara
                </Link>
              )}
            </li>
          )
        })}
      </ul>
      <footer className="order-card__footer">
        <span className="order-card__total">{currency.format(order.total)}</span>
        <span className="order-card__payment">Pago: {PAYMENT_LABEL[order.paymentMethod]}</span>
      </footer>

      {order.status === 'cancelado' && order.cancelledBySide && (
        <p className="order-card__notice">
          {order.cancelledBySide === 'cliente' ? 'Cancelaste este pedido.' : 'El negocio canceló este pedido.'}
        </p>
      )}
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
          Confirmar y pasar a preparación
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
