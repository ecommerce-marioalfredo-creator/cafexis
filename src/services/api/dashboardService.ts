import { supabase, getActiveBusinessId } from './supabaseClient'
import type { DashboardSummary } from '@/types/domain'
import type { OrderRow, InventoryItemRow } from '@/types/database'

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const businessId = await getActiveBusinessId()

  const [ordersResult, inventoryResult] = await Promise.all([
    supabase
      .from('orders_cafexis')
      .select('*, order_items_cafexis(*)')
      .eq('business_id', businessId)
      .returns<OrderRow[]>(),
    supabase.from('inventory_items_cafexis').select('*').eq('business_id', businessId).returns<InventoryItemRow[]>(),
  ])

  if (ordersResult.error) throw new Error(ordersResult.error.message)
  if (inventoryResult.error) throw new Error(inventoryResult.error.message)

  const orders = ordersResult.data ?? []
  const inventoryItems = inventoryResult.data ?? []

  const salesToday = orders.reduce((sum, o) => sum + Number(o.total), 0)
  const activeOrders = orders.filter((o) => o.status === 'pedido' || o.status === 'en_preparacion' || o.status === 'listo').length
  const lowStockAlerts = inventoryItems.filter((i) => i.status !== 'ok').length

  const soldByProduct = new Map<string, number>()
  for (const order of orders) {
    for (const item of order.order_items_cafexis ?? []) {
      soldByProduct.set(item.product_name, (soldByProduct.get(item.product_name) ?? 0) + Number(item.quantity))
    }
  }
  const topProducts = Array.from(soldByProduct.entries())
    .map(([productName, unitsSold]) => ({ productName, unitsSold }))
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, 5)

  const inventoryAlerts = inventoryItems
    .filter((i) => i.status !== 'ok')
    .map((i) => ({ itemName: i.name, remaining: `${i.quantity} ${i.unit}` }))

  return { salesToday, activeOrders, lowStockAlerts, topProducts, inventoryAlerts }
}
