/**
 * Autenticación y registro multi-negocio con Supabase Auth.
 *
 * Cada usuario de app_users_cafexis está vinculado 1 a 1 con un usuario de
 * auth.users (Supabase maneja el hash de contraseñas, la sesión y su
 * persistencia en el navegador). El registro crea el negocio y el perfil de
 * administrador en una sola transacción con la RPC register_business_cafexis
 * (ver supabase/migrations/0013_auditoria_seguridad_cafexis.sql).
 */
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import { mapBusiness, mapAppUser } from './mappers'
import { getBusinessOverride } from './businessOverrideStorage'
import { uploadBusinessLogo } from './businessService'
import type { AppUser, Business, BusinessType, LoginInput, RegisterInput } from '@/types/domain'
import type { BusinessRow, AppUserRow } from '@/types/database'

/**
 * Datos del negocio guardados en los metadatos del usuario al registrarse.
 * Si el proyecto de Supabase exige confirmar el correo, signUp no deja
 * sesión y el negocio no se puede crear todavía: se termina de crear en el
 * primer login (ver ensureStaffProfile). El logo no va aquí (los metadatos
 * viajan dentro del JWT); se puede subir después desde Configuración.
 */
interface PendingRegistration {
  businessName: string
  businessType: BusinessType
  country: string
  ownerName: string
  primaryColor: string
}

async function createBusinessForCurrentUser(pending: PendingRegistration): Promise<string> {
  const { data, error } = await supabase.rpc('register_business_cafexis', {
    p_business_name: pending.businessName,
    p_business_type: pending.businessType,
    p_country: pending.country,
    p_primary_color: pending.primaryColor,
    p_owner_name: pending.ownerName,
  })
  if (error || !data) throw new Error(error?.message ?? 'No se pudo crear el negocio.')

  await supabase.auth.updateUser({ data: { pending_registration: null } })
  return data as string
}

export async function register(input: RegisterInput): Promise<void> {
  const email = input.email.trim().toLowerCase()
  const pending: PendingRegistration = {
    businessName: input.businessName,
    businessType: input.businessType,
    country: input.country,
    ownerName: input.ownerName,
    primaryColor: input.primaryColor,
  }

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: { data: { pending_registration: pending } },
  })
  if (signUpError) throw new Error(signUpError.message)

  if (!signUpData.session) {
    throw new Error(
      'Cuenta creada. Revisa tu correo para confirmarla; cuando ingreses por primera vez terminaremos de crear tu negocio.',
    )
  }

  const businessId = await createBusinessForCurrentUser(pending)

  if (input.logoFile) {
    // El logo es opcional: si falla la subida, el negocio ya quedó creado y
    // se puede subir de nuevo desde Configuración.
    await uploadBusinessLogo(businessId, input.logoFile).catch(() => undefined)
  }
}

/**
 * Tras iniciar sesión: el usuario debe tener un perfil interno activo. Si no
 * lo tiene pero dejó un registro pendiente (confirmó su correo después de
 * registrarse), se crea su negocio ahora. En cualquier otro caso se cierra
 * la sesión con un mensaje claro, en vez de devolverlo mudo a /ingreso.
 */
async function ensureStaffProfile(user: User): Promise<void> {
  const { data: profile, error } = await supabase
    .from('app_users_cafexis')
    .select('active')
    .eq('id', user.id)
    .maybeSingle<{ active: boolean }>()
  if (error) throw new Error(error.message)

  if (profile) {
    if (profile.active) return
    await supabase.auth.signOut()
    throw new Error('Tu usuario está desactivado. Pide al administrador de tu negocio que lo vuelva a activar.')
  }

  const pending = (user.user_metadata as { pending_registration?: PendingRegistration | null } | undefined)
    ?.pending_registration
  if (pending) {
    await createBusinessForCurrentUser(pending)
    return
  }

  await supabase.auth.signOut()
  throw new Error('Esta cuenta no tiene acceso al panel de ningún negocio. Si te invitaron, usa el enlace del correo de invitación.')
}

export async function login(input: LoginInput): Promise<void> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  })
  if (error) throw new Error(error.message)
  await ensureStaffProfile(data.user)
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut()
}

/** Negocio y perfil del usuario autenticado actual (si hay sesión y su perfil está activo). */
export async function getCurrentAccount(): Promise<{ business: Business; user: AppUser } | undefined> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return undefined

  const { data: userRow, error: userError } = await supabase
    .from('app_users_cafexis')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle<AppUserRow>()

  if (userError || !userRow || !userRow.active) return undefined

  // El supervisor técnico puede estar "operando" otro negocio (ver
  // businessOverrideStorage.ts) sin que eso cambie su perfil real.
  const effectiveBusinessId =
    userRow.role === 'supervisor_tecnico' ? (getBusinessOverride() ?? userRow.business_id) : userRow.business_id

  const { data: businessRow, error: businessError } = await supabase
    .from('businesses_cafexis')
    .select('*')
    .eq('id', effectiveBusinessId)
    .maybeSingle<BusinessRow>()

  if (businessError || !businessRow) return undefined

  return { business: mapBusiness(businessRow), user: mapAppUser(userRow) }
}
