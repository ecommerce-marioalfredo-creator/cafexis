import { supabase, getActiveBusinessId } from './supabaseClient'
import { mapOrder } from './mappers'
import type { NewSaleInput, Order, OrderStatus } from '@/types/domain'
import type { OrderRow } from '@/types/database'

const ORDER_SELECT = '*, order_items_cafexis(*)'

export async function listOrders(): Promise<Order[]> {
  const businessId = await getActiveBusinessId()

  const { data, error } = await supabase
    .from('orders_cafexis')
    .select(ORDER_SELECT)
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .returns<OrderRow[]>()

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapOrder)
}

/**
 * Registra una venta del punto de venta con la RPC register_sale_cafexis
 * (ver 0006_fase2_operacion_diaria_cafexis.sql): crea pedido + líneas en una
 * sola transacción con los precios de la base de datos, y el trigger de
 * order_items descuenta receta o lote. Si falta stock, la venta completa se
 * revierte y el mensaje de error de Postgres llega tal cual.
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
