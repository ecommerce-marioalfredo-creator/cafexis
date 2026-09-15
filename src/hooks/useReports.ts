import { useAsync } from './useAsync'
import { listReportDefinitions } from '@/services/api/reportsService'

export function useReports() {
  const { data, loading, error, reload } = useAsync(listReportDefinitions, [])
  return { reports: data ?? [], loading, error, reload }
}
