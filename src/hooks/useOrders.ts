import { useCallback } from 'react'
import { useAsync } from './useAsync'
import { cancelOrder, confirmOrderPayment, listBoardOrders, registerSale, updateOrderStatus } from '@/services/api/salesService'
import type { NewSaleInput, OrderStatus, PaymentMethod } from '@/types/domain'

/** Desde cuándo mostrar los pedidos ya entregados o cancelados en el tablero. */
export type ClosedOrdersPeriod = 'hoy' | '7_dias' | '30_dias'

function periodStart(period: ClosedOrdersPeriod): Date {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  if (period === '7_dias') start.setDate(start.getDate() - 6)
  if (period === '30_dias') start.setDate(start.getDate() - 29)
  return start
}

export function useOrders(period: ClosedOrdersPeriod = 'hoy') {
  const { data, loading, error, reload } = useAsync(() => listBoardOrders(periodStart(period)), [period])

  const setStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      await updateOrderStatus(orderId, status)
      reload()
    },
    [reload],
  )

  const register = useCallback(
    async (input: NewSaleInput) => {
      const order = await registerSale(input)
      reload()
      return order
    },
    [reload],
  )

  const confirmPayment = useCallback(
    async (orderId: string, paymentMethod: PaymentMethod) => {
      await confirmOrderPayment(orderId, paymentMethod)
      reload()
    },
    [reload],
  )

  const cancel = useCallback(
    async (orderId: string, reason?: string) => {
      await cancelOrder(orderId, reason)
      reload()
    },
    [reload],
  )

  return {
    orders: data?.orders ?? [],
    closedTruncated: data?.closedTruncated ?? false,
    // Solo la primera carga bloquea la pantalla; al recargar se siguen viendo los pedidos.
    initialLoading: loading && data === undefined,
    error,
    reload,
    setStatus,
    register,
    confirmPayment,
    cancel,
  }
}
