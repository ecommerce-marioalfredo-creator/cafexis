import { delay } from './client'
import { coffeeLots } from '@/services/mock/data'
import type { CoffeeLot } from '@/types/domain'

export async function listCoffeeLots(): Promise<CoffeeLot[]> {
  return delay([...coffeeLots])
}
