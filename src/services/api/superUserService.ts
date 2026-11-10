/**
 * Panel del super usuario (rol supervisor_tecnico) y códigos de promoción,
 * de 0021_super_usuario_promociones_cafexis.sql.
 *
 * - Todos los negocios con su suscripción y sus usuarios: RPC
 *   platform_subscriptions_overview_cafexis (lee el último ingreso de
 *   auth.users, que el navegador no puede leer).
 * - Suscripciones y planes: update directo; la RLS de 0012 y 0021 solo deja
 *   escribir al supervisor técnico, y un trigger valida los planes.
 * - Códigos: tabla promo_codes_cafexis (solo el supervisor la lee y escribe).
 *   El canje pasa siempre por redeem_promo_code_cafexis, que aplica el
 *   beneficio y deja el registro.
 */
import { supabase, getActiveBusinessId } from './supabaseClient'
import { PLAN_ORDER } from '@/components/plan/planCatalog'
import type {
  AdminPlan,
  AdminPlanUpdate,
  BillingPeriod,
  BusinessPromoStatus,
  BusinessType,
  PlanCode,
  PlanFeature,
  PlanLimit,
  PlatformAccount,
  PromoBenefit,
  PromoCode,
  PromoCodeInput,
  PromoRedeemResult,
  PromoRedemption,
  SubscriptionAdminUpdate,
  SubscriptionStatus,
  UserRole,
} from '@/types/domain'

export const MIGRATION_0021 = '0021_super_usuario_promociones_cafexis.sql'

const MISSING_0021 = `Falta aplicar la migración ${MIGRATION_0021} en Supabase (SQL Editor). Sin ella no hay panel de super usuario ni códigos de promoción.`

/** La RPC, la tabla o la columna aún no existen: la 0021 no está aplicada. */
function isMissingSchema(error: { code?: string; message: string }): boolean {
  return (
    error.code === 'PGRST202' ||
    error.code === 'PGRST205' ||
    error.code === '42883' ||
    error.code === '42P01' ||
    error.code === '42703' ||
    /could not find the (function|table)|does not exist|schema cache/i.test(error.message)
  )
}

function fail(error: { code?: string; message: string }): never {
  throw new Error(isMissingSchema(error) ? MISSING_0021 : error.message)
}

const optional = <T,>(value: T | null | undefined): T | undefined => (value === null ? undefined : value)

const isPlanCode = (code: unknown): code is PlanCode => PLAN_ORDER.includes(code as PlanCode)

// --- Negocios, suscripciones y usuarios ------------------------------------

interface AccountRaw {
  id: string
  name: string
  type: BusinessType
  slug: string | null
  primary_color: string
  created_at: string
  subscription: {
    plan_id: string
    plan_code: string | null
    plan_name: string | null
    effective_plan_code: string
    status: SubscriptionStatus
    billing_period: BillingPeriod | null
    trial_ends_at: string | null
    current_period_ends_at: string | null
    addons: string[] | null
    discount_percent: number | null
    discount_ends_at: string | null
    discount_code: string | null
    pending_plan_id: string | null
    pending_billing_period: BillingPeriod | null
    pending_requested_at: string | null
    pending_case_id: string | null
    updated_at: string
  } | null
  usage: { usuarios: number; productos: number; insumos: number; clientes: number }
  users: Array<{
    id: string
    name: string
    email: string
    role: UserRole
    active: boolean
    created_at: string
    last_sign_in_at: string | null
  }>
  invitations: Array<{ id: string; name: string; email: string; role: UserRole; created_at: string }>
  redemptions: Array<{ code: string; summary: string; by_platform: boolean; created_at: string }>
}

function mapAccount(row: AccountRaw): PlatformAccount {
  const s = row.subscription
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    slug: optional(row.slug),
    primaryColor: row.primary_color,
    createdAt: row.created_at,
    subscription: s
      ? {
          planId: s.plan_id,
          planCode: isPlanCode(s.plan_code) ? s.plan_code : undefined,
          planName: optional(s.plan_name),
          effectivePlanCode: isPlanCode(s.effective_plan_code) ? s.effective_plan_code : 'basica',
          status: s.status,
          billingPeriod: s.billing_period ?? 'mensual',
          trialEndsAt: optional(s.trial_ends_at),
          currentPeriodEndsAt: optional(s.current_period_ends_at),
          addons: (s.addons ?? []) as PlanFeature[],
          discountPercent: optional(s.discount_percent),
          discountEndsAt: optional(s.discount_ends_at),
          discountCode: optional(s.discount_code),
          pendingPlanId: optional(s.pending_plan_id),
          pendingBillingPeriod: optional(s.pending_billing_period),
          pendingRequestedAt: optional(s.pending_requested_at),
          pendingCaseId: optional(s.pending_case_id),
          updatedAt: s.updated_at,
        }
      : undefined,
    usage: {
      usuarios: Number(row.usage.usuarios),
      productos: Number(row.usage.productos),
      insumos: Number(row.usage.insumos),
      clientes: Number(row.usage.clientes),
    },
    users: row.users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
      createdAt: u.created_at,
      lastSignInAt: optional(u.last_sign_in_at),
    })),
    invitations: row.invitations.map((i) => ({
      id: i.id,
      name: i.name,
      email: i.email,
      role: i.role,
      createdAt: i.created_at,
    })),
    redemptions: row.redemptions.map((r) => ({
      code: r.code,
      summary: r.summary,
      byPlatform: r.by_platform,
      createdAt: r.created_at,
    })),
  }
}

/** Todos los negocios con su suscripción, uso, usuarios e invitaciones (solo supervisor técnico). */
export async function listPlatformAccounts(): Promise<PlatformAccount[]> {
  const { data, error } = await supabase.rpc('platform_subscriptions_overview_cafexis')
  if (error) fail(error)
  return ((data ?? []) as AccountRaw[]).map(mapAccount)
}

/** Cambia cualquier dato de la suscripción de un negocio (solo supervisor técnico; la RLS lo exige). */
export async function updateAccountSubscription(businessId: string, changes: SubscriptionAdminUpdate): Promise<void> {
  const patch: Record<string, unknown> = {
    plan_id: changes.planId,
    status: changes.status,
    billing_period: changes.billingPeriod,
    trial_ends_at: changes.trialEndsAt,
    current_period_ends_at: changes.currentPeriodEndsAt,
    addons: changes.addons,
    discount_percent: changes.discountPercent,
    discount_ends_at: changes.discountPercent === null ? null : changes.discountEndsAt,
  }
  // Sin descuento tampoco queda el código que lo dio (lo exige un check de la 0021).
  if (changes.discountPercent === null) patch.discount_promo_code_id = null

  const { data, error } = await supabase
    .from('business_subscriptions_cafexis')
    .update(patch)
    .eq('business_id', businessId)
    .select('business_id')

  if (error) fail(error)
  // RLS no da error al negar un update: simplemente no cambia ninguna fila.
  if (!data || data.length === 0) throw new Error('No tienes permiso para cambiar esta suscripción.')
}

// --- Planes ----------------------------------------------------------------

interface PlanRaw {
  id: string
  code: string | null
  name: string
  description: string | null
  price_cents: number
  price_annual_cents: number | null
  trial_days: number
  features: string[] | null
  limits: Record<string, number> | null
  recommended: boolean | null
  sort_order: number | null
  active: boolean
}

/** Todos los planes, también los que no están a la venta, de Básica a Premium. */
export async function listAdminPlans(): Promise<AdminPlan[]> {
  const { data, error } = await supabase.from('subscription_plans_cafexis').select('*').returns<PlanRaw[]>()
  if (error) fail(error)
  return (data ?? [])
    .filter((row): row is PlanRaw & { code: PlanCode } => isPlanCode(row.code))
    .map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description ?? '',
      monthlyPrice: row.price_cents / 100,
      annualPrice: (row.price_annual_cents ?? 0) / 100,
      trialDays: row.trial_days,
      features: (row.features ?? []) as PlanFeature[],
      limits: (row.limits ?? {}) as Partial<Record<PlanLimit, number>>,
      recommended: row.recommended ?? false,
      active: row.active,
      sortOrder: row.sort_order ?? PLAN_ORDER.indexOf(row.code),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

/** Guarda un plan. Si queda como recomendado, los demás dejan de serlo. */
export async function updateAdminPlan(planId: string, changes: AdminPlanUpdate): Promise<void> {
  const { data, error } = await supabase
    .from('subscription_plans_cafexis')
    .update({
      name: changes.name,
      description: changes.description,
      price_cents: Math.round(changes.monthlyPrice * 100),
      price_annual_cents: Math.round(changes.annualPrice * 100),
      trial_days: changes.trialDays,
      features: changes.features,
      limits: changes.limits,
      recommended: changes.recommended,
      active: changes.active,
    })
    .eq('id', planId)
    .select('id')

  if (error) fail(error)
  if (!data || data.length === 0) {
    throw new Error(`No tienes permiso para editar los planes (¿aplicaste la ${MIGRATION_0021}?).`)
  }

  if (changes.recommended) {
    const { error: othersError } = await supabase
      .from('subscription_plans_cafexis')
      .update({ recommended: false })
      .neq('id', planId)
      .eq('recommended', true)
    if (othersError) fail(othersError)
  }
}

// --- Códigos de promoción --------------------------------------------------

interface PromoRaw {
  id: string
  code: string
  description: string | null
  benefit: PromoBenefit
  plan_id: string | null
  free_days: number | null
  discount_percent: number | null
  discount_months: number | null
  expires_at: string
  max_redemptions: number | null
  active: boolean
  created_at: string
  promo_code_redemptions_cafexis: Array<{
    business_id: string
    code: string
    summary: string
    by_platform: boolean
    created_at: string
    businesses_cafexis: { name: string } | null
  }> | null
}

function mapRedemption(r: NonNullable<PromoRaw['promo_code_redemptions_cafexis']>[number]): PromoRedemption {
  return {
    businessId: r.business_id,
    businessName: r.businesses_cafexis?.name ?? '',
    code: r.code,
    summary: r.summary,
    byPlatform: r.by_platform,
    createdAt: r.created_at,
  }
}

function mapPromo(row: PromoRaw): PromoCode {
  return {
    id: row.id,
    code: row.code,
    description: optional(row.description),
    benefit: row.benefit,
    planId: optional(row.plan_id),
    freeDays: optional(row.free_days),
    discountPercent: optional(row.discount_percent),
    discountMonths: optional(row.discount_months),
    expiresAt: row.expires_at,
    maxRedemptions: optional(row.max_redemptions),
    active: row.active,
    createdAt: row.created_at,
    redemptions: (row.promo_code_redemptions_cafexis ?? [])
      .map(mapRedemption)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  }
}

/** Todos los códigos, los más nuevos primero, con quién los usó. */
export async function listPromoCodes(): Promise<PromoCode[]> {
  const { data, error } = await supabase
    .from('promo_codes_cafexis')
    .select('*, promo_code_redemptions_cafexis(business_id, code, summary, by_platform, created_at, businesses_cafexis(name))')
    .order('created_at', { ascending: false })
    .returns<PromoRaw[]>()
  if (error) fail(error)
  return (data ?? []).map(mapPromo)
}

/** Mayúsculas, sin espacios: así lo guarda también la base de datos. */
export const normalizePromoCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, '')

function toPromoRow(input: PromoCodeInput) {
  const days = input.benefit === 'dias_gratis'
  return {
    code: normalizePromoCode(input.code),
    description: input.description?.trim() || null,
    benefit: input.benefit,
    plan_id: input.planId || null,
    free_days: days ? (input.freeDays ?? null) : null,
    discount_percent: days ? null : (input.discountPercent ?? null),
    discount_months: days ? null : (input.discountMonths ?? null),
    expires_at: input.expiresAt,
    max_redemptions: input.maxRedemptions ?? null,
    active: input.active,
  }
}

/** Traduce los errores de la base de datos a algo que se entienda en el formulario. */
function promoError(error: { code?: string; message: string }): never {
  if (error.code === '23505') throw new Error('Ya existe un código con ese nombre. Elige otro.')
  if (error.code === '23514' && /code_check|promo_codes_cafexis_code/i.test(error.message)) {
    throw new Error('El código debe tener de 3 a 40 caracteres: letras sin tilde, números, guion o guion bajo.')
  }
  if (error.code === '23503') throw new Error('Ese código ya se usó: no se puede borrar, pero sí desactivar.')
  fail(error)
}

export async function createPromoCode(input: PromoCodeInput): Promise<void> {
  const { error } = await supabase.from('promo_codes_cafexis').insert(toPromoRow(input))
  if (error) promoError(error)
}

export async function updatePromoCode(id: string, input: PromoCodeInput): Promise<void> {
  const { data, error } = await supabase.from('promo_codes_cafexis').update(toPromoRow(input)).eq('id', id).select('id')
  if (error) promoError(error)
  if (!data || data.length === 0) throw new Error('No tienes permiso para cambiar este código.')
}

export async function setPromoCodeActive(id: string, active: boolean): Promise<void> {
  const { data, error } = await supabase.from('promo_codes_cafexis').update({ active }).eq('id', id).select('id')
  if (error) promoError(error)
  if (!data || data.length === 0) throw new Error('No tienes permiso para cambiar este código.')
}

/** Solo códigos que nadie ha usado; los usados se desactivan. */
export async function deletePromoCode(id: string): Promise<void> {
  const { data, error } = await supabase.from('promo_codes_cafexis').delete().eq('id', id).select('id')
  if (error) promoError(error)
  if (!data || data.length === 0) throw new Error('No tienes permiso para borrar este código.')
}

/**
 * Canjea un código. Sin businessId, para el negocio de la sesión (el
 * administrador desde Suscripción); con él, el supervisor lo aplica a
 * cualquier negocio.
 */
export async function redeemPromoCode(code: string, businessId?: string): Promise<PromoRedeemResult> {
  const { data, error } = await supabase.rpc('redeem_promo_code_cafexis', {
    p_code: normalizePromoCode(code),
    p_business_id: businessId ?? null,
  })
  if (error) fail(error)
  const r = data as { code: string; benefit: PromoBenefit; summary: string; plan_name: string | null; ends_at: string | null }
  return { code: r.code, benefit: r.benefit, summary: r.summary, planName: optional(r.plan_name), endsAt: optional(r.ends_at) }
}

/**
 * Descuento vigente y códigos usados por el negocio activo (el
 * administrador ve la fila de su suscripción y sus canjes por RLS).
 * Devuelve undefined si la 0021 aún no está aplicada: Suscripción
 * simplemente no muestra la sección.
 */
export async function getBusinessPromoStatus(): Promise<BusinessPromoStatus | undefined> {
  const businessId = await getActiveBusinessId()
  const [sub, redemptions] = await Promise.all([
    supabase
      .from('business_subscriptions_cafexis')
      .select('discount_percent, discount_ends_at')
      .eq('business_id', businessId)
      .maybeSingle<{ discount_percent: number | null; discount_ends_at: string | null }>(),
    supabase
      .from('promo_code_redemptions_cafexis')
      .select('business_id, code, summary, by_platform, created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .returns<Array<{ business_id: string; code: string; summary: string; by_platform: boolean; created_at: string }>>(),
  ])

  if (sub.error && isMissingSchema(sub.error)) return undefined
  if (redemptions.error && isMissingSchema(redemptions.error)) return undefined
  if (sub.error) throw new Error(sub.error.message)
  if (redemptions.error) throw new Error(redemptions.error.message)

  const percent = sub.data?.discount_percent ?? undefined
  const endsAt = sub.data?.discount_ends_at ?? undefined
  const discountActive = percent !== undefined && (!endsAt || new Date(endsAt).getTime() > Date.now())

  return {
    discountPercent: discountActive ? percent : undefined,
    discountEndsAt: discountActive ? endsAt : undefined,
    redemptions: (redemptions.data ?? []).map((r) => ({
      businessId: r.business_id,
      businessName: '',
      code: r.code,
      summary: r.summary,
      byPlatform: r.by_platform,
      createdAt: r.created_at,
    })),
  }
}
