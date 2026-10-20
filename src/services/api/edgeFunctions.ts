import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

/**
 * Llama una Edge Function (supabase/functions/) y, si falla, lanza el
 * mensaje que la propia función devuelve en `{ error }` ("Falta configurar
 * FACTUS_API_TOKEN…", "No tienes permiso…"). Ante una respuesta no-2xx,
 * supabase.functions.invoke solo dice "Edge Function returned a non-2xx
 * status code" y deja el cuerpo sin leer en error.context.
 */
export async function invokeEdgeFunction<T extends object>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T & { error?: string }>(name, { body })

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = (await (error.context as Response).json().catch(() => null)) as { error?: string } | null
      if (payload?.error) throw new Error(payload.error)
    }
    throw new Error(error.message)
  }
  if (!data) throw new Error(`La función ${name} no devolvió respuesta.`)
  if (data.error) throw new Error(data.error)
  return data
}
