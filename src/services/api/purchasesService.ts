import { supabase, getActiveBusinessId } from './supabaseClient'
import { mapPurchaseOrder } from './mappers'
import type { PurchaseOrder } from '@/types/domain'
import type { PurchaseOrderRow } from '@/types/database'

const PURCHASE_ORDER_SELECT =
  '*, suppliers_cafexis(name), purchase_order_lines_cafexis(*, inventory_items_cafexis(name))'

export async function listPurchaseOrders(): Promise<PurchaseOrder[]> {
  const businessId = await getActiveBusinessId()

  const { data, error } = await supabase
    .from('purchase_orders_cafexis')
    .select(PURCHASE_ORDER_SELECT)
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .returns<PurchaseOrderRow[]>()

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapPurchaseOrder)
}

export async function confirmPurchaseOrder(id: string, lines: PurchaseOrder['lines']): Promise<PurchaseOrder> {
  const { error: deleteError } = await supabase
    .from('purchase_order_lines_cafexis')
    .delete()
    .eq('purchase_order_id', id)
  if (deleteError) throw new Error(deleteError.message)

  if (lines.length > 0) {
    const { error: insertError } = await supabase.from('purchase_order_lines_cafexis').insert(
      lines.map((l) => ({
        purchase_order_id: id,
        inventory_item_id: l.inventoryItemId,
        quantity: l.quantity,
        unit: l.unit,
      })),
    )
    if (insertError) throw new Error(insertError.message)
  }

  const { data, error } = await supabase
    .from('purchase_orders_cafexis')
    .update({ status: 'confirmada' })
    .eq('id', id)
    .select(PURCHASE_ORDER_SELECT)
    .single<PurchaseOrderRow>()

  if (error || !data) throw new Error(error?.message ?? `Orden de compra ${id} no encontrada`)
  return mapPurchaseOrder(data)
}
