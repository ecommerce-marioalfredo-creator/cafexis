import { useAsync } from './useAsync'
import { listCoffeeLots } from '@/services/api/traceabilityService'

export function useTraceability() {
  const { data, loading, error, reload } = useAsync(listCoffeeLots, [])
  return { lots: data ?? [], loading, error, reload }
}
