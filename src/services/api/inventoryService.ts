import { supabase, getActiveBusinessId } from './supabaseClient'
import { mapInventoryItem } from './mappers'
import type { InventoryItem, InventoryItemInput, NewInventoryItemInput } from '@/types/domain'
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

export async function createInventoryItem(input: NewInventoryItemInput): Promise<InventoryItem> {
  const businessId = await getActiveBusinessId()

  const { data, error } = await supabase
    .from('inventory_items_cafexis')
    .insert({
      business_id: businessId,
      name: input.name,
      unit: input.unit,
      quantity: input.quantity,
      low_stock_threshold: input.lowStockThreshold,
      preferred_supplier_id: input.preferredSupplierId ?? null,
    })
    .select()
    .single<InventoryItemRow>()

  if (error || !data) throw new Error(error?.message ?? 'No se pudo crear el ingrediente.')
  return mapInventoryItem(data)
}

export async function updateInventoryItem(id: string, input: InventoryItemInput): Promise<InventoryItem> {
  const { data, error } = await supabase
    .from('inventory_items_cafexis')
    .update({
      name: input.name,
      unit: input.unit,
      low_stock_threshold: input.lowStockThreshold,
      preferred_supplier_id: input.preferredSupplierId ?? null,
    })
    .eq('id', id)
    .select()
    .single<InventoryItemRow>()

  if (error || !data) throw new Error(error?.message ?? `Ingrediente ${id} no encontrado.`)
  return mapInventoryItem(data)
}

/** Ajusta la existencia a un nuevo total. El trigger sync_inventory_status_cafexis recalcula el estado (ok/bajo/agotado) solo. */
export async function adjustInventoryQuantity(id: string, quantity: number): Promise<InventoryItem> {
  const { data, error } = await supabase
    .from('inventory_items_cafexis')
    .update({ quantity })
    .eq('id', id)
    .select()
    .single<InventoryItemRow>()

  if (error || !data) throw new Error(error?.message ?? `Ingrediente ${id} no encontrado.`)
  return mapInventoryItem(data)
}
