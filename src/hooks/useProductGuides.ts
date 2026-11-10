import { useCallback, useMemo } from 'react'
import { useAsync } from './useAsync'
import {
  createProductGuide,
  deleteProductGuide,
  listProductGuides,
  setProductGuideVisibility,
  updateProductGuide,
} from '@/services/api/productGuidesService'
import type { ProductGuide, ProductGuideInput } from '@/types/domain'

/** Videos y PDF de preparación del negocio activo, agrupados por producto. */
export function useProductGuides() {
  const { data, loading, error, reload } = useAsync(listProductGuides, [])
  const guides = useMemo(() => data ?? [], [data])

  const guidesByProductId = useMemo(() => {
    const map: Record<string, ProductGuide[]> = {}
    for (const guide of guides) (map[guide.productId] ??= []).push(guide)
    return map
  }, [guides])

  const create = useCallback(
    async (input: ProductGuideInput, file?: File) => {
      await createProductGuide(input, file)
      reload()
    },
    [reload],
  )

  const update = useCallback(
    async (guide: ProductGuide, input: ProductGuideInput, file?: File) => {
      await updateProductGuide(guide, input, file)
      reload()
    },
    [reload],
  )

  const setVisibility = useCallback(
    async (id: string, visibleToCustomers: boolean) => {
      await setProductGuideVisibility(id, visibleToCustomers)
      reload()
    },
    [reload],
  )

  const remove = useCallback(
    async (guide: ProductGuide) => {
      await deleteProductGuide(guide)
      reload()
    },
    [reload],
  )

  return { guides, guidesByProductId, loading, error, reload, create, update, setVisibility, remove }
}
