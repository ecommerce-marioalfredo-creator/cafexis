import { useCallback } from 'react'
import { useAsync } from './useAsync'
import {
  addSupportCaseMessage,
  getPlatformBusinessDetail,
  getPlatformOverview,
  getSupportCase,
  listSupportCases,
  listSupportStaff,
  openSupportCase,
  updateSupportCase,
} from '@/services/api/supportService'
import type { NewSupportCaseInput, SupportCasePriority, SupportCaseStatus } from '@/types/domain'

export function useSupportCases(filters: { businessId?: string; statuses?: SupportCaseStatus[]; assignedToMe?: boolean } = {}) {
  const { data, loading, error, reload } = useAsync(
    () => listSupportCases(filters),
    [filters.businessId, (filters.statuses ?? []).join(','), filters.assignedToMe],
  )

  const open = useCallback(
    async (input: NewSupportCaseInput) => {
      const id = await openSupportCase(input)
      reload()
      return id
    },
    [reload],
  )

  return { cases: data ?? [], loading, error, reload, open }
}

export function useSupportCase(caseId: string) {
  const { data, loading, error, reload } = useAsync(() => getSupportCase(caseId), [caseId])

  const reply = useCallback(
    async (body: string, internal = false) => {
      await addSupportCaseMessage(caseId, body, internal)
      reload()
    },
    [caseId, reload],
  )

  const update = useCallback(
    async (changes: { status?: SupportCaseStatus; priority?: SupportCasePriority; assignedTo?: string | null }) => {
      await updateSupportCase(caseId, changes)
      reload()
    },
    [caseId, reload],
  )

  return { supportCase: data, loading, error, reload, reply, update }
}

export function useSupportStaff(enabled: boolean) {
  const { data } = useAsync(() => (enabled ? listSupportStaff() : Promise.resolve([])), [enabled])
  return data ?? []
}

export function usePlatformOverview() {
  const { data, loading, error, reload } = useAsync(getPlatformOverview, [])
  return { businesses: data ?? [], loading, error, reload }
}

export function usePlatformBusinessDetail(businessId: string) {
  const { data, loading, error, reload } = useAsync(() => getPlatformBusinessDetail(businessId), [businessId])
  return { detail: data, loading, error, reload }
}
