/**
 * Autenticación del cliente final: login con Google (no usuario/contraseña
 * propio de Cafexis), reutilizable en cualquier negocio de la plataforma.
 * Separado de authService.ts (empleados internos) porque son dos perfiles
 * distintos sobre la misma sesión de Supabase — ver la nota de arquitectura
 * en CustomerAuthContext.tsx.
 */
import { Browser } from '@capacitor/browser'
import { supabase } from './supabaseClient'
import { IS_NATIVE, NATIVE_AUTH_CALLBACK } from '@/platform/appTarget'
import { rememberNativeAuthReturn } from '@/platform/nativeAuthReturn'
import { mapCustomer, mapCustomerBusinessLink } from './mappers'
import type { Customer, CustomerBusinessLink } from '@/types/domain'
import type { CustomerRow, CustomerBusinessRow } from '@/types/database'

/** Abre el flujo de Google; Supabase redirige de vuelta a redirectTo tras autenticar. */
export async function loginWithGoogle(redirectTo: string): Promise<void> {
  if (IS_NATIVE) return loginWithGoogleNative(redirectTo)

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })
  if (error) throw new Error(error.message)
}

/**
 * App nativa (Fase 7): Google no permite iniciar sesión dentro de un
 * WebView embebido, así que el flujo se abre en el navegador del sistema y
 * vuelve a la app por deep link (NATIVE_AUTH_CALLBACK) con un `code` que
 * canjea platform/nativeBridge.ts. Se recuerda la pantalla de origen para
 * regresar ahí al terminar.
 */
async function loginWithGoogleNative(redirectTo: string): Promise<void> {
  const returnTo = new URL(redirectTo, window.location.origin)
  rememberNativeAuthReturn(`${returnTo.pathname}${returnTo.search}`)

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: NATIVE_AUTH_CALLBACK, skipBrowserRedirect: true },
  })
  if (error || !data.url) throw new Error(error?.message ?? 'No se pudo iniciar sesión con Google.')
  await Browser.open({ url: data.url, presentationStyle: 'popover' })
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut()
}

/**
 * Perfil de cliente de la sesión activa. Si hay sesión pero aún no existe la
 * fila en customers_cafexis (primer login), la crea con los datos que trae
 * el proveedor de Google.
 */
export async function getCurrentCustomer(): Promise<Customer | undefined> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return undefined

  const { data: existing, error: fetchError } = await supabase
    .from('customers_cafexis')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle<CustomerRow>()

  if (fetchError) throw new Error(fetchError.message)
  if (existing) return mapCustomer(existing)

  const meta = session.user.user_metadata as { full_name?: string; name?: string } | undefined
  const { data: created, error: insertError } = await supabase
    .from('customers_cafexis')
    .insert({
      id: session.user.id,
      name: meta?.full_name ?? meta?.name ?? session.user.email ?? 'Cliente',
      email: session.user.email ?? '',
    })
    .select()
    .single<CustomerRow>()

  if (insertError || !created) throw new Error(insertError?.message ?? 'No se pudo crear tu perfil de cliente.')
  return mapCustomer(created)
}

/** Negocios a los que el cliente ya está vinculado (pantalla "Mis negocios"). */
export async function listMyBusinesses(): Promise<CustomerBusinessLink[]> {
  const { data, error } = await supabase
    .from('customer_businesses_cafexis')
    .select('*, businesses_cafexis(*)')
    .order('linked_at', { ascending: false })
    .returns<CustomerBusinessRow[]>()

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapCustomerBusinessLink)
}

/** Vincula al cliente autenticado con un negocio (idempotente). */
export async function linkToBusiness(businessId: string): Promise<void> {
  const { error } = await supabase.rpc('link_customer_to_business_cafexis', { p_business_id: businessId })
  if (error) throw new Error(error.message)
}
