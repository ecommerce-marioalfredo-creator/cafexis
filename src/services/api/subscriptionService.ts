/**
 * Planes y suscripción de cada negocio a Cafexis (0012 y 0019). El personal
 * ve el plan de su negocio; el supervisor técnico ve y cambia el de
 * cualquiera — ver políticas de 0012_fase6_integraciones_cafexis.sql.
 */
import { supabase, getActiveBusinessId } from './supabaseClient'
import { openSupportCase } from './supportService'
import { FALLBACK_PLANS, PLAN_NAME, PLAN_ORDER } from '@/components/plan/planCatalog'
import type {
  BillingPeriod,
  BusinessPlan,
  BusinessSubscriptionOverview,
  PlanChangeResult,
  PlanCode,
  PlanFeature,
  SubscriptionPlan,
  SubscriptionUpdate,
} from '@/types/domain'
import type { BusinessPlanRow, BusinessSubscriptionRow, SubscriptionPlanRow } from '@/types/database'

const isPlanCode = (code: unknown): code is PlanCode => PLAN_ORDER.includes(code as PlanCode)

const toPlanCode = (code: unknown, fallback: PlanCode): PlanCode => (isPlanCode(code) ? code : fallback)

const ALL_FEATURES = FALLBACK_PLANS.find((p) => p.code === 'premium')!.features

/** La RPC aún no existe (migración 0019 sin aplicar). */
const isMissingFunction = (error: { code?: string; message: string }) =>
  error.code === 'PGRST202' || error.code === '42883' || /could not find the function/i.test(error.message)

function mapPlan(row: SubscriptionPlanRow): SubscriptionPlan | undefined {
  if (!isPlanCode(row.code)) return undefined
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description ?? '',
    monthlyPrice: row.price_cents / 100,
    annualPrice: (row.price_annual_cents ?? 0) / 100,
    trialDays: row.trial_days,
    features: (row.features ?? []) as PlanFeature[],
    limits: row.limits ?? {},
    recommended: row.recommended ?? false,
  }
}

/** Planes a la venta, de Básica a Premium. Sin la 0019 devuelve los de planCatalog (sin id real). */
export async function listPlans(): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase
    .from('subscription_plans_cafexis')
    .select('*')
    .eq('active', true)
    .returns<SubscriptionPlanRow[]>()

  if (error) throw new Error(error.message)
  const plans = (data ?? []).map(mapPlan).filter((p): p is SubscriptionPlan => Boolean(p))
  if (plans.length === 0) return FALLBACK_PLANS
  return plans.sort((a, b) => PLAN_ORDER.indexOf(a.code) - PLAN_ORDER.indexOf(b.code))
}

function mapBusinessPlan(row: BusinessPlanRow): BusinessPlan {
  const effectivePlanCode = toPlanCode(row.effective_plan_code, 'basica')
  const planCode = toPlanCode(row.plan_code, effectivePlanCode)
  const status = row.status ?? 'activa'
  return {
    businessId: row.business_id,
    status,
    trialEndsAt: row.trial_ends_at ?? undefined,
    currentPeriodEndsAt: row.current_period_ends_at ?? undefined,
    planCode,
    planName: row.plan_name,
    effectivePlanCode,
    effectivePlanName: row.effective_plan_name,
    features: (row.features ?? []) as PlanFeature[],
    limits: row.limits ?? {},
    addons: (row.addons ?? []) as PlanFeature[],
    usage: row.usage,
    isActive: status !== 'cancelada',
    lapsed: planCode !== effectivePlanCode,
    legacy: false,
    billingPeriod: row.billing_period ?? 'mensual',
    pendingChange:
      row.pending && isPlanCode(row.pending.plan_code)
        ? {
            planCode: row.pending.plan_code,
            planName: row.pending.plan_name,
            billingPeriod: row.pending.billing_period,
            requestedAt: row.pending.requested_at,
            caseId: row.pending.case_id ?? undefined,
          }
        : undefined,
  }
}

/**
 * Sin la migración 0019 no hay planes: el negocio sigue con todo el sistema,
 * como antes, y solo se bloquea si la suscripción venció (regla de la 0012).
 */
async function legacyBusinessPlan(businessId: string): Promise<BusinessPlan> {
  const { data } = await supabase
    .from('business_subscriptions_cafexis')
    .select('status, trial_ends_at, current_period_ends_at')
    .eq('business_id', businessId)
    .maybeSingle<Pick<BusinessSubscriptionRow, 'status' | 'trial_ends_at' | 'current_period_ends_at'>>()

  const now = Date.now()
  const status = data?.status ?? 'activa'
  const current =
    !data ||
    (status === 'trial' && (!data.trial_ends_at || new Date(data.trial_ends_at).getTime() > now)) ||
    (status === 'activa' && (!data.current_period_ends_at || new Date(data.current_period_ends_at).getTime() > now))

  return {
    businessId,
    status,
    trialEndsAt: data?.trial_ends_at ?? undefined,
    currentPeriodEndsAt: data?.current_period_ends_at ?? undefined,
    planCode: 'premium',
    planName: PLAN_NAME.premium,
    effectivePlanCode: 'premium',
    effectivePlanName: PLAN_NAME.premium,
    features: ALL_FEATURES,
    limits: {},
    addons: [],
    usage: { usuarios: 0, productos: 0, insumos: 0 },
    isActive: current,
    lapsed: false,
    legacy: true,
    billingPeriod: 'mensual',
  }
}

/** Plan con el que opera el negocio activo de la sesión (o el que opera el supervisor). */
export async function getBusinessPlan(): Promise<BusinessPlan> {
  const businessId = await getActiveBusinessId()
  const { data, error } = await supabase.rpc('get_business_plan_cafexis', { p_business_id: businessId })

  if (error) {
    if (isMissingFunction(error)) return legacyBusinessPlan(businessId)
    throw new Error(error.message)
  }
  return mapBusinessPlan(data as BusinessPlanRow)
}

/** Todos los negocios con su plan y estado (solo supervisor técnico). */
export async function listAllSubscriptions(): Promise<BusinessSubscriptionOverview[]> {
  const { data, error } = await supabase
    .from('business_subscriptions_cafexis')
    .select('*, subscription_plans_cafexis(*), businesses_cafexis(name)')
    .order('created_at', { ascending: false })
    .returns<BusinessSubscriptionRow[]>()

  if (error) throw new Error(error.message)
  return (data ?? [])
    .map((row) => {
      const plan = row.subscription_plans_cafexis
      return {
        businessId: row.business_id,
        businessName: row.businesses_cafexis?.name ?? '',
        planId: row.plan_id,
        planCode: isPlanCode(plan?.code) ? plan.code : undefined,
        planName: plan?.name,
        status: row.status,
        trialEndsAt: row.trial_ends_at ?? undefined,
        currentPeriodEndsAt: row.current_period_ends_at ?? undefined,
        addons: (row.addons ?? []) as PlanFeature[],
        pendingPlanId: row.pending_plan_id ?? undefined,
        pendingBillingPeriod: row.pending_billing_period ?? undefined,
        pendingRequestedAt: row.pending_requested_at ?? undefined,
      }
    })
    .sort((a, b) => a.businessName.localeCompare(b.businessName, 'es'))
}

/** Cambia plan, estado, vencimiento o complementos de un negocio (solo supervisor técnico — RLS lo exige). */
export async function updateSubscription(businessId: string, changes: SubscriptionUpdate): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (changes.planId !== undefined) patch.plan_id = changes.planId
  if (changes.status !== undefined) patch.status = changes.status
  if (changes.currentPeriodEndsAt !== undefined) patch.current_period_ends_at = changes.currentPeriodEndsAt
  if (changes.addons !== undefined) patch.addons = changes.addons

  const { data, error } = await supabase
    .from('business_subscriptions_cafexis')
    .update(patch)
    .eq('business_id', businessId)
    .select('business_id')

  if (error) throw new Error(error.message)
  // RLS no da error al negar un update: simplemente no cambia ninguna fila.
  if (!data || data.length === 0) throw new Error('No tienes permiso para cambiar esta suscripción.')
}

/**
 * Cambia el plan del negocio (0020). Bajar a Básica, o cualquier cambio del
 * supervisor técnico, se aplica al instante; un plan pago pedido por el
 * administrador queda pendiente de cobro, con un caso de soporte para
 * coordinarlo. Cuando esté la cuenta de Wompi, el cobro reemplazará ese paso.
 */
export async function changePlan(input: {
  businessId: string
  businessName: string
  currentPlanName: string
  plan: SubscriptionPlan
  billing: BillingPeriod
  asSupervisor: boolean
}): Promise<PlanChangeResult> {
  const { data, error } = await supabase.rpc('change_business_plan_cafexis', {
    p_plan_code: input.plan.code,
    p_billing_period: input.billing,
    p_business_id: input.businessId,
  })

  if (!error) {
    const result = data as { applied: boolean; plan_name: string; case_id?: string | null; period_ends_at?: string | null }
    return {
      applied: result.applied,
      planName: result.plan_name,
      caseId: result.case_id ?? undefined,
      periodEndsAt: result.period_ends_at ?? undefined,
    }
  }
  if (!isMissingFunction(error)) throw new Error(error.message)

  // Sin la migración 0020: el supervisor cambia la fila directamente y el
  // administrador deja la solicitud en un caso de soporte.
  if (input.asSupervisor) {
    await updateSubscription(input.businessId, { planId: input.plan.id, status: 'activa' })
    return { applied: true, planName: input.plan.name }
  }
  const caseId = await requestPlanChange({ ...input, currentPlan: input.currentPlanName })
  return { applied: false, planName: input.plan.name, caseId }
}

/** Retira la solicitud pendiente: la cancela quien administra o la rechaza el supervisor técnico. */
export async function cancelPlanChange(businessId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_plan_change_cafexis', { p_business_id: businessId })
  if (error) throw new Error(error.message)
}

/** Respaldo sin la 0020: la solicitud va solo como caso de soporte. Devuelve el id del caso. */
async function requestPlanChange(input: {
  businessName: string
  currentPlan: string
  plan: SubscriptionPlan
  billing: BillingPeriod
}): Promise<string> {
  const { plan, billing } = input
  const price = billing === 'anual' ? plan.annualPrice : plan.monthlyPrice
  const priceLabel = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(
    price,
  )
  return openSupportCase({
    subject: `Cambio de plan a ${plan.name}`,
    description: [
      `${input.businessName} quiere pasar del plan ${input.currentPlan} al plan ${plan.name}.`,
      plan.monthlyPrice > 0 ? `Forma de pago: ${billing} (${priceLabel} ${billing === 'anual' ? 'al año' : 'al mes'}).` : '',
      'Solicitud enviada desde Suscripción.',
    ]
      .filter(Boolean)
      .join('\n'),
    category: 'cuenta',
    priority: 'media',
  })
}
