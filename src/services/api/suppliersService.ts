import { supabase, getActiveBusinessId } from './supabaseClient'
import { mapSupplier, mapBusinessSupplier } from './mappers'
import type { Supplier, SupplierInput } from '@/types/domain'
import type { BusinessSupplierRow, SupplierRow, SupplierBranchRow } from '@/types/database'

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

/**
 * Busca un proveedor del directorio compartido por su NIT exacto. El
 * directorio es compartido entre negocios (suppliers_cafexis.nit es unique,
 * ver 0001_schema_cafexis.sql), así que si ya existe se debe reutilizar en
 * vez de crear uno nuevo.
 */
export async function findSupplierByNit(nit: string): Promise<Supplier | undefined> {
  const { data, error } = await supabase
    .from('suppliers_cafexis')
    .select('*, supplier_branches_cafexis(*)')
    .eq('nit', nit.trim())
    .maybeSingle<SupplierRow & { supplier_branches_cafexis?: SupplierBranchRow[] }>()

  if (error) throw new Error(error.message)
  if (!data) return undefined
  return mapSupplier(data, data.supplier_branches_cafexis ?? [])
}

/** Crea un proveedor nuevo (con sus sucursales) y lo liga al negocio activo. */
async function createSupplier(input: SupplierInput): Promise<Supplier> {
  const { data, error } = await supabase
    .from('suppliers_cafexis')
    .insert({ nit: input.nit.trim(), name: input.name.trim(), location: input.location.trim() })
    .select()
    .single<SupplierRow>()

  if (error || !data) throw new Error(error?.message ?? 'No se pudo crear el proveedor.')

  const branches = input.branches.map((b) => b.trim()).filter(Boolean)
  if (branches.length > 0) {
    const { error: branchError } = await supabase
      .from('supplier_branches_cafexis')
      .insert(branches.map((branch_name) => ({ supplier_id: data.id, branch_name })))
    if (branchError) throw new Error(branchError.message)
  }

  return mapSupplier(data, branches.map((branch_name) => ({ id: '', supplier_id: data.id, branch_name })))
}

async function linkSupplierToBusiness(supplierId: string): Promise<void> {
  const businessId = await getActiveBusinessId()
  const { error } = await supabase
    .from('business_suppliers_cafexis')
    .upsert({ business_id: businessId, supplier_id: supplierId }, { onConflict: 'business_id,supplier_id' })

  if (error) throw new Error(error.message)
}

/**
 * Da de alta un proveedor para el negocio activo, reutilizando el existente
 * si el NIT ya está registrado en el directorio compartido en vez de
 * duplicarlo.
 */
export async function addSupplier(input: SupplierInput): Promise<Supplier> {
  const existing = await findSupplierByNit(input.nit)
  const supplier = existing ?? (await createSupplier(input))
  await linkSupplierToBusiness(supplier.id)
  return supplier
}
