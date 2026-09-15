import { useAsync } from './useAsync'
import { listUsers, getBusiness } from '@/services/api/usersService'

export function useUsers() {
  const { data, loading, error, reload } = useAsync(listUsers, [])
  return { users: data ?? [], loading, error, reload }
}

export function useBusiness() {
  const { data, loading, error } = useAsync(getBusiness, [])
  return { business: data, loading, error }
}
