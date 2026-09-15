import { delay } from './client'
import { orders as mockOrders } from '@/services/mock/data'
import type { Order, OrderStatus } from '@/types/domain'

// Copia mutable en memoria: simula persistencia mientras no exista backend.
const orders: Order[] = [...mockOrders]

export async function listOrders(): Promise<Order[]> {
  return delay([...orders].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)))
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
  const order = orders.find((o) => o.id === orderId)
  if (!order) throw new Error(`Pedido ${orderId} no encontrado`)
  order.status = status
  return delay(order, 150)
}
