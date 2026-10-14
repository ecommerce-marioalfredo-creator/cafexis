/**
 * Facturación electrónica DIAN de un pedido entregado (Fase 6). Dos pasos:
 * la RPC request_invoice_cafexis valida permisos y abre la fila
 * 'pendiente' (defensa en profundidad, RLS normal); la Edge Function
 * generate-invoice la completa llamando a Factus con la service_role key.
 */
import { supabase } from './supabaseClient'
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
  const { error: requestError } = await supabase.rpc('request_invoice_cafexis', { p_order_id: orderId })
  if (requestError) throw new Error(requestError.message)

  const { data, error } = await supabase.functions.invoke<{ success?: boolean; error?: string }>('generate-invoice', {
    body: { orderId },
  })

  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)

  const invoice = await getInvoice(orderId)
  if (!invoice) throw new Error('La factura se solicitó pero no se pudo leer su estado.')
  return invoice
}
