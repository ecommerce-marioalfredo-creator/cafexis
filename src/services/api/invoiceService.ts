/**
 * Facturación electrónica DIAN de un pedido entregado (Fase 6). La RPC
 * request_invoice_cafexis valida permisos y abre la fila 'pendiente'; la
 * Edge Function generate-invoice la vuelve a validar como el usuario (0013),
 * la reclama para no emitirla dos veces y la completa llamando a Factus con
 * la service_role key.
 */
import { supabase } from './supabaseClient'
import { invokeEdgeFunction } from './edgeFunctions'
import { mapInvoice } from './mappers'
import type { Invoice } from '@/types/domain'
import type { InvoiceRow } from '@/types/database'

export async function getInvoice(orderId: string): Promise<Invoice | undefined> {
  const { data, error } = await supabase
    .from('invoices_cafexis')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle<InvoiceRow>()

  if (error) throw new Error(error.message)
  return data ? mapInvoice(data) : undefined
}

export async function generateInvoice(orderId: string): Promise<Invoice> {
  // Primero la RPC: si no hay permiso o el pedido no está entregado, el
  // mensaje llega sin pasar por la Edge Function.
  const { error: requestError } = await supabase.rpc('request_invoice_cafexis', { p_order_id: orderId })
  if (requestError) throw new Error(requestError.message)

  await invokeEdgeFunction<{ success?: boolean }>('generate-invoice', { orderId })

  const invoice = await getInvoice(orderId)
  if (!invoice) throw new Error('La factura se solicitó pero no se pudo leer su estado.')
  return invoice
}
