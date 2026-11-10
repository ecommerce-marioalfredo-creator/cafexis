import { currency } from '@/components/domain/paymentMethods'
import type { BadgeTone } from '@/components/ui/Badge'
import type {
  AdminPlan,
  BillingPeriod,
  PlanCode,
  PlatformAccount,
  PlatformAccountSubscription,
  PromoCode,
  PromoCodeInput,
  SubscriptionStatus,
} from '@/types/domain'

/** Etiquetas y cálculos compartidos por el panel del super usuario. */

export const DAY_MS = 86_400_000

export const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trial: 'En prueba',
  activa: 'Activa',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
}

export const STATUS_TONE: Record<SubscriptionStatus, BadgeTone> = {
  trial: 'info',
  activa: 'success',
  vencida: 'warning',
  cancelada: 'neutral',
}

export const ALL_STATUSES: SubscriptionStatus[] = ['trial', 'activa', 'vencida', 'cancelada']

export const BILLING_LABEL: Record<BillingPeriod, string> = { mensual: 'Mensual', anual: 'Anual' }

export const errorText = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback)

export function formatDate(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso?: string): string {
  if (!iso) return 'Nunca'
  return new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** yyyy-mm-dd en hora local, para <input type="date">. */
export function toDateInput(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** La fecha vence al terminar ese día, en hora local. */
export function endOfDayIso(value: string): string {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d, 23, 59, 59).toISOString()
}

export const todayInput = () => toDateInput(new Date().toISOString())

/** Suma meses a una fecha yyyy-mm-dd (desde hoy si está vacía o ya pasó). */
export function addMonthsInput(value: string, months: number): string {
  const today = todayInput()
  const base = value && value > today ? value : today
  const [y, m, d] = base.split('-').map(Number)
  const next = new Date(y, m - 1 + months, d)
  return toDateInput(next.toISOString())
}

export function daysUntil(iso?: string): number | undefined {
  if (!iso) return undefined
  return Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS)
}

/** Fecha que importa de la suscripción: fin de la prueba o hasta cuándo está pago. */
export function subscriptionEndsAt(sub: Pick<PlatformAccountSubscription, 'status' | 'trialEndsAt' | 'currentPeriodEndsAt'>) {
  return sub.status === 'trial' ? sub.trialEndsAt : sub.currentPeriodEndsAt
}

/** Misma regla que subscription_is_current_cafexis (0019): ¿sigue vigente la prueba o el pago? */
export function isCurrent(status: SubscriptionStatus, trialEndsAt?: string | null, periodEndsAt?: string | null): boolean {
  const now = Date.now()
  if (status === 'trial') return !trialEndsAt || new Date(trialEndsAt).getTime() > now
  if (status === 'activa') return !periodEndsAt || new Date(periodEndsAt).getTime() > now
  return false
}

export const planName = (plans: AdminPlan[], code?: PlanCode) => plans.find((p) => p.code === code)?.name ?? code ?? '—'

/** ¿El descuento sigue vigente? */
export function discountActive(sub?: Pick<PlatformAccountSubscription, 'discountPercent' | 'discountEndsAt'>): boolean {
  if (!sub?.discountPercent) return false
  return !sub.discountEndsAt || new Date(sub.discountEndsAt).getTime() > Date.now()
}

/** Precio de un plan con la forma de pago y el descuento, en pesos. */
export function chargeFor(plan: AdminPlan | undefined, billing: BillingPeriod, discountPercent?: number): number {
  if (!plan) return 0
  const base = billing === 'anual' ? plan.annualPrice : plan.monthlyPrice
  return Math.round(base * (1 - (discountPercent ?? 0) / 100))
}

/**
 * Ingreso mensual estimado de un negocio: lo que paga al mes por su plan
 * efectivo (el anual se reparte en 12), con el descuento vigente. La prueba
 * no cuenta: todavía no paga.
 */
export function monthlyRevenue(account: PlatformAccount, plans: AdminPlan[]): number {
  const sub = account.subscription
  if (!sub || sub.status !== 'activa' || !isCurrent(sub.status, sub.trialEndsAt, sub.currentPeriodEndsAt)) return 0
  const plan = plans.find((p) => p.code === sub.effectivePlanCode)
  if (!plan || plan.monthlyPrice === 0) return 0
  const percent = discountActive(sub) ? sub.discountPercent : undefined
  const charge = chargeFor(plan, sub.billingPeriod, percent)
  return sub.billingPeriod === 'anual' ? Math.round(charge / 12) : charge
}

/** Asuntos que el super usuario debería revisar en un negocio. */
export function accountAlerts(account: PlatformAccount): Array<{ label: string; tone: BadgeTone }> {
  const sub = account.subscription
  const alerts: Array<{ label: string; tone: BadgeTone }> = []
  if (!sub) return [{ label: 'Sin suscripción', tone: 'error' }]
  if (sub.pendingPlanId) alerts.push({ label: 'Solicitud de plan', tone: 'warning' })
  const ends = subscriptionEndsAt(sub)
  const left = daysUntil(ends)
  if (sub.planCode !== sub.effectivePlanCode && sub.status !== 'cancelada') {
    alerts.push({ label: sub.status === 'trial' ? 'Prueba terminada' : 'Plan vencido', tone: 'warning' })
  } else if (left !== undefined && left >= 0 && left <= 7 && sub.status !== 'cancelada') {
    alerts.push({ label: left === 0 ? 'Vence hoy' : `Vence en ${left} día${left === 1 ? '' : 's'}`, tone: 'warning' })
  }
  if (sub.status === 'cancelada') alerts.push({ label: 'Cuenta cancelada', tone: 'error' })
  return alerts
}

// --- Códigos de promoción ---------------------------------------------------

export function promoBenefitText(promo: Pick<PromoCodeInput, 'benefit' | 'planId' | 'freeDays' | 'discountPercent' | 'discountMonths'>, plans: AdminPlan[]): string {
  const plan = plans.find((p) => p.id === promo.planId)
  if (promo.benefit === 'dias_gratis') {
    return `${promo.freeDays ?? '?'} días gratis de ${plan?.name ?? 'un plan'}`
  }
  const months = promo.discountMonths ?? 0
  return `${promo.discountPercent ?? '?'} % de descuento en ${plan ? plan.name : 'cualquier plan pago'} durante ${months} ${months === 1 ? 'mes' : 'meses'}`
}

export type PromoState = 'activo' | 'vencido' | 'agotado' | 'desactivado'

export function promoState(promo: PromoCode): PromoState {
  if (!promo.active) return 'desactivado'
  if (new Date(promo.expiresAt).getTime() <= Date.now()) return 'vencido'
  if (promo.maxRedemptions !== undefined && promo.redemptions.length >= promo.maxRedemptions) return 'agotado'
  return 'activo'
}

export const PROMO_STATE_META: Record<PromoState, { label: string; tone: BadgeTone }> = {
  activo: { label: 'Disponible', tone: 'success' },
  vencido: { label: 'Vencido', tone: 'neutral' },
  agotado: { label: 'Agotado', tone: 'warning' },
  desactivado: { label: 'Desactivado', tone: 'neutral' },
}

/** Código fácil de dictar: sin 0/O ni 1/I. */
export function generatePromoCode(prefix = 'CAFEXIS'): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const random = new Uint32Array(6)
  crypto.getRandomValues(random)
  return `${prefix}-${Array.from(random, (n) => alphabet[n % alphabet.length]).join('')}`
}

export const money = (value: number) => currency.format(value)
