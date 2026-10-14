import { useCallback } from 'react'
import { useAsync } from './useAsync'
import { getMySubscription, listAllSubscriptions, updateSubscriptionStatus } from '@/services/api/subscriptionService'
import type { SubscriptionStatus } from '@/types/domain'

/** Estado de suscripción del negocio activo de la sesión (Fase 6). */
export function useSubscription() {
  const { data, loading, error, reload } = useAsync(getMySubscription, [])
  return { subscription: data, loading, error, reload }
}

/** Para el supervisor técnico: todos los negocios con su estado de suscripción. */
export function useAllSubscriptions() {
  const { data, loading, error, reload } = useAsync(listAllSubscriptions, [])

  const updateStatus = useCallback(
    async (businessId: string, status: SubscriptionStatus, currentPeriodEndsAt?: string) => {
      await updateSubscriptionStatus(businessId, status, currentPeriodEndsAt)
      reload()
    },
    [reload],
  )

  return { subscriptions: data ?? [], loading, error, reload, updateStatus }
}
