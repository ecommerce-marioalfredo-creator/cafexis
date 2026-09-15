import { delay } from './client'
import { purchaseOrders as mockPurchaseOrders } from '@/services/mock/data'
import type { PurchaseOrder } from '@/types/domain'

const purchaseOrders: PurchaseOrder[] = [...mockPurchaseOrders]

export async function listPurchaseOrders(): Promise<PurchaseOrder[]> {
  return delay([...purchaseOrders].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)))
}

export async function confirmPurchaseOrder(id: string, lines: PurchaseOrder['lines']): Promise<PurchaseOrder> {
  const order = purchaseOrders.find((o) => o.id === id)
  if (!order) throw new Error(`Orden de compra ${id} no encontrada`)
  order.lines = lines
  order.status = 'confirmada'
  return delay(order, 150)
}
