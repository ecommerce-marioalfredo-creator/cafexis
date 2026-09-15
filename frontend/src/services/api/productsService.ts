import { delay } from './client'
import { products } from '@/services/mock/data'
import type { Product } from '@/types/domain'

export async function listProducts(): Promise<Product[]> {
  return delay([...products])
}
