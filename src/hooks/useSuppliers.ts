import { useAsync } from './useAsync'
import { listSuppliers } from '@/services/api/suppliersService'

export function useSuppliers() {
  const { data, loading, error, reload } = useAsync(listSuppliers, [])
  return { suppliers: data ?? [], loading, error, reload }
}
