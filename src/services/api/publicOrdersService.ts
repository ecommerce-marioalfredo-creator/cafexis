/**
 * Pedidos del cliente final: registrar uno nuevo desde el catálogo público
 * y consultar su propio historial.
 *
 * El registro es la RPC register_public_order_cafexis (security definer,
 * ver 0010_fase5_cliente_final_cafexis.sql, recreada en
 * 0012_fase6_integraciones_cafexis.sql) — igual que registerSale en
 * salesService.ts, los precios los toma la base de datos, nunca el cliente.
 * Desde la Fase 6, el pedido nace en 'pendiente_pago' (no 'pedido'): el
 * llamador debe encadenar paymentService.createPaymentLink(orderId) con el
 * id devuelto para llevar al cliente al checkout de Wompi; el pedido solo
 * pasa a 'pedido' cuando el webhook confirma el cobro.
 *
 * El historial sí se lee con un select directo (no con la RPC
 * list_my_orders_cafexis, que solo devuelve orders_cafexis sin sus líneas):
 * la policy orders_cafexis_customer_select (0010) ya deja al cliente leer
 * sus propios pedidos con el mismo ORDER_SELECT anidado que usa
 * el tablero de salesService, así el pedido llega completo con sus items.
 */
import { supabase } from './supabaseClient'
import { mapOrder } from './mappers'
import type { NewPublicOrderInput, Order } from '@/types/domain'
import type { OrderRow } from '@/types/database'

const ORDER_SELECT = '*, order_items_cafexis(*)'

export async function registerPublicOrder(input: NewPublicOrderInput): Promise<string> {
  const { data, error } = await supabase.rpc('register_public_order_cafexis', {
    p_business_id: input.businessId,
    p_items: input.items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
    p_payment_method: input.paymentMethod,
    p_table_or_reference: input.tableOrReference ?? null,
  })
  if (error || !data) throw new Error(error?.message ?? 'No se pudo registrar el pedido.')
  return data as string
}

export async function listMyOrders(businessId: string): Promise<Order[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Debes iniciar sesión.')

  const { data, error } = await supabase
    .from('orders_cafexis')
    .select(ORDER_SELECT)
    .eq('business_id', businessId)
    .eq('customer_id', session.user.id)
    .order('created_at', { ascending: false })
    .returns<OrderRow[]>()

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapOrder)
}
