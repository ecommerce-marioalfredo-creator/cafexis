import { createClient } from '@supabase/supabase-js'

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
 */
export async function getActiveBusinessId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('No hay una sesión activa.')

  const { data, error } = await supabase
    .from('app_users_cafexis')
    .select('business_id')
    .eq('id', session.user.id)
    .single<{ business_id: string }>()

  if (error || !data) throw new Error('No se pudo determinar el negocio de la sesión activa.')
  return data.business_id
}
