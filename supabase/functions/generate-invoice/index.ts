// Supabase Edge Function: generate-invoice
//
// Genera la factura electrónica DIAN de un pedido ya entregado, usando
// Factus (https://developers.factus.com.co/) como proveedor tecnológico
// autorizado de referencia. El frontend llama primero a la RPC
// request_invoice_cafexis (migración 0012), que valida permisos y crea la
// fila 'pendiente' en invoices_cafexis; luego llama a esta función con el
// mismo orderId para que la complete.
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

  // La fila 'pendiente' ya debe existir: la crea request_invoice_cafexis,
  // que también valida que el pedido esté entregado y sea del negocio de
  // quien llama (o que quien llama sea supervisor técnico).
  const { data: invoice, error: invoiceError } = await callerClient
    .from('invoices_cafexis')
    .select('id, order_id, business_id, status')
    .eq('order_id', orderId)
    .single()

  if (invoiceError || !invoice) {
    return jsonResponse({ error: 'No se encontró una solicitud de factura para este pedido. Llama primero a request_invoice_cafexis.' }, 404)
  }

  if (!FACTUS_API_TOKEN) {
    // Estado explícito, no un fallo silencioso: falta la cuenta de Factus.
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    await adminClient
      .from('invoices_cafexis')
      .update({ status: 'error', error_message: 'Falta configurar FACTUS_API_TOKEN en esta función.' })
      .eq('id', invoice.id)
    return jsonResponse(
      { error: 'Falta configurar FACTUS_API_TOKEN en esta función. Ver supabase/README.md, sección Fase 6.' },
      503,
    )
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

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

  const factusResponse = await fetch(`${FACTUS_API_BASE}/bills/validate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${FACTUS_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(factusPayload),
  })

  const factusData = await factusResponse.json().catch(() => null)

  if (!factusResponse.ok) {
    await adminClient
      .from('invoices_cafexis')
      .update({ status: 'error', error_message: factusData?.message ?? 'Factus rechazó la solicitud de factura.' })
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
    })
    .eq('id', invoice.id)

  return jsonResponse({ success: true, cufe: factusData?.data?.bill?.cufe })
})
