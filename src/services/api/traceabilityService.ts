import { supabase, getActiveBusinessId } from './supabaseClient'
import { mapCoffeeLot } from './mappers'
import type { CoffeeLot } from '@/types/domain'
import type { CoffeeLotRow } from '@/types/database'

export async function listCoffeeLots(): Promise<CoffeeLot[]> {
  const businessId = await getActiveBusinessId()

  const { data, error } = await supabase
    .from('coffee_lots_cafexis')
    .select('*')
    .eq('business_id', businessId)
    .order('harvest_year', { ascending: false })
    .returns<CoffeeLotRow[]>()

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapCoffeeLot)
}
