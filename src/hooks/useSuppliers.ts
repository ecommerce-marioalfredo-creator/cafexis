import { useCallback } from 'react'
import { useAsync } from './useAsync'
import { listSuppliers, findSupplierByNit, addSupplier } from '@/services/api/suppliersService'
import type { SupplierInput } from '@/types/domain'

export function useSuppliers() {
  const { data, loading, error, reload } = useAsync(listSuppliers, [])

  const findByNit = useCallback((nit: string) => findSupplierByNit(nit), [])

  const add = useCallback(
    async (input: SupplierInput) => {
      await addSupplier(input)
      reload()
    },
    [reload],
  )

  return { suppliers: data ?? [], loading, error, reload, findByNit, add }
}
