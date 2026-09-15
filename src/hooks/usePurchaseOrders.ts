import { useCallback } from 'react'
import { useAsync } from './useAsync'
import { listPurchaseOrders, confirmPurchaseOrder } from '@/services/api/purchasesService'
import type { PurchaseOrder } from '@/types/domain'

export function usePurchaseOrders() {
  const { data, loading, error, reload } = useAsync(listPurchaseOrders, [])

  const confirm = useCallback(
    async (id: string, lines: PurchaseOrder['lines']) => {
      await confirmPurchaseOrder(id, lines)
      reload()
    },
    [reload],
  )

  return { purchaseOrders: data ?? [], loading, error, reload, confirm }
}
