// Supabase Edge Function: wompi-webhook
//
// Recibe las notificaciones de evento de Wompi (transaction.updated) y
// confirma el pago del pedido correspondiente llamando a
// confirm_payment_cafexis (migración 0012), que mueve el pedido de
// 'pendiente_pago' a 'pedido' solo si la transacción fue aprobada.
//
// A diferencia de las demás Edge Functions de este proyecto, esta NO la
// llama el navegador del usuario: la llama Wompi directamente, sin sesión
// de Supabase. La seguridad la da la verificación de firma del evento
// (WOMPI_EVENTS_SECRET), no un JWT — documentado por Wompi en
// https://docs.wompi.co/docs/colombia/eventos/
//
// Configurar esta URL como webhook en el panel de Wompi (Developers →
// Webhooks) y el secreto con:
//   supabase secrets set WOMPI_EVENTS_SECRET=<tu-events-secret-de-wompi>
// Desplegar con: supabase functions deploy wompi-webhook --no-verify-jwt
// (--no-verify-jwt es necesario porque Wompi no manda un JWT de Supabase).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WOMPI_EVENTS_SECRET = Deno.env.get('WOMPI_EVENTS_SECRET')

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/**
 * Firma de eventos de Wompi: SHA-256 de la concatenación de los valores en
 * event.signature.properties (leídos del propio evento, en orden) más el
 * timestamp y el events_secret. Ver
 * https://docs.wompi.co/docs/colombia/eventos/#firma-de-integridad-del-evento
 */
async function verifyWompiSignature(event: Record<string, unknown>, secret: string): Promise<boolean> {
  const signature = event.signature as { checksum?: string; properties?: string[] } | undefined
  const timestamp = event.timestamp as number | undefined
  if (!signature?.checksum || !signature.properties || !timestamp) return false

  const values = signature.properties.map((path) => {
    const parts = path.split('.')
    // path típico: "transaction.id", "transaction.status", "transaction.amount_in_cents"
    let node: unknown = event.data
    for (const part of parts.slice(1)) {
      node = (node as Record<string, unknown> | undefined)?.[part]
    }
    return String(node ?? '')
  })

  const toHash = values.join('') + String(timestamp) + secret
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(toHash))
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return hex === signature.checksum
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido.' }, 405)
  }

  if (!WOMPI_EVENTS_SECRET) {
    // Estado explícito: falta configurar el secreto de eventos de Wompi.
    return jsonResponse(
      { error: 'Falta configurar WOMPI_EVENTS_SECRET en esta función. Ver supabase/README.md, sección Fase 6.' },
      503,
    )
  }

  let event: Record<string, unknown>
  try {
    event = await req.json()
  } catch {
    return jsonResponse({ error: 'Cuerpo del evento inválido.' }, 400)
  }

  const validSignature = await verifyWompiSignature(event, WOMPI_EVENTS_SECRET)
  if (!validSignature) {
    return jsonResponse({ error: 'Firma de evento inválida.' }, 401)
  }

  if (event.event !== 'transaction.updated') {
    // Otros eventos de Wompi se reconocen pero no requieren acción aquí.
    return jsonResponse({ received: true })
  }

  const data = event.data as { transaction?: Record<string, unknown> } | undefined
  const transaction = data?.transaction
  const wompiStatus = transaction?.status as string | undefined
  // paymentLinkId: el checkout de Payment Links trae el id del link en
  // transaction.payment_link_id; create-payment-link.ts guardó justo ese id
  // como provider_reference al asociar la transacción.
  const providerReference = (transaction?.payment_link_id ?? transaction?.reference) as string | undefined

  if (!wompiStatus || !providerReference) {
    return jsonResponse({ error: 'Evento sin status o referencia de transacción.' }, 400)
  }

  const statusMap: Record<string, 'aprobada' | 'declinada' | 'error'> = {
    APPROVED: 'aprobada',
    DECLINED: 'declinada',
    VOIDED: 'declinada',
    ERROR: 'error',
  }
  const mappedStatus = statusMap[wompiStatus]
  if (!mappedStatus) {
    // PENDING u otro estado intermedio: no hay nada que confirmar todavía.
    return jsonResponse({ received: true })
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const { error } = await adminClient.rpc('confirm_payment_cafexis', {
    p_provider: 'wompi',
    p_provider_reference: providerReference,
    p_status: mappedStatus,
    p_raw_payload: event,
  })

  if (error) {
    return jsonResponse({ error: error.message }, 500)
  }

  return jsonResponse({ received: true })
})
