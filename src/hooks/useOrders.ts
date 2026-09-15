import { useCallback } from 'react'
import { useAsync } from './useAsync'
import { listOrders, updateOrderStatus } from '@/services/api/salesService'
import type { OrderStatus } from '@/types/domain'

export function useOrders() {
  const { data, loading, error, reload } = useAsync(listOrders, [])

  const setStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      await updateOrderStatus(orderId, status)
      reload()
    },
    [reload],
  )

  return { orders: data ?? [], loading, error, reload, setStatus }
}
