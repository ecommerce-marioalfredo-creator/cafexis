/**
 * Catálogo público de un negocio (/c/:slug): no requiere sesión. Usa las
 * funciones security definer de 0010_fase5_cliente_final_cafexis.sql en vez
 * de leer las tablas directamente — RLS normal exige ser empleado del
 * negocio, que un visitante anónimo nunca es.
 */
import { supabase } from './supabaseClient'
import { mapPublicBusiness, mapPublicProduct } from './mappers'
import type { PlanFeature, PublicBusiness, PublicProduct } from '@/types/domain'
import type { PublicBusinessRow, PublicProductRow } from '@/types/database'

export async function getPublicBusiness(slug: string): Promise<PublicBusiness | undefined> {
  const { data, error } = await supabase.rpc('get_public_business_cafexis', { p_slug: slug })

  if (error) throw new Error(error.message)
  const row = (data as PublicBusinessRow[] | null)?.[0]
  return row ? mapPublicBusiness(row) : undefined
}

/**
 * Funciones del plan del negocio (0019), para que el catálogo se muestre con
 * carrito o solo como menú. undefined si la migración aún no está aplicada:
 * el catálogo sigue como antes, con todo.
 */
export async function getPublicPlanFeatures(businessId: string): Promise<PlanFeature[] | undefined> {
  const { data, error } = await supabase.rpc('get_public_plan_features_cafexis', { p_business_id: businessId })

  if (error) {
    if (error.code === 'PGRST202' || /could not find the function/i.test(error.message)) return undefined
    throw new Error(error.message)
  }
  return (data ?? []) as PlanFeature[]
}

export async function getPublicCatalog(businessId: string): Promise<PublicProduct[]> {
  const { data, error } = await supabase.rpc('get_public_catalog_cafexis', { p_business_id: businessId })

  if (error) throw new Error(error.message)
  return ((data ?? []) as PublicProductRow[]).map(mapPublicProduct)
}
