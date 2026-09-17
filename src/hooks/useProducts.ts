import { useCallback } from 'react'
import { useAsync } from './useAsync'
import { listProducts, createProduct, updateProduct } from '@/services/api/productsService'
import type { Product } from '@/types/domain'

export function useProducts() {
  const { data, loading, error, reload } = useAsync(listProducts, [])

  const create = useCallback(
    async (input: Omit<Product, 'id'>) => {
      await createProduct(input)
      reload()
    },
    [reload],
  )

  const update = useCallback(
    async (id: string, input: Omit<Product, 'id'>) => {
      await updateProduct(id, input)
      reload()
    },
    [reload],
  )

  return { products: data ?? [], loading, error, reload, create, update }
}
