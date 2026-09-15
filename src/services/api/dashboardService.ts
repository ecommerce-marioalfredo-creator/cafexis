import { delay } from './client'
import { orders, inventoryItems } from '@/services/mock/data'
import type { DashboardSummary } from '@/types/domain'

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const salesToday = orders.reduce((sum, o) => sum + o.total, 0)
  const activeOrders = orders.filter((o) => o.status === 'pedido' || o.status === 'en_preparacion' || o.status === 'listo').length
  const lowStockAlerts = inventoryItems.filter((i) => i.status !== 'ok').length

  const soldByProduct = new Map<string, number>()
  for (const order of orders) {
    for (const item of order.items) {
      soldByProduct.set(item.productName, (soldByProduct.get(item.productName) ?? 0) + item.quantity)
    }
  }
  const topProducts = Array.from(soldByProduct.entries())
    .map(([productName, unitsSold]) => ({ productName, unitsSold }))
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, 5)

  const inventoryAlerts = inventoryItems
    .filter((i) => i.status !== 'ok')
    .map((i) => ({ itemName: i.name, remaining: `${i.quantity} ${i.unit}` }))

  return delay({ salesToday, activeOrders, lowStockAlerts, topProducts, inventoryAlerts })
}
