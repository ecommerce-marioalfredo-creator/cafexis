/**
 * Pago en línea del pedido público del cliente final (Fase 6). El pedido ya
 * se registró vía registerPublicOrder (publicOrdersService.ts) y nace en
 * estado 'pendiente_pago'; esta función pide a la Edge Function
 * create-payment-link la URL de checkout de Wompi y redirige ahí.
 *
 * Hoy ninguna pantalla la llama: mientras no haya cuenta de comercio aprobada,
 * el cobro lo hace el personal al confirmar la comanda (ver SalesPage.tsx). Se
 * conserva para retomar el pago en línea cuando Wompi esté habilitado.
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
