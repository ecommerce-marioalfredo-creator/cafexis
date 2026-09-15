import { useAsync } from './useAsync'
import { listInventory } from '@/services/api/inventoryService'

export function useInventory() {
  const { data, loading, error, reload } = useAsync(listInventory, [])
  return { items: data ?? [], loading, error, reload }
}
