import { useCallback } from 'react'
import { useAsync } from './useAsync'
import { cancelOrder, confirmOrderPayment, listBoardOrders, registerSale, updateOrderStatus } from '@/services/api/salesService'
import type { NewSaleInput, OrderStatus, PaymentMethod } from '@/types/domain'

/** Los pedidos del catálogo llegan sin que nadie en el negocio haga nada: las comandas se revisan solas. */
export const ORDERS_POLL_MS = 15_000

/** Desde cuándo mostrar los pedidos ya entregados en el tablero. */
export type ClosedOrdersPeriod = 'hoy' | '7_dias' | '30_dias'

function periodStart(period: ClosedOrdersPeriod): Date {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  if (period === '7_dias') start.setDate(start.getDate() - 6)
  if (period === '30_dias') start.setDate(start.getDate() - 29)
  return start
}

/** Las acciones lanzan el error de la base de datos; quien las llama decide dónde mostrarlo. */
export function useOrders(period: ClosedOrdersPeriod = 'hoy') {
  const { data, loading, error, reload, refresh } = useAsync(() => listBoardOrders(periodStart(period)), [period], {
    pollMs: ORDERS_POLL_MS,
  })

  const setStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      try {
        await updateOrderStatus(orderId, status)
      } finally {
        // También si falla: otra persona pudo haber movido o cancelado este pedido.
        await refresh()
      }
    },
    [refresh],
  )

  const register = useCallback(
    async (input: NewSaleInput) => {
      const order = await registerSale(input)
      await refresh()
      return order
    },
    [refresh],
  )

  // La base de datos exige pasar por 'pedido'; al confirmar, el pedido sigue
  // directo a preparación. Si el segundo paso falla, queda en 'pedido' con su
  // pago ya confirmado y se puede avanzar a mano.
  const confirmPayment = useCallback(
    async (orderId: string, paymentMethod: PaymentMethod) => {
      try {
        await confirmOrderPayment(orderId, paymentMethod)
        await updateOrderStatus(orderId, 'en_preparacion')
      } finally {
        await refresh()
      }
    },
    [refresh],
  )

  const cancel = useCallback(
    async (orderId: string, reason?: string) => {
      try {
        await cancelOrder(orderId, reason)
      } finally {
        await refresh()
      }
    },
    [refresh],
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
