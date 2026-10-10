import { useCallback } from 'react'
import { useAsync } from './useAsync'
import { listCoffeeLots, createCoffeeLot, updateCoffeeLot } from '@/services/api/traceabilityService'
import type { CoffeeLotInput } from '@/types/domain'

export function useTraceability() {
  const { data, loading, error, reload } = useAsync(listCoffeeLots, [])

  const create = useCallback(
    async (input: CoffeeLotInput) => {
      await createCoffeeLot(input)
      reload()
    },
    [reload],
  )

  const update = useCallback(
    async (id: string, input: CoffeeLotInput) => {
      await updateCoffeeLot(id, input)
      reload()
    },
    [reload],
  )

  return { lots: data ?? [], loading, error, reload, create, update }
}
