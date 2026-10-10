import { useCallback } from 'react'
import { useAsync } from './useAsync'
import {
  listPurchaseOrders,
  generatePurchaseProposals,
  createPurchaseOrder,
  confirmPurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder,
} from '@/services/api/purchasesService'
import type { NewPurchaseOrderInput, PurchaseOrderLine } from '@/types/domain'

export function usePurchaseOrders() {
  const { data, loading, error, reload } = useAsync(listPurchaseOrders, [])

  const generateProposals = useCallback(async () => {
    const added = await generatePurchaseProposals()
    reload()
    return added
  }, [reload])

  const create = useCallback(
    async (input: NewPurchaseOrderInput) => {
      await createPurchaseOrder(input)
      reload()
    },
    [reload],
  )

  const confirm = useCallback(
    async (id: string, supplierId: string, lines: PurchaseOrderLine[]) => {
      await confirmPurchaseOrder(id, supplierId, lines)
      reload()
    },
    [reload],
  )

  const receive = useCallback(
    async (id: string) => {
      await receivePurchaseOrder(id)
      reload()
    },
    [reload],
  )

  const cancel = useCallback(
    async (id: string) => {
      await cancelPurchaseOrder(id)
      reload()
    },
    [reload],
  )

  return { purchaseOrders: data ?? [], loading, error, reload, generateProposals, create, confirm, receive, cancel }
}
