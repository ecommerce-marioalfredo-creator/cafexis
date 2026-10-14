// Supabase Edge Function: create-payment-link
//
// Genera un link de pago de Wompi para un pedido público YA registrado
// (register_public_order_cafexis, migración 0012), que nace en estado
// 'pendiente_pago'. El frontend llama esta función justo después de
// registrar el pedido, y redirige al cliente a la URL que devuelve.
//
// Requiere la llave privada de Wompi, que solo vive aquí (variable de
// entorno WOMPI_PRIVATE_KEY), nunca en el frontend ni en el repositorio.
// Mismo patrón que invite-user/index.ts.
//
// Desplegar con: supabase functions deploy create-payment-link
// Configurar secreto con:
//   supabase secrets set WOMPI_PRIVATE_KEY=<tu-llave-privada-de-wompi>
// Ver supabase/README.md, sección "Fase 6", para la configuración completa
// y el estado real de esta integración (sin cuenta de Wompi, esta función
// responde con un error claro en vez de fallar en silencio).
//
// Referencia de la API de Wompi: https://docs.wompi.co/
// (Payment Links: POST https://production.wompi.co/v1/payment_links,
// sandbox: https://sandbox.wompi.co/v1/payment_links)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const WOMPI_PRIVATE_KEY = Deno.env.get('WOMPI_PRIVATE_KEY')
const WOMPI_API_BASE = Deno.env.get('WOMPI_API_BASE') ?? 'https://sandbox.wompi.co/v1'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreatePaymentLinkPayload {
  orderId: string
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  if (!WOMPI_PRIVATE_KEY) {
    // Estado explícito, no un fallo silencioso: falta la cuenta de comercio
    // de Wompi. Ver supabase/README.md, sección "Fase 6".
    return jsonResponse(
      { error: 'Falta configurar WOMPI_PRIVATE_KEY en esta función. Ver supabase/README.md, sección Fase 6.' },
      503,
    )
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ error: 'Falta el encabezado Authorization.' }, 401)
  }

  let payload: CreatePaymentLinkPayload
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ error: 'Cuerpo de la solicitud inválido.' }, 400)
  }

  const { orderId } = payload
  if (!orderId) {
    return jsonResponse({ error: 'Falta orderId.' }, 400)
  }

  // Cliente "como el llamador": el cliente final que hizo el pedido.
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser()

  if (callerError || !caller) {
    return jsonResponse({ error: 'No se pudo verificar tu sesión.' }, 401)
  }

  // Solo el pedido del propio cliente, pendiente de pago.
  const { data: order, error: orderError } = await callerClient
    .from('orders_cafexis')
    .select('id, code, total, status, customer_id')
    .eq('id', orderId)
    .eq('customer_id', caller.id)
    .single()

  if (orderError || !order) {
    return jsonResponse({ error: 'Pedido no encontrado.' }, 404)
  }
  if (order.status !== 'pendiente_pago') {
    return jsonResponse({ error: 'Este pedido no está pendiente de pago.' }, 400)
  }

  const amountInCents = Math.round(Number(order.total) * 100)
  const reference = `${order.id}`

  // Payment Links de Wompi: https://docs.wompi.co/docs/colombia/links-de-pago/
  const wompiResponse = await fetch(`${WOMPI_API_BASE}/payment_links`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WOMPI_PRIVATE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `Pedido ${order.code} · Cafexis`,
      description: `Pedido ${order.code}`,
      single_use: true,
      collect_shipping: false,
      currency: 'COP',
      amount_in_cents: amountInCents,
      reference,
    }),
  })

  const wompiData = await wompiResponse.json().catch(() => null)

  if (!wompiResponse.ok || !wompiData?.data?.id) {
    return jsonResponse({ error: 'No se pudo generar el link de pago con Wompi.', details: wompiData }, 502)
  }

  const paymentLinkId: string = wompiData.data.id
  const checkoutUrl = `https://checkout.wompi.co/l/${paymentLinkId}`

  // Asocia la referencia de Wompi a la transacción ya creada por
  // register_public_order_cafexis (status 'pendiente'), vía la RPC que solo
  // permite tocar el pedido del propio cliente. Se llama como el cliente:
  // con la service_role, auth.uid() sería null y la RPC no encontraría el pedido.
  const { error: attachError } = await callerClient.rpc('attach_payment_reference_cafexis', {
    p_order_id: order.id,
    p_provider: 'wompi',
    p_provider_reference: paymentLinkId,
  })

  if (attachError) {
    return jsonResponse({ error: attachError.message }, 500)
  }

  return jsonResponse({ checkoutUrl })
})
