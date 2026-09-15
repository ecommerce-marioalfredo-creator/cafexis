import { delay } from './client'
import { suppliers } from '@/services/mock/data'
import type { Supplier } from '@/types/domain'

export async function listSuppliers(): Promise<Supplier[]> {
  return delay([...suppliers])
}
