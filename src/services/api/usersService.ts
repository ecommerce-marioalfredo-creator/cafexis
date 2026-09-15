import { delay } from './client'
import { users, business } from '@/services/mock/data'
import type { AppUser, Business } from '@/types/domain'

export async function listUsers(): Promise<AppUser[]> {
  return delay([...users])
}

export async function getBusiness(): Promise<Business> {
  return delay(business)
}
