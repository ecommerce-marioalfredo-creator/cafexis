import { useMemo } from 'react'
import { useAsync } from './useAsync'
import { listUsers } from '@/services/api/usersService'
import { useAuth } from '@/context/AuthContext'

/** Usuarios internos del negocio de la sesión activa. */
export function useUsers() {
  const { business, user: sessionUser } = useAuth()
  const businessId = business?.id ?? ''

  const { data, loading, error, reload } = useAsync(() => listUsers(businessId), [businessId])

  // El usuario que inició sesión (o se registró) siempre debe verse aunque
  // el mock de usuarios internos no lo tenga listado (caso de negocios
  // nuevos, cuyo único usuario vive en localStorage vía authService).
  const users = useMemo(() => {
    const fromMock = data ?? []
    if (sessionUser && !fromMock.some((u) => u.id === sessionUser.id)) {
      return [sessionUser, ...fromMock]
    }
    return fromMock
  }, [data, sessionUser])

  return { users, loading, error, reload }
}

/** Negocio de la sesión activa (demo o registrado), no el mock fijo. */
export function useBusiness() {
  const { business, loading } = useAuth()
  return { business, loading, error: undefined as string | undefined }
}
