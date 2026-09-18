// Supabase Edge Function: invite-user
//
// Invita a una persona a unirse a un negocio de Cafexis como usuario interno
// (administrador o barista), sin afectar la sesión de quien invita — a
// diferencia de supabase.auth.signUp(), que autentica como el usuario nuevo.
//
// Requiere admin.inviteUserByEmail, que solo funciona con la service_role
// key. Esa clave vive SOLO en esta función (variable de entorno
// SUPABASE_SERVICE_ROLE_KEY configurada en el panel de Supabase), nunca en
// el frontend ni en el repositorio.
//
// Desplegar con: supabase functions deploy invite-user
// Ver supabase/README.md para la configuración completa.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InviteUserPayload {
  email: string
  name: string
  role: 'administrador' | 'barista'
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

  let payload: InviteUserPayload
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ error: 'Cuerpo de la solicitud inválido.' }, 400)
  }

  const { email, name, role } = payload
  if (!email || !name || !role) {
    return jsonResponse({ error: 'Faltan campos: email, name y role son obligatorios.' }, 400)
  }
  if (role !== 'administrador' && role !== 'barista') {
    return jsonResponse({ error: 'Rol inválido. Solo se puede invitar como administrador o barista.' }, 400)
  }

  // Cliente "como el llamador": identifica quién está invitando a partir de
  // su JWT, sin privilegios elevados.
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

  const { data: callerProfile, error: callerProfileError } = await callerClient
    .from('app_users_cafexis')
    .select('business_id, role')
    .eq('id', caller.id)
    .single()

  if (callerProfileError || !callerProfile) {
    return jsonResponse({ error: 'No se pudo verificar tu perfil de negocio.' }, 403)
  }

  const isSupervisor = callerProfile.role === 'supervisor_tecnico'
  const isBusinessAdmin = callerProfile.role === 'administrador'
  if (!isSupervisor && !isBusinessAdmin) {
    return jsonResponse({ error: 'No tienes permiso para invitar usuarios.' }, 403)
  }

  const businessId = callerProfile.business_id

  // Cliente con privilegios de administración: SOLO esta función lo tiene.
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { business_id: businessId, role, name },
  })

  if (inviteError) {
    return jsonResponse({ error: inviteError.message }, 400)
  }

  const { error: recordError } = await adminClient.from('user_invitations_cafexis').insert({
    business_id: businessId,
    email: email.trim().toLowerCase(),
    name,
    role,
    invited_by: caller.id,
  })

  if (recordError) {
    // La invitación en Supabase Auth ya se envió; el registro es solo para
    // mostrarla como "pendiente" en la UI, así que no revertimos el envío.
    return jsonResponse({ warning: 'Invitación enviada, pero no se pudo registrar en el historial.' }, 200)
  }

  return jsonResponse({ success: true })
})
