import { useCallback } from 'react'
import { useAsync } from './useAsync'
import { listOrders, registerSale, updateOrderStatus } from '@/services/api/salesService'
import type { NewSaleInput, OrderStatus } from '@/types/domain'

export function useOrders() {
  const { data, loading, error, reload } = useAsync(listOrders, [])

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

  return { orders: data ?? [], loading, error, reload, setStatus, register }
}
