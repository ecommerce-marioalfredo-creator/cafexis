/**
 * Catálogo público de un negocio (/c/:slug): no requiere sesión. Usa las
 * funciones security definer de 0010_fase5_cliente_final_cafexis.sql en vez
 * de leer las tablas directamente — RLS normal exige ser empleado del
 * negocio, que un visitante anónimo nunca es.
 */
import { supabase } from './supabaseClient'
import { mapPublicBusiness, mapPublicProduct } from './mappers'
import type { PublicBusiness, PublicProduct } from '@/types/domain'
import type { PublicBusinessRow, PublicProductRow } from '@/types/database'

export async function getPublicBusiness(slug: string): Promise<PublicBusiness | undefined> {
  const { data, error } = await supabase.rpc('get_public_business_cafexis', { p_slug: slug })

  if (error) throw new Error(error.message)
  const row = (data as PublicBusinessRow[] | null)?.[0]
  return row ? mapPublicBusiness(row) : undefined
}

export async function getPublicCatalog(businessId: string): Promise<PublicProduct[]> {
  const { data, error } = await supabase.rpc('get_public_catalog_cafexis', { p_business_id: businessId })

  if (error) throw new Error(error.message)
  return ((data ?? []) as PublicProductRow[]).map(mapPublicProduct)
}
