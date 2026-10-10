import { createClient } from '@supabase/supabase-js'
import { getBusinessOverride } from './businessOverrideStorage'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Define un archivo .env con las credenciales de tu proyecto de Supabase (ver .env.example).',
  )
}

/** Cliente único de Supabase para todo el frontend (auth + tablas *_cafexis). */
export const supabase = createClient(url, anonKey)

/**
 * business_id del usuario autenticado actual. Los *Service lo usan para
 * filtrar sus consultas explícitamente (además de la protección que ya da
 * Row Level Security en el servidor). Lanza si no hay sesión activa: ningún
 * *Service debería invocarse sin haber pasado por <RequireAuth>.
 *
 * El supervisor técnico puede tener un negocio "override" elegido desde el
 * selector del Topbar (ver businessOverrideStorage.ts) para operar en
 * nombre de otro negocio; en ese caso se usa ese id en vez del de su
 * perfil. Las políticas RLS (0007_fase3_roles_cafexis.sql) son las que de
 * verdad autorizan la escritura — esto solo decide a qué negocio apunta el
 * frontend.
 */
export async function getActiveBusinessId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('No hay una sesión activa.')

  const { data, error } = await supabase
    .from('app_users_cafexis')
    .select('business_id, role')
    .eq('id', session.user.id)
    .single<{ business_id: string; role: string }>()

  if (error || !data) throw new Error('No se pudo determinar el negocio de la sesión activa.')

  if (data.role === 'supervisor_tecnico') {
    const override = getBusinessOverride()
    if (override) return override
  }

  return data.business_id
}
