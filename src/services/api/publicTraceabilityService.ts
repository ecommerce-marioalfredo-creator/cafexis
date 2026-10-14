/**
 * Trazabilidad pública de un lote de café (/trazabilidad/:lotId): la
 * página que abre el QR real, sin sesión.
 */
import { supabase } from './supabaseClient'
import { mapPublicCoffeeLot } from './mappers'
import type { PublicCoffeeLot } from '@/types/domain'
import type { PublicCoffeeLotRow } from '@/types/database'

export async function getPublicCoffeeLot(lotId: string): Promise<PublicCoffeeLot | undefined> {
  const { data, error } = await supabase.rpc('get_public_coffee_lot_cafexis', { p_lot_id: lotId })

  if (error) throw new Error(error.message)
  const row = (data as PublicCoffeeLotRow[] | null)?.[0]
  return row ? mapPublicCoffeeLot(row) : undefined
}
