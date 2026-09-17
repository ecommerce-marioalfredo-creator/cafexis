import { supabase, getActiveBusinessId } from './supabaseClient'
import { mapOrder } from './mappers'
import type { Order, OrderStatus } from '@/types/domain'
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
