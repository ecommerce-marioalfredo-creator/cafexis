import { Badge } from '@/components/ui/Badge'
import type { Order, OrderStatus } from '@/types/domain'
import './OrderCard.css'

const STATUS_LABEL: Record<OrderStatus, string> = {
  pedido: 'Pedido',
  en_preparacion: 'En preparación',
  listo: 'Listo',
  entregado: 'Entregado',
}

const PAYMENT_LABEL: Record<Order['paymentMethod'], string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  billetera_digital: 'Billetera digital',
  cripto: 'Cripto',
}

const currency = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

interface OrderCardProps {
  order: Order
  onAdvance?: (nextStatus: OrderStatus) => void
}

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pedido: 'en_preparacion',
  en_preparacion: 'listo',
  listo: 'entregado',
}

export function OrderCard({ order, onAdvance }: OrderCardProps) {
  const next = NEXT_STATUS[order.status]

  return (
    <article className="order-card">
      <header className="order-card__header">
        <strong>{order.code}</strong>
        <Badge tone={order.status === 'entregado' ? 'success' : 'info'}>{STATUS_LABEL[order.status]}</Badge>
      </header>
      <p className="order-card__customer">
        {order.customerName}
        {order.tableOrReference ? ` · ${order.tableOrReference}` : ''}
      </p>
      <ul className="order-card__items">
        {order.items.map((item) => (
          <li key={item.productId}>
            {item.quantity}× {item.productName}
          </li>
        ))}
      </ul>
      <footer className="order-card__footer">
        <span className="order-card__total">{currency.format(order.total)}</span>
        <span className="order-card__payment">{PAYMENT_LABEL[order.paymentMethod]}</span>
      </footer>
      {next && onAdvance && (
        <button className="order-card__advance" onClick={() => onAdvance(next)}>
          Marcar como “{STATUS_LABEL[next]}”
        </button>
      )}
    </article>
  )
}
