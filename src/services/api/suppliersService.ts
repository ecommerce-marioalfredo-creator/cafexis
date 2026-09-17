import { supabase, getActiveBusinessId } from './supabaseClient'
import { mapBusinessSupplier } from './mappers'
import type { Supplier } from '@/types/domain'
import type { BusinessSupplierRow } from '@/types/database'

export async function listSuppliers(): Promise<Supplier[]> {
  const businessId = await getActiveBusinessId()

  const { data, error } = await supabase
    .from('business_suppliers_cafexis')
    .select('*, suppliers_cafexis(*, supplier_branches_cafexis(*))')
    .eq('business_id', businessId)
    .returns<BusinessSupplierRow[]>()

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapBusinessSupplier)
}
