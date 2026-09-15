import { useAsync } from './useAsync'
import { listProducts } from '@/services/api/productsService'

export function useProducts() {
  const { data, loading, error, reload } = useAsync(listProducts, [])
  return { products: data ?? [], loading, error, reload }
}
