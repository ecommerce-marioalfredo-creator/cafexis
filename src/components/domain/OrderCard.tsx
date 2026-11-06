import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { PAYMENT_LABEL, currency } from './paymentMethods'
import type { Order, OrderStatus, RecipeIngredient } from '@/types/domain'
import './OrderCard.css'

const STATUS_LABEL: Record<OrderStatus, string> = {
  pendiente_pago: 'Por confirmar',
  pedido: 'Pedido',
  en_preparacion: 'En preparación',
  listo: 'Listo',
  entregado: 'Entregado',
}

interface OrderCardProps {
  order: Order
  onAdvance?: (nextStatus: OrderStatus) => void
  /** Receta de cada producto (por id), para mostrarla bajo cada línea del pedido — clave para que quien prepare la bebida sepa qué lleva. */
  recipesByProductId?: Record<string, RecipeIngredient[] | undefined>
  /** Solo en el panel interno (administrador/supervisor), y solo sobre pedidos entregados — ver OrderCard.tsx y SalesPage.tsx (Fase 6). */
  onGenerateInvoice?: () => void
}

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pendiente_pago: 'en_preparacion',
  pedido: 'en_preparacion',
  en_preparacion: 'listo',
  listo: 'entregado',
}

function badgeTone(status: OrderStatus): BadgeTone {
  if (status === 'entregado') return 'success'
  if (status === 'pendiente_pago') return 'warning'
  return 'info'
}

export function OrderCard({ order, onAdvance, recipesByProductId, onGenerateInvoice }: OrderCardProps) {
  const next = NEXT_STATUS[order.status]

  return (
    <article className="order-card">
      <header className="order-card__header">
        <strong>{order.code}</strong>
        <Badge tone={badgeTone(order.status)}>{STATUS_LABEL[order.status]}</Badge>
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
        <span className="order-card__payment">Pago: {PAYMENT_LABEL[order.paymentMethod]}</span>
      </footer>
      {next && onAdvance && (
        <button className="order-card__advance" onClick={() => onAdvance(next)}>
          {next === 'en_preparacion' ? 'Confirmar y pasar a preparación' : `Marcar como “${STATUS_LABEL[next]}”`}
        </button>
      )}
      {order.status === 'entregado' && onGenerateInvoice && (
        <button className="order-card__invoice" onClick={onGenerateInvoice}>
          Generar factura
        </button>
      )}
    </article>
  )
}
