import { supabase, getActiveBusinessId } from './supabaseClient'
import { mapOrder } from './mappers'
import type { NewSaleInput, Order, OrderStatus, PaymentMethod } from '@/types/domain'
import type { OrderRow } from '@/types/database'

const ORDER_SELECT = '*, order_items_cafexis(*)'
const BOARD_ORDER_SELECT = '*, order_items_cafexis(*), invoices_cafexis(*)'

/** Pedidos en curso: el tablero los muestra siempre, sin importar la fecha. */
const ACTIVE_ORDER_STATUSES: OrderStatus[] = ['pendiente_pago', 'pedido', 'en_preparacion', 'listo']
const CLOSED_ORDER_STATUSES: OrderStatus[] = ['entregado', 'cancelado']

/**
 * Máximo de pedidos entregados/cancelados que trae el tablero. PostgREST
 * corta cualquier consulta en 1000 filas sin avisar; el historial completo
 * está en Reportes.
 */
export const CLOSED_ORDERS_LIMIT = 300

/** Un pedido cuenta como venta cuando ya está cobrado y no se canceló. */
export const countsAsSale = (status: OrderStatus) => status !== 'pendiente_pago' && status !== 'cancelado'

export interface BoardOrders {
  orders: Order[]
  /** true si había más pedidos cerrados en el período de los que se trajeron. */
  closedTruncated: boolean
}

/**
 * Tablero de ventas: todos los pedidos en curso, más los entregados o
 * cancelados desde `closedSince` (por su último cambio, es decir, cuándo se
 * entregaron o cancelaron). Antes se traía el historial completo del negocio.
 */
export async function listBoardOrders(closedSince: Date): Promise<BoardOrders> {
  const businessId = await getActiveBusinessId()

  const [active, closed] = await Promise.all([
    supabase
      .from('orders_cafexis')
      .select(BOARD_ORDER_SELECT)
      .eq('business_id', businessId)
      .in('status', ACTIVE_ORDER_STATUSES)
      .order('created_at', { ascending: false })
      .returns<OrderRow[]>(),
    supabase
      .from('orders_cafexis')
      .select(BOARD_ORDER_SELECT)
      .eq('business_id', businessId)
      .in('status', CLOSED_ORDER_STATUSES)
      .gte('updated_at', closedSince.toISOString())
      .order('updated_at', { ascending: false })
      .limit(CLOSED_ORDERS_LIMIT)
      .returns<OrderRow[]>(),
  ])

  if (active.error) throw new Error(active.error.message)
  if (closed.error) throw new Error(closed.error.message)

  const closedRows = closed.data ?? []
  return {
    orders: [...(active.data ?? []), ...closedRows].map(mapOrder),
    closedTruncated: closedRows.length === CLOSED_ORDERS_LIMIT,
  }
}

/**
 * Registra una venta del punto de venta con la RPC register_sale_cafexis
 * (ver 0006_fase2_operacion_diaria_cafexis.sql y 0014): crea pedido + líneas
 * en una sola transacción con los precios de la base de datos, y el trigger
 * de order_items descuenta receta o lote. Si falta stock, la venta completa
 * se revierte y el mensaje de error de Postgres llega tal cual.
 */
export async function registerSale(input: NewSaleInput): Promise<Order> {
  // Negocio activo explícito: para el supervisor técnico puede ser otro
  // negocio que eligió en el selector (ver 0008_supervisor_rpc_negocio_cafexis.sql).
  const businessId = await getActiveBusinessId()

  const { data: orderId, error } = await supabase.rpc('register_sale_cafexis', {
    p_items: input.items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
    p_payment_method: input.paymentMethod,
    p_table_or_reference: input.tableOrReference ?? null,
    p_customer_name: input.customerName ?? null,
    p_business_id: businessId,
  })
  if (error || !orderId) throw new Error(error?.message ?? 'No se pudo registrar la venta.')

  const { data, error: fetchError } = await supabase
    .from('orders_cafexis')
    .select(ORDER_SELECT)
    .eq('id', orderId as string)
    .single<OrderRow>()

  if (fetchError || !data) throw new Error(fetchError?.message ?? 'La venta se registró pero no se pudo leer.')
  return mapOrder(data)
}

/** Avanza un pedido al siguiente estado (la base de datos valida la transición). */
export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
  const { data, error } = await supabase
    .from('orders_cafexis')
    .update({ status })
    .eq('id', orderId)
    .select(ORDER_SELECT)
    .single<OrderRow>()

  if (error || !data) throw new Error(error?.message ?? `Pedido ${orderId} no encontrado`)
  return mapOrder(data)
}

/** El cliente pagó en caja un pedido "pendiente de pago": pasa a "pedido" para prepararlo. */
export async function confirmOrderPayment(orderId: string, paymentMethod: PaymentMethod): Promise<void> {
  const { error } = await supabase.rpc('confirm_order_payment_cafexis', {
    p_order_id: orderId,
    p_payment_method: paymentMethod,
  })
  if (error) throw new Error(error.message)
}

/** Cancela un pedido no entregado y repone el inventario que descontó (solo administrador o supervisor). */
export async function cancelOrder(orderId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_order_cafexis', {
    p_order_id: orderId,
    p_reason: reason?.trim() || null,
  })
  if (error) throw new Error(error.message)
}
