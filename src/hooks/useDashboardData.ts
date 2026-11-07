import { useAsync } from './useAsync'
import { getDashboardSummary } from '@/services/api/dashboardService'

/** Cada cuánto se actualiza solo todo lo que muestra el dashboard: resumen, comandas y alertas de cancelación. */
export const DASHBOARD_POLL_MS = 60_000

export function useDashboardData() {
  return useAsync(getDashboardSummary, [], { pollMs: DASHBOARD_POLL_MS })
}
