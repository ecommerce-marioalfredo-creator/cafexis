import { useAsync } from './useAsync'
import { ORDERS_POLL_MS } from './useOrders'
import { getDashboardSummary } from '@/services/api/dashboardService'

export function useDashboardData() {
  return useAsync(getDashboardSummary, [], { pollMs: ORDERS_POLL_MS })
}
