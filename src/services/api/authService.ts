/**
 * Autenticación y registro multi-negocio con Supabase Auth.
 *
 * Cada usuario de app_users_cafexis está vinculado 1 a 1 con un usuario de
 * auth.users (Supabase maneja el hash de contraseñas, la sesión y su
 * persistencia en el navegador). El registro crea primero el negocio y luego
 * el perfil del usuario, en ese orden, tal como lo permiten las políticas de
 * RLS (ver supabase/migrations/0002_rls_cafexis.sql).
 */
import { supabase } from './supabaseClient'
import { mapBusiness, mapAppUser } from './mappers'
import type { AppUser, Business, LoginInput, RegisterInput } from '@/types/domain'
import type { BusinessRow, AppUserRow } from '@/types/database'

export async function register(input: RegisterInput): Promise<void> {
  const email = input.email.trim().toLowerCase()

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password: input.password,
  })
  if (signUpError) throw new Error(signUpError.message)

  const userId = signUpData.user?.id
  if (!userId) {
    throw new Error('No se pudo crear la cuenta. Intenta de nuevo.')
  }

  const { data: businessRow, error: businessError } = await supabase
    .from('businesses_cafexis')
    .insert({
      name: input.businessName,
      type: input.businessType,
      country: input.country,
      primary_color: input.primaryColor,
      logo_url: input.logoUrl ?? null,
    })
    .select()
    .single<BusinessRow>()

  if (businessError || !businessRow) {
    throw new Error(businessError?.message ?? 'No se pudo crear el negocio.')
  }

  const { error: profileError } = await supabase.from('app_users_cafexis').insert({
    id: userId,
    business_id: businessRow.id,
    name: input.ownerName,
    email,
    role: 'administrador',
  })

  if (profileError) throw new Error(profileError.message)

  // Si el proyecto de Supabase exige confirmación por correo, signUp no deja
  // una sesión activa todavía; se lo informamos al usuario en vez de fallar.
  if (!signUpData.session) {
    throw new Error('Cuenta creada. Revisa tu correo para confirmar la cuenta antes de ingresar.')
  }
}

export async function login(input: LoginInput): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  })
  if (error) throw new Error(error.message)
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut()
}

/** Negocio y perfil del usuario autenticado actual (si hay sesión). */
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

  if (userError || !userRow) return undefined

  const { data: businessRow, error: businessError } = await supabase
    .from('businesses_cafexis')
    .select('*')
    .eq('id', userRow.business_id)
    .maybeSingle<BusinessRow>()

  if (businessError || !businessRow) return undefined

  return { business: mapBusiness(businessRow), user: mapAppUser(userRow) }
}
