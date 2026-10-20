/**
 * Pago en línea del pedido público del cliente final (Fase 6). El pedido ya
 * se registró vía registerPublicOrder (publicOrdersService.ts) y nace en
 * estado 'pendiente_pago'; esta función pide a la Edge Function
 * create-payment-link la URL de checkout de Wompi y redirige ahí.
 *
 * El webhook de Wompi (supabase/functions/wompi-webhook) es quien confirma
 * el cobro y mueve el pedido a 'pedido' — nada de esto pasa por el
 * frontend directamente.
 */
import { invokeEdgeFunction } from './edgeFunctions'

export async function createPaymentLink(orderId: string): Promise<string> {
  const { checkoutUrl } = await invokeEdgeFunction<{ checkoutUrl?: string }>('create-payment-link', { orderId })
  if (!checkoutUrl) throw new Error('No se pudo generar el link de pago.')
  return checkoutUrl
}
