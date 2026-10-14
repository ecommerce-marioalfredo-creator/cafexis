/**
 * Estado de suscripción de la plataforma (Fase 6). El administrador de un
 * negocio solo ve el suyo; el supervisor técnico ve y cambia el de
 * cualquiera — ver políticas de 0012_fase6_integraciones_cafexis.sql.
 */
import { supabase, getActiveBusinessId } from './supabaseClient'
import { mapBusinessSubscription, mapBusinessSubscriptionOverview } from './mappers'
import type { BusinessSubscription, BusinessSubscriptionOverview, SubscriptionStatus } from '@/types/domain'
import type { BusinessSubscriptionRow } from '@/types/database'

const SUBSCRIPTION_SELECT = '*, subscription_plans_cafexis(name)'

/** Estado de suscripción del negocio activo de la sesión. */
export async function getMySubscription(): Promise<BusinessSubscription | undefined> {
  const businessId = await getActiveBusinessId()

  const { data, error } = await supabase
    .from('business_subscriptions_cafexis')
    .select(SUBSCRIPTION_SELECT)
    .eq('business_id', businessId)
    .maybeSingle<BusinessSubscriptionRow>()

  if (error) throw new Error(error.message)
  return data ? mapBusinessSubscription(data) : undefined
}

/** Todos los negocios con su estado de suscripción (solo supervisor técnico). */
export async function listAllSubscriptions(): Promise<BusinessSubscriptionOverview[]> {
  const { data, error } = await supabase
    .from('business_subscriptions_cafexis')
    .select(`${SUBSCRIPTION_SELECT}, businesses_cafexis(name)`)
    .order('created_at', { ascending: false })
    .returns<BusinessSubscriptionRow[]>()

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapBusinessSubscriptionOverview)
}

/** Cambia el estado de suscripción de un negocio (solo supervisor técnico — RLS lo exige). */
export async function updateSubscriptionStatus(
  businessId: string,
  status: SubscriptionStatus,
  currentPeriodEndsAt?: string,
): Promise<void> {
  const { error } = await supabase
    .from('business_subscriptions_cafexis')
    .update({ status, current_period_ends_at: currentPeriodEndsAt ?? null })
    .eq('business_id', businessId)

  if (error) throw new Error(error.message)
}
