import { useCallback, useState } from 'react'
import { useAsync } from './useAsync'
import { listOrders, registerSale, updateOrderStatus } from '@/services/api/salesService'
import type { NewSaleInput, OrderStatus } from '@/types/domain'

/** Los pedidos del catálogo llegan sin que nadie en el negocio haga nada: las comandas se revisan solas. */
export const ORDERS_POLL_MS = 15_000

export function useOrders() {
  const { data, loading, error, reload, refresh } = useAsync(listOrders, [], { pollMs: ORDERS_POLL_MS })
  const [statusError, setStatusError] = useState<string>()

  const setStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      setStatusError(undefined)
      try {
        await updateOrderStatus(orderId, status)
        await refresh()
      } catch (err) {
        setStatusError(err instanceof Error ? err.message : 'No se pudo actualizar el pedido.')
      }
    },
    [refresh],
  )

  const register = useCallback(
    async (input: NewSaleInput) => {
      const order = await registerSale(input)
      reload()
      return order
    },
    [reload],
  )

  return { orders: data ?? [], loading, error, reload, setStatus, statusError, register }
}
