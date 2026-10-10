/**
 * El supervisor técnico puede "entrar" a cualquier negocio para dar soporte
 * u operar en su nombre (Fase 3 — Roles y personal). Su perfil en
 * app_users_cafexis sigue fijo en un solo business_id; este override es una
 * preferencia de sesión del navegador (no un dato compartido entre
 * dispositivos ni usuarios, por eso vive en localStorage y no en una tabla —
 * ver businessOverrideStorage.ts), que supabaseClient.getActiveBusinessId()
 * y authService.getCurrentAccount() consultan en vez del business_id del
 * perfil cuando el usuario es supervisor_tecnico. Las políticas RLS (ver
 * 0007_fase3_roles_cafexis.sql) ya permiten que un supervisor lea y escriba
 * en cualquier negocio, así que esto es solo "a cuál apunta el frontend".
 */
import { supabase } from './supabaseClient'
import { mapBusiness } from './mappers'
import type { Business } from '@/types/domain'
import type { BusinessRow } from '@/types/database'

export { getBusinessOverride, setBusinessOverride } from './businessOverrideStorage'

/** Todos los negocios de la plataforma, para el selector del supervisor. RLS limita esto a su propio negocio para los demás roles. */
export async function listAllBusinesses(): Promise<Business[]> {
  const { data, error } = await supabase.from('businesses_cafexis').select('*').order('name').returns<BusinessRow[]>()

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapBusiness)
}
