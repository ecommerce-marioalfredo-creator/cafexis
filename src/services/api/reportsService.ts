import { delay } from './client'
import { reportDefinitions } from '@/services/mock/data'
import type { ReportDefinition } from '@/types/domain'

export async function listReportDefinitions(): Promise<ReportDefinition[]> {
  return delay([...reportDefinitions])
}
