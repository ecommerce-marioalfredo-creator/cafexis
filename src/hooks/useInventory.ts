import { useCallback } from 'react'
import { useAsync } from './useAsync'
import { listInventory, createInventoryItem, updateInventoryItem, adjustInventoryQuantity } from '@/services/api/inventoryService'
import type { InventoryItemInput, NewInventoryItemInput } from '@/types/domain'

export function useInventory() {
  const { data, loading, error, reload } = useAsync(listInventory, [])

  const create = useCallback(
    async (input: NewInventoryItemInput) => {
      await createInventoryItem(input)
      reload()
    },
    [reload],
  )

  const update = useCallback(
    async (id: string, input: InventoryItemInput) => {
      await updateInventoryItem(id, input)
      reload()
    },
    [reload],
  )

  const adjustQuantity = useCallback(
    async (id: string, quantity: number) => {
      await adjustInventoryQuantity(id, quantity)
      reload()
    },
    [reload],
  )

  return { items: data ?? [], loading, error, reload, create, update, adjustQuantity }
}
