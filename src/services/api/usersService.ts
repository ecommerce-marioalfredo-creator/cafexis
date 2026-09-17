import { supabase } from './supabaseClient'
import { mapAppUser } from './mappers'
import type { AppUser } from '@/types/domain'
import type { AppUserRow } from '@/types/database'

export async function listUsers(businessId: string): Promise<AppUser[]> {
  const { data, error } = await supabase
    .from('app_users_cafexis')
    .select('*')
    .eq('business_id', businessId)
    .returns<AppUserRow[]>()

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapAppUser)
}
