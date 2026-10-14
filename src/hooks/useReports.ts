import { useCallback } from 'react'
import { useAsync } from './useAsync'
import {
  listReportDefinitions,
  createCustomReport,
  updateCustomReport,
  deleteCustomReport,
  getReplenishmentProjection,
} from '@/services/api/reportsService'
import type { ReportDefinitionInput } from '@/types/domain'

export function useReports() {
  const { data, loading, error, reload } = useAsync(listReportDefinitions, [])

  const create = useCallback(
    async (input: ReportDefinitionInput) => {
      await createCustomReport(input)
      reload()
    },
    [reload],
  )

  const update = useCallback(
    async (id: string, input: ReportDefinitionInput) => {
      await updateCustomReport(id, input)
      reload()
    },
    [reload],
  )

  const remove = useCallback(
    async (id: string) => {
      await deleteCustomReport(id)
      reload()
    },
    [reload],
  )

  return { reports: data ?? [], loading, error, reload, create, update, remove }
}

/** `version` fuerza recalcular cuando cambia algo externo (ej. las órdenes de compra). */
export function useReplenishment(windowDays: number, coverDays: number, version = '') {
  const { data, loading, error, reload } = useAsync(
    () => getReplenishmentProjection(windowDays, coverDays),
    [windowDays, coverDays, version],
  )
  return { projection: data ?? [], loading, error, reload }
}
