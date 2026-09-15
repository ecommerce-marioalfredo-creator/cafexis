import { delay } from './client'
import { inventoryItems } from '@/services/mock/data'
import type { InventoryItem } from '@/types/domain'

export async function listInventory(): Promise<InventoryItem[]> {
  return delay([...inventoryItems].sort((a, b) => a.name.localeCompare(b.name)))
}
