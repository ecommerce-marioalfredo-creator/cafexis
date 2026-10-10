import { supabase, getActiveBusinessId } from './supabaseClient'
import { mapCoffeeLot } from './mappers'
import type { CoffeeLot, CoffeeLotInput } from '@/types/domain'
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

function toRowPayload(input: CoffeeLotInput) {
  return {
    code: input.code,
    variety: input.variety,
    process: input.process,
    origin_country: input.origin.country,
    origin_region: input.origin.region,
    origin_farm: input.origin.farm || null,
    story: input.story || null,
    quantity_kg: input.quantityKg,
    harvest_year: input.harvestYear,
  }
}

export async function createCoffeeLot(input: CoffeeLotInput): Promise<CoffeeLot> {
  const businessId = await getActiveBusinessId()

  const { data, error } = await supabase
    .from('coffee_lots_cafexis')
    .insert({ business_id: businessId, ...toRowPayload(input) })
    .select()
    .single<CoffeeLotRow>()

  if (error || !data) throw new Error(error?.message ?? 'No se pudo crear el lote.')
  return mapCoffeeLot(data)
}

export async function updateCoffeeLot(id: string, input: CoffeeLotInput): Promise<CoffeeLot> {
  const { data, error } = await supabase
    .from('coffee_lots_cafexis')
    .update(toRowPayload(input))
    .eq('id', id)
    .select()
    .single<CoffeeLotRow>()

  if (error || !data) throw new Error(error?.message ?? `Lote ${id} no encontrado.`)
  return mapCoffeeLot(data)
}
