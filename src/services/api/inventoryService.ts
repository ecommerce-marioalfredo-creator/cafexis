import { supabase, getActiveBusinessId } from './supabaseClient'
import { mapInventoryItem } from './mappers'
import type { InventoryItem } from '@/types/domain'
import type { InventoryItemRow } from '@/types/database'

export async function listInventory(): Promise<InventoryItem[]> {
  const businessId = await getActiveBusinessId()

  const { data, error } = await supabase
    .from('inventory_items_cafexis')
    .select('*')
    .eq('business_id', businessId)
    .order('name')
    .returns<InventoryItemRow[]>()

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapInventoryItem)
}
