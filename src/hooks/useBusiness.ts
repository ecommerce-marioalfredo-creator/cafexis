import { useCallback, useMemo } from 'react'
import { useAsync } from './useAsync'
import { listUsers, listInvitations, inviteUser, updateUserRole, setUserActive } from '@/services/api/usersService'
import { useAuth } from '@/context/AuthContext'
import type { InvitableRole, UserRole } from '@/types/domain'

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

  const invite = useCallback(
    async (input: { email: string; name: string; role: InvitableRole }) => {
      await inviteUser(input)
      reload()
    },
    [reload],
  )

  const updateRole = useCallback(
    async (userId: string, role: UserRole) => {
      await updateUserRole(userId, role)
      reload()
    },
    [reload],
  )

  const setActive = useCallback(
    async (userId: string, active: boolean) => {
      await setUserActive(userId, active)
      reload()
    },
    [reload],
  )

  return { users, loading, error, reload, invite, updateRole, setActive }
}

/** Invitaciones pendientes del negocio de la sesión activa. */
export function useInvitations() {
  const { business } = useAuth()
  const businessId = business?.id ?? ''

  const { data, loading, error, reload } = useAsync(() => listInvitations(businessId), [businessId])
  return { invitations: data ?? [], loading, error, reload }
}

/** Negocio de la sesión activa (demo o registrado), no el mock fijo. */
export function useBusiness() {
  const { business, loading } = useAuth()
  return { business, loading, error: undefined as string | undefined }
}
