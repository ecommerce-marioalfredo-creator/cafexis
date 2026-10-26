import type { BadgeTone } from '@/components/ui/Badge'
import type { OrderStatus } from '@/types/domain'

/** Nombre y color de cada estado de pedido (tablero, historial del cliente y consola de soporte). */
export const ORDER_STATUS_META: Record<OrderStatus, { label: string; tone: BadgeTone }> = {
  pendiente_pago: { label: 'Pendiente de pago', tone: 'warning' },
  pedido: { label: 'Pedido', tone: 'info' },
  en_preparacion: { label: 'En preparación', tone: 'info' },
  listo: { label: 'Listo', tone: 'info' },
  entregado: { label: 'Entregado', tone: 'success' },
  cancelado: { label: 'Cancelado', tone: 'neutral' },
}

/** Siguiente paso al avanzar un pedido. 'pendiente_pago' avanza confirmando el cobro, no con este flujo. */
export const NEXT_ORDER_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pedido: 'en_preparacion',
  en_preparacion: 'listo',
  listo: 'entregado',
}

/** Se pueden cancelar mientras no se hayan entregado (0014_pedidos_y_permisos_por_rol_cafexis.sql). */
export const isCancellableOrderStatus = (status: OrderStatus) => status !== 'entregado' && status !== 'cancelado'
