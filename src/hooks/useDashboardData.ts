import { useAsync } from './useAsync'
import { getDashboardSummary } from '@/services/api/dashboardService'

export function useDashboardData() {
  return useAsync(getDashboardSummary, [])
}
