import { supabase, getActiveBusinessId } from './supabaseClient'
import { mapPurchaseOrder } from './mappers'
import type { NewPurchaseOrderInput, PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus } from '@/types/domain'
import type { PurchaseOrderRow } from '@/types/database'

const PURCHASE_ORDER_SELECT =
  '*, suppliers_cafexis(name), purchase_order_lines_cafexis(*, inventory_items_cafexis(name))'

function toLinesPayload(lines: Array<Omit<PurchaseOrderLine, 'inventoryItemName'>>) {
  return lines.map((l) => ({ inventory_item_id: l.inventoryItemId, quantity: l.quantity, unit: l.unit }))
}

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

/**
 * Revisa todo el inventario y agrega a propuestas del sistema los insumos
 * bajos que aún no estén en una orden abierta. Devuelve cuántos agregó.
 * (Las propuestas también se generan solas cuando una venta o un ajuste
 * deja un insumo bajo el umbral, por trigger en la base de datos.)
 */
export async function generatePurchaseProposals(): Promise<number> {
  const businessId = await getActiveBusinessId()
  const { data, error } = await supabase.rpc('generate_purchase_proposals_cafexis', { p_business_id: businessId })
  if (error) throw new Error(error.message)
  return Number(data ?? 0)
}

/** Orden manual: queda confirmada de inmediato, lista para recibirse. */
export async function createPurchaseOrder(input: NewPurchaseOrderInput): Promise<void> {
  const businessId = await getActiveBusinessId()
  const { error } = await supabase.rpc('create_purchase_order_cafexis', {
    p_supplier_id: input.supplierId,
    p_lines: toLinesPayload(input.lines),
    p_reason: input.reason ?? null,
    p_business_id: businessId,
  })
  if (error) throw new Error(error.message)
}

/** Confirma una propuesta con el proveedor elegido y las cantidades revisadas (atómico, vía RPC). */
export async function confirmPurchaseOrder(id: string, supplierId: string, lines: PurchaseOrderLine[]): Promise<void> {
  const { error } = await supabase.rpc('confirm_purchase_order_cafexis', {
    p_purchase_order_id: id,
    p_supplier_id: supplierId,
    p_lines: toLinesPayload(lines),
  })
  if (error) throw new Error(error.message)
}

/**
 * Recibir o cancelar. El trigger guard_purchase_order_status_cafexis valida
 * la transición y, al recibir, apply_purchase_receipt_cafexis suma las
 * cantidades al inventario.
 */
async function setPurchaseOrderStatus(id: string, status: PurchaseOrderStatus): Promise<void> {
  const { error } = await supabase.from('purchase_orders_cafexis').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
}

export const receivePurchaseOrder = (id: string) => setPurchaseOrderStatus(id, 'recibida')
export const cancelPurchaseOrder = (id: string) => setPurchaseOrderStatus(id, 'cancelada')
