// Supabase Edge Function: generate-invoice
//
// Genera la factura electrónica DIAN de un pedido ya entregado, usando
// Factus (https://developers.factus.com.co/) como proveedor tecnológico
// autorizado de referencia. Valida permisos con la RPC
// request_invoice_cafexis (migración 0012) llamada como el usuario, que
// crea o reutiliza la fila en invoices_cafexis, y la reclama con
// claim_invoice_generation_cafexis (0013) antes de llamar a Factus, para
// que nunca se emita dos veces la misma factura.
//
// Requiere credenciales de Factus, que solo viven aquí (variables de
// entorno), nunca en el frontend ni en el repositorio. Mismo patrón que
// invite-user/index.ts.
//
// Desplegar con: supabase functions deploy generate-invoice
// Configurar secretos con:
//   supabase secrets set FACTUS_API_TOKEN=<tu-token-de-factus>
// Ver supabase/README.md, sección "Fase 6", para la configuración completa
// y qué falta (cuenta en Factus con NIT y resolución de facturación DIAN
// vigente) — sin eso, esta función responde con un error claro.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FACTUS_API_TOKEN = Deno.env.get('FACTUS_API_TOKEN')
const FACTUS_API_BASE = Deno.env.get('FACTUS_API_BASE') ?? 'https://api-sandbox.factus.com.co/v1'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GenerateInvoicePayload {
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

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ error: 'Falta el encabezado Authorization.' }, 401)
  }

  let payload: GenerateInvoicePayload
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ error: 'Cuerpo de la solicitud inválido.' }, 400)
  }

  const { orderId } = payload
  if (!orderId) {
    return jsonResponse({ error: 'Falta orderId.' }, 400)
  }

  // Cliente "como el llamador": empleado interno (administrador o
  // supervisor técnico) del negocio dueño del pedido.
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user: caller },
  } = await callerClient.auth.getUser()
  if (!caller) {
    return jsonResponse({ error: 'No se pudo verificar tu sesión.' }, 401)
  }

  // Permisos: request_invoice_cafexis, llamada COMO el usuario, exige
  // administrador o supervisor técnico activo, pedido entregado y del
  // negocio de quien llama, y crea (o reutiliza) la fila de la factura. Poder
  // LEER la factura no basta: un barista o el rol soporte también pueden
  // leerla, pero no deben poder emitirla.
  const { data: invoiceId, error: requestError } = await callerClient.rpc('request_invoice_cafexis', { p_order_id: orderId })
  if (requestError || !invoiceId) {
    return jsonResponse({ error: requestError?.message ?? 'No tienes permiso para facturar este pedido.' }, 403)
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { data: invoice, error: invoiceError } = await adminClient
    .from('invoices_cafexis')
    .select('id, status, cufe')
    .eq('id', invoiceId)
    .single()

  if (invoiceError || !invoice) {
    return jsonResponse({ error: 'No se encontró la solicitud de factura de este pedido.' }, 404)
  }

  // Idempotente: una factura ya emitida no se vuelve a enviar a la DIAN.
  if (invoice.status === 'emitida') {
    return jsonResponse({ success: true, cufe: invoice.cufe })
  }

  if (!FACTUS_API_TOKEN) {
    // Estado explícito, no un fallo silencioso: falta la cuenta de Factus.
    await adminClient
      .from('invoices_cafexis')
      .update({ status: 'error', error_message: 'Falta configurar FACTUS_API_TOKEN en esta función.' })
      .eq('id', invoice.id)
    return jsonResponse(
      { error: 'Falta configurar FACTUS_API_TOKEN en esta función. Ver supabase/README.md, sección Fase 6.' },
      503,
    )
  }

  // Reclamo atómico (0013): si dos llamadas llegan a la vez, solo una emite.
  const { data: claimed, error: claimError } = await adminClient.rpc('claim_invoice_generation_cafexis', {
    p_invoice_id: invoice.id,
  })
  if (claimError) {
    return jsonResponse({ error: claimError.message }, 500)
  }
  if (!claimed) {
    return jsonResponse({ error: 'Esta factura ya se está generando. Espera un momento y vuelve a consultar.' }, 409)
  }

  const { data: order } = await adminClient
    .from('orders_cafexis')
    .select('code, customer_name, total, created_at, order_items_cafexis(product_name, quantity, unit_price)')
    .eq('id', orderId)
    .single()

  if (!order) {
    return jsonResponse({ error: 'Pedido no encontrado.' }, 404)
  }

  // Estructura de referencia del payload de factura de Factus — ajustar a
  // la API real una vez haya cuenta: https://developers.factus.com.co/
  const factusPayload = {
    reference_code: order.code,
    customer: { names: order.customer_name },
    items: (order.order_items_cafexis ?? []).map((line: { product_name: string; quantity: number; unit_price: number }) => ({
      name: line.product_name,
      quantity: line.quantity,
      price: line.unit_price,
    })),
  }

  let factusResponse: Response
  try {
    factusResponse = await fetch(`${FACTUS_API_BASE}/bills/validate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${FACTUS_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(factusPayload),
    })
  } catch {
    await adminClient
      .from('invoices_cafexis')
      .update({ status: 'error', error_message: 'No se pudo conectar con Factus.', processing_started_at: null })
      .eq('id', invoice.id)
    return jsonResponse({ error: 'No se pudo conectar con Factus. Intenta de nuevo en unos minutos.' }, 502)
  }

  const factusData = await factusResponse.json().catch(() => null)

  if (!factusResponse.ok) {
    await adminClient
      .from('invoices_cafexis')
      .update({
        status: 'error',
        error_message: factusData?.message ?? 'Factus rechazó la solicitud de factura.',
        processing_started_at: null,
      })
      .eq('id', invoice.id)
    return jsonResponse({ error: 'No se pudo generar la factura con Factus.', details: factusData }, 502)
  }

  await adminClient
    .from('invoices_cafexis')
    .update({
      status: 'emitida',
      cufe: factusData?.data?.bill?.cufe ?? null,
      pdf_url: factusData?.data?.bill?.public_url_pdf ?? null,
      xml_url: factusData?.data?.bill?.public_url_xml ?? null,
      error_message: null,
      processing_started_at: null,
    })
    .eq('id', invoice.id)

  return jsonResponse({ success: true, cufe: factusData?.data?.bill?.cufe })
})
