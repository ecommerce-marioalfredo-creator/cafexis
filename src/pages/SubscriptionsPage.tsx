import { useEffect, useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { usePlan } from '@/context/PlanContext'
import { useAsync } from '@/hooks/useAsync'
import {
  cancelPlanChange,
  changePlan,
  listAllSubscriptions,
  listPlans,
  updateSubscription,
} from '@/services/api/subscriptionService'
import {
  COMPARE_GROUPS,
  FALLBACK_PLANS,
  FEATURE_PITCH,
  LIFECYCLE_STEPS,
  PLAN_CARD,
  type CompareTag,
  type CompareValue,
} from '@/components/plan/planCatalog'
import { currency } from '@/components/domain/paymentMethods'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PromoCodeRedeem } from '@/components/domain/PromoCodeRedeem'
import type {
  BillingPeriod,
  BusinessPlan,
  BusinessSubscriptionOverview,
  PlanChangeResult,
  PlanCode,
  SubscriptionPlan,
  SubscriptionStatus,
  SubscriptionUpdate,
} from '@/types/domain'
import './SubscriptionsPage.css'

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trial: 'Período de prueba',
  activa: 'Activa',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
}

const STATUS_TONE: Record<SubscriptionStatus, BadgeTone> = {
  trial: 'info',
  activa: 'success',
  vencida: 'warning',
  cancelada: 'neutral',
}

const ALL_STATUSES: SubscriptionStatus[] = ['trial', 'activa', 'vencida', 'cancelada']

const BILLING_LABEL: Record<BillingPeriod, string> = { mensual: 'mensual', anual: 'anual' }

function formatDate(iso?: string): string {
  if (!iso) return 'Sin fecha límite'
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** yyyy-mm-dd local, para <input type="date">. */
function toDateInput(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** El plan vence al terminar ese día, en la hora local. */
function endOfDayIso(value: string): string {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d, 23, 59, 59).toISOString()
}

const errorText = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback)

/** Precio del plan para la forma de pago: "$ 79.900 al mes" / "$ 799.000 al año". */
function priceLabel(plan: SubscriptionPlan, billing: BillingPeriod): string {
  if (plan.monthlyPrice === 0) return 'Gratis'
  return billing === 'anual'
    ? `${currency.format(plan.annualPrice)} al año`
    : `${currency.format(plan.monthlyPrice)} al mes`
}

function CheckIcon() {
  return (
    <svg className="plans-check" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12l5 5L20 7" />
    </svg>
  )
}

function Tag({ tag }: { tag: CompareTag }) {
  return tag === 'soon' ? (
    <span className="plans-tag plans-tag--soon">Próximamente</span>
  ) : (
    <span className="plans-tag plans-tag--setup">Requiere habilitación</span>
  )
}

/**
 * Suscripción, dentro del panel: el plan del negocio con su uso, el cambio
 * de plan, los tres planes, el cuadro comparativo y cómo funciona el ciclo.
 *
 * Cambiar de plan (0020): bajar a Básica es inmediato; un plan pago queda
 * como solicitud pendiente de cobro, con un caso de soporte. El supervisor
 * técnico cambia o aprueba al instante, aquí mismo o en la tabla de todos
 * los negocios.
 */
export function SubscriptionsPage() {
  const { user, business } = useAuth()
  const isSupervisor = user?.role === 'supervisor_tecnico'
  const { plan, loading: loadingPlan, error: planError, reload: reloadPlan, refresh: refreshPlan } = usePlan()
  const { data: plansData, error: plansError } = useAsync(listPlans, [])
  const plans = plansData ?? FALLBACK_PLANS

  const [billing, setBilling] = useState<BillingPeriod>('mensual')
  // Ventana de cambio de plan abierta, con el plan que se eligió desde una tarjeta (si fue así).
  const [changing, setChanging] = useState<{ initialCode?: PlanCode }>()
  const [notice, setNotice] = useState<{ text: string; caseId?: string }>()
  const [actionError, setActionError] = useState<string>()
  const [busy, setBusy] = useState(false)
  // Cambia cada vez que algo modifica una suscripción: la tabla del supervisor se vuelve a consultar.
  const [tableVersion, setTableVersion] = useState(0)

  // El uso (productos, usuarios…) se cargó al entrar al panel: al abrir esta página se pone al día.
  useEffect(() => {
    void refreshPlan()
  }, [refreshPlan])

  if (loadingPlan && !plan) return <PageLoading label="Cargando tu plan…" />
  if (planError && !plan) return <PageError message={planError} onRetry={reloadPlan} />

  const currentCode: PlanCode | undefined = plan?.effectivePlanCode
  const pending = plan?.pendingChange
  // Sin la migración 0019 los planes son los de planCatalog, sin id real: no se pueden asignar.
  const plansFromDb = plans.some((p) => p.id !== p.code)
  const canChange = Boolean(plan && business && plansFromDb && plan.isActive)

  const afterChange = async (result: PlanChangeResult) => {
    setNotice(
      result.applied
        ? {
            text: `Listo: ${isSupervisor && business ? `${business.name} quedó` : 'quedaste'} en el plan ${result.planName}${
              result.periodEndsAt ? `, pago hasta el ${formatDate(result.periodEndsAt)}` : ''
            }.`,
          }
        : {
            text: `Enviamos tu solicitud del plan ${result.planName}. Te escribimos por el caso de soporte para coordinar el pago; cuando se confirme, el plan se activa sin cerrar sesión.`,
            caseId: result.caseId,
          },
    )
    setTableVersion((v) => v + 1)
    await refreshPlan()
  }

  const runPendingAction = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true)
    setActionError(undefined)
    setNotice(undefined)
    try {
      await action()
    } catch (err) {
      setActionError(errorText(err, fallback))
    } finally {
      setBusy(false)
    }
  }

  const cancelPending = () =>
    runPendingAction(async () => {
      if (!business) return
      await cancelPlanChange(business.id)
      setNotice({ text: isSupervisor ? 'Rechazaste la solicitud de cambio de plan.' : 'Cancelaste la solicitud de cambio de plan.' })
      setTableVersion((v) => v + 1)
      await refreshPlan()
    }, 'No se pudo cancelar la solicitud.')

  const approvePending = () =>
    runPendingAction(async () => {
      const target = plans.find((p) => p.code === pending?.planCode)
      if (!business || !plan || !pending || !target) return
      await afterChange(
        await changePlan({
          businessId: business.id,
          businessName: business.name,
          currentPlanName: plan.effectivePlanName,
          plan: target,
          billing: pending.billingPeriod,
          asSupervisor: true,
        }),
      )
    }, 'No se pudo aprobar el cambio de plan.')

  const cardAction = (p: SubscriptionPlan): ReactNode => {
    if (p.code === currentCode) {
      return (
        <Button variant="secondary" className="btn--block" disabled>
          Tu plan actual
        </Button>
      )
    }
    if (!isSupervisor && pending?.planCode === p.code) {
      return (
        <Button variant="secondary" className="btn--block" disabled>
          Solicitud pendiente
        </Button>
      )
    }
    if (!canChange) return null
    return (
      <Button
        variant={p.recommended ? 'primary' : 'secondary'}
        className="btn--block"
        onClick={() => setChanging({ initialCode: p.code })}
      >
        Cambiar a {p.name}
      </Button>
    )
  }

  return (
    <div className="plans-page">
      {plan && (
        <CurrentPlan
          plan={plan}
          businessName={business?.name}
          isSupervisor={isSupervisor}
          canChange={canChange}
          busy={busy}
          onChangePlan={() => setChanging({})}
          onCancelPending={cancelPending}
          onApprovePending={approvePending}
        />
      )}

      {notice && (
        <div className="form-success-banner" role="status">
          {notice.text}{' '}
          {notice.caseId && !isSupervisor && <Link to={`/ayuda/${notice.caseId}`}>Ver la solicitud</Link>}
        </div>
      )}
      {actionError && <div className="form-error-banner">{actionError}</div>}

      {/* Códigos de promoción (0021): días gratis o descuento. */}
      {plan && !plan.legacy && plan.isActive && <PromoCodeRedeem onRedeemed={refreshPlan} />}

      <section className="plans-section" aria-labelledby="plans-choose-title">
        <div className="plans-section__head">
          <h2 id="plans-choose-title">Elige tu plan</h2>
          <p>
            Tres planes sobre el mismo sistema: panel del negocio, punto de venta, inventario, compras, reportes,
            trazabilidad y lo que ven tus clientes.
          </p>
        </div>
        {plansError && (
          <p className="section-subtitle">No se pudieron cargar los precios actualizados; se muestran los de referencia.</p>
        )}
        <div className="plans-billing">
          <div className="plans-segmented" role="group" aria-label="Forma de pago">
            {(['mensual', 'anual'] as BillingPeriod[]).map((period) => (
              <button key={period} type="button" aria-pressed={billing === period} onClick={() => setBilling(period)}>
                {period === 'mensual' ? 'Mensual' : 'Anual'}
              </button>
            ))}
          </div>
          <small>Anual: pagas 10 meses y usas 12.</small>
        </div>

        <div className="plans-cards">
          {plans.map((p) => (
            <PlanCard key={p.code} plan={p} billing={billing} current={p.code === currentCode} action={cardAction(p)} />
          ))}
        </div>
      </section>

      <CompareTable plans={plans} billing={billing} currentCode={currentCode} />

      <section className="plans-section" aria-labelledby="plans-cycle-title">
        <div className="plans-section__head">
          <h2 id="plans-cycle-title">Cómo se cambia de plan</h2>
          <p>Nadie queda bloqueado: si un plan pago termina, el negocio sigue funcionando en Básica.</p>
        </div>
        <ol className="plans-steps">
          {LIFECYCLE_STEPS.map((step) => (
            <li key={step.title} className="plans-step">
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      {isSupervisor && (
        <AllSubscriptions
          plans={plansFromDb ? plans : []}
          version={tableVersion}
          onChanged={async () => {
            await refreshPlan()
          }}
        />
      )}

      {changing && plan && business && (
        <ChangePlanModal
          plans={plans}
          current={plan}
          initialCode={changing.initialCode}
          initialBilling={billing}
          isSupervisor={isSupervisor}
          businessId={business.id}
          businessName={business.name}
          onClose={() => setChanging(undefined)}
          onDone={async (result) => {
            setChanging(undefined)
            setActionError(undefined)
            await afterChange(result)
          }}
        />
      )}
    </div>
  )
}

function CurrentPlan({
  plan,
  businessName,
  isSupervisor,
  canChange,
  busy,
  onChangePlan,
  onCancelPending,
  onApprovePending,
}: {
  plan: BusinessPlan
  businessName?: string
  isSupervisor: boolean
  canChange: boolean
  busy: boolean
  onChangePlan: () => void
  onCancelPending: () => void
  onApprovePending: () => void
}) {
  let detail: string
  if (plan.lapsed) {
    const ended = plan.status === 'trial' ? plan.trialEndsAt : plan.currentPeriodEndsAt
    detail = `${plan.status === 'trial' ? `Tu prueba de ${plan.planName}` : `Tu plan ${plan.planName}`} terminó${
      ended ? ` el ${formatDate(ended)}` : ''
    }: operas en ${plan.effectivePlanName}. Lo que ya tenías se conserva.`
  } else if (plan.status === 'trial') {
    detail = `Estás probando ${plan.planName}${plan.trialEndsAt ? ` hasta el ${formatDate(plan.trialEndsAt)}` : ''}. Después pasas a Básica, a menos que elijas un plan.`
  } else if (plan.status === 'activa' && plan.currentPeriodEndsAt) {
    detail = `Pago ${BILLING_LABEL[plan.billingPeriod]}, vigente hasta el ${formatDate(plan.currentPeriodEndsAt)}.`
  } else if (plan.effectivePlanCode === 'basica') {
    detail = 'Plan gratuito, sin fecha de vencimiento.'
  } else {
    detail = 'Plan activo, sin fecha de vencimiento.'
  }

  const pending = plan.pendingChange

  return (
    <section className="plans-current" aria-labelledby="plans-current-title">
      <div className="plans-current__summary">
        <span className="plans-eyebrow">{isSupervisor && businessName ? `Plan de ${businessName}` : 'Tu plan'}</span>
        <div className="plans-current__name">
          <h2 id="plans-current-title">{plan.effectivePlanName}</h2>
          <Badge tone={plan.lapsed ? 'warning' : STATUS_TONE[plan.status]}>
            {plan.lapsed ? `${plan.planName} vencido` : STATUS_LABEL[plan.status]}
          </Badge>
        </div>
        <p className="plans-current__detail">{detail}</p>
        {plan.addons.includes('factura_dian') && !plan.lapsed && (
          <p className="plans-current__detail">Complemento: factura electrónica DIAN.</p>
        )}

        {pending && (
          <div className="plans-pending" role="status">
            <p>
              <strong>
                {isSupervisor ? 'Solicitud del negocio' : 'Solicitaste'}: plan {pending.planName}, pago{' '}
                {BILLING_LABEL[pending.billingPeriod]}
              </strong>{' '}
              · {formatDate(pending.requestedAt)}
            </p>
            <p className="plans-current__detail">
              {isSupervisor
                ? 'Apruébala cuando el pago esté confirmado: el plan se activa al instante.'
                : 'Está pendiente de pago. Te escribimos por el caso de soporte para coordinarlo; cuando se confirme, el plan se activa sin cerrar sesión.'}
            </p>
            <div className="plans-pending__actions">
              {isSupervisor ? (
                <>
                  <Button variant="primary" disabled={busy} onClick={onApprovePending}>
                    Aprobar y activar
                  </Button>
                  <Button variant="tertiary" disabled={busy} onClick={onCancelPending}>
                    Rechazar
                  </Button>
                </>
              ) : (
                <>
                  {pending.caseId && (
                    <Link to={`/ayuda/${pending.caseId}`} className="btn btn--secondary">
                      Ver la solicitud
                    </Link>
                  )}
                  <Button variant="tertiary" disabled={busy} onClick={onCancelPending}>
                    Cancelar solicitud
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {canChange && (
          <div className="plans-current__actions">
            <Button variant="primary" onClick={onChangePlan}>
              Cambiar de plan
            </Button>
          </div>
        )}
      </div>
      {!plan.legacy && (
        <dl className="plans-usage">
          {LIMIT_LABEL.map(({ key, label }) => {
            const max = plan.limits[key]
            const used = plan.usage[key]
            const full = max !== undefined && used >= max
            return (
              <div key={key} className={['plans-usage__item', full ? 'plans-usage__item--full' : ''].join(' ')}>
                <dt>{label}</dt>
                <dd>
                  <strong>{used}</strong> {max !== undefined ? `de ${max}` : '· sin límite'}
                  {full && <span className="plans-usage__note"> · llegaste al tope</span>}
                </dd>
                {max !== undefined && (
                  <span className="plans-usage__bar" aria-hidden="true">
                    <span style={{ width: `${Math.min(100, (used / max) * 100)}%` }} />
                  </span>
                )}
              </div>
            )
          })}
        </dl>
      )}
    </section>
  )
}

const LIMIT_LABEL: Array<{ key: 'usuarios' | 'productos' | 'insumos'; label: string }> = [
  { key: 'usuarios', label: 'Usuarios del equipo' },
  { key: 'productos', label: 'Productos' },
  { key: 'insumos', label: 'Insumos' },
]

const limitText = (max?: number) => (max === undefined ? 'sin límite' : `hasta ${max}`)

/**
 * Elegir el plan nuevo y la forma de pago, ver qué se gana o se pierde y
 * confirmar. Bajar a un plan gratis es inmediato; un plan pago lo pide quien
 * administra (queda pendiente de cobro) o lo aplica el supervisor técnico.
 */
function ChangePlanModal({
  plans,
  current,
  initialCode,
  initialBilling,
  isSupervisor,
  businessId,
  businessName,
  onClose,
  onDone,
}: {
  plans: SubscriptionPlan[]
  current: BusinessPlan
  initialCode?: PlanCode
  initialBilling: BillingPeriod
  isSupervisor: boolean
  businessId: string
  businessName: string
  onClose: () => void
  onDone: (result: PlanChangeResult) => Promise<void>
}) {
  // El plan vigente se puede volver a elegir para pagarlo al terminar la prueba (o, el supervisor, para renovarlo).
  const selectable = (p: SubscriptionPlan) =>
    p.code !== current.effectivePlanCode || isSupervisor || (current.status === 'trial' && p.monthlyPrice > 0)
  const firstChoice =
    initialCode ??
    plans.find((p) => p.recommended && selectable(p))?.code ??
    plans.find(selectable)?.code ??
    plans[0].code

  const [code, setCode] = useState<PlanCode>(firstChoice)
  const [billing, setBilling] = useState(initialBilling)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const groupName = useId()

  const target = plans.find((p) => p.code === code) ?? plans[0]
  const free = target.monthlyPrice === 0
  const same = target.code === current.effectivePlanCode
  const gains = target.features.filter((f) => !current.features.includes(f))
  const losses = current.features.filter((f) => !target.features.includes(f))
  const limitChanges = LIMIT_LABEL.filter(({ key }) => current.limits[key] !== target.limits[key])
  const overLimit = current.legacy
    ? []
    : LIMIT_LABEL.filter(({ key }) => target.limits[key] !== undefined && current.usage[key] > target.limits[key]!)
  const applyNow = isSupervisor || free

  const confirmLabel = isSupervisor
    ? `Cambiar a ${target.name} ahora`
    : free
      ? `Cambiar a ${target.name}`
      : same
        ? `Pagar ${target.name}`
        : `Solicitar ${target.name}`

  const confirm = async () => {
    setSaving(true)
    setError(undefined)
    try {
      const result = await changePlan({
        businessId,
        businessName,
        currentPlanName: current.effectivePlanName,
        plan: target,
        billing,
        asSupervisor: isSupervisor,
      })
      await onDone(result)
    } catch (err) {
      setError(errorText(err, 'No se pudo cambiar el plan.'))
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Cambiar de plan"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={confirm} disabled={saving || !selectable(target)}>
            {saving ? 'Guardando…' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="plans-change">
        <fieldset className="plans-change__options">
          <legend>
            {isSupervisor ? `Plan para ${businessName}` : 'Elige el plan'} · hoy en{' '}
            <strong>{current.effectivePlanName}</strong>
          </legend>
          {plans.map((p) => {
            const isCurrent = p.code === current.effectivePlanCode
            return (
              <label
                key={p.code}
                className={[
                  'plans-change__option',
                  p.code === code ? 'plans-change__option--selected' : '',
                  selectable(p) ? '' : 'plans-change__option--disabled',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name={groupName}
                  value={p.code}
                  checked={p.code === code}
                  disabled={!selectable(p)}
                  onChange={() => setCode(p.code)}
                />
                <span className="plans-change__option-body">
                  <span className="plans-change__option-name">
                    {p.name}
                    {isCurrent && <span className="plans-change__current">Tu plan actual</span>}
                  </span>
                  <span className="plans-change__option-desc">{p.description}</span>
                </span>
                <span className="plans-change__option-price">{priceLabel(p, billing)}</span>
              </label>
            )
          })}
        </fieldset>

        {!free && (
          <div className="plans-billing plans-change__billing">
            <div className="plans-segmented" role="group" aria-label="Forma de pago">
              {(['mensual', 'anual'] as BillingPeriod[]).map((period) => (
                <button key={period} type="button" aria-pressed={billing === period} onClick={() => setBilling(period)}>
                  {period === 'mensual' ? 'Mensual' : 'Anual'}
                </button>
              ))}
            </div>
            <small>
              {billing === 'anual'
                ? `${currency.format(target.annualPrice)} al año: pagas 10 meses y usas 12.`
                : `${currency.format(target.monthlyPrice)} al mes.`}
            </small>
          </div>
        )}

        {!same && (gains.length > 0 || losses.length > 0 || limitChanges.length > 0) && (
          <div className="plans-diff">
            {gains.length > 0 && (
              <div>
                <h4>Ganas</h4>
                <ul>
                  {gains.map((f) => (
                    <li key={f}>
                      <CheckIcon />
                      {FEATURE_PITCH[f].title}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {losses.length > 0 && (
              <div>
                <h4>Dejas de tener</h4>
                <ul>
                  {losses.map((f) => (
                    <li key={f}>
                      <span className="plans-diff__minus" aria-hidden="true">
                        —
                      </span>
                      {FEATURE_PITCH[f].title}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {limitChanges.length > 0 && (
              <div>
                <h4>Límites</h4>
                <ul>
                  {limitChanges.map(({ key, label }) => (
                    <li key={key}>
                      <span className="plans-diff__arrow" aria-hidden="true">
                        →
                      </span>
                      {label}: {limitText(current.limits[key])} → {limitText(target.limits[key])}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {overLimit.length > 0 && (
          <p className="plans-change__warning">
            Hoy tienes{' '}
            {overLimit
              .map(({ key, label }) => `${current.usage[key]} ${label.toLowerCase()} (${target.name} permite ${target.limits[key]})`)
              .join(', ')}
            . No se borra nada: se conserva y se sigue usando, pero no podrás agregar más.
          </p>
        )}

        <p className="plans-change__how">
          {isSupervisor
            ? free
              ? 'El cambio se aplica al instante y no vence.'
              : `El cambio se aplica al instante y queda pago hasta ${billing === 'anual' ? 'dentro de un año' : 'dentro de un mes'}. Puedes ajustar la fecha en la tabla de todos los negocios.`
            : applyNow
              ? 'El cambio es inmediato.'
              : `Enviamos la solicitud al equipo de Cafexis con un caso de soporte para coordinar el pago (${priceLabel(target, billing)}). Cuando se confirme, el plan se activa sin cerrar sesión; mientras tanto sigues en ${current.effectivePlanName}.`}
        </p>

        {error && <div className="form-error-banner">{error}</div>}
      </div>
    </Modal>
  )
}

function priceLines(plan: SubscriptionPlan, billing: BillingPeriod): { amount: string; note: string } {
  if (plan.monthlyPrice === 0) return { amount: currency.format(0), note: 'Siempre gratis' }
  if (billing === 'anual') {
    return { amount: currency.format(Math.round(plan.annualPrice / 12)), note: `${currency.format(plan.annualPrice)} al año` }
  }
  return { amount: currency.format(plan.monthlyPrice), note: 'Pago mensual' }
}

function PlanCard({
  plan,
  billing,
  current,
  action,
}: {
  plan: SubscriptionPlan
  billing: BillingPeriod
  current: boolean
  action: ReactNode
}) {
  const card = PLAN_CARD[plan.code]
  const price = priceLines(plan, billing)
  return (
    <article
      className={['plans-card', plan.recommended ? 'plans-card--featured' : '', current ? 'plans-card--current' : ''].join(' ')}
    >
      {(current || plan.recommended) && (
        <span className={['plans-card__badge', current ? 'plans-card__badge--current' : ''].join(' ')}>
          {current ? 'Tu plan' : 'Recomendado'}
        </span>
      )}
      <div className="plans-card__head">
        <h3>{plan.name}</h3>
        <p>{plan.description}</p>
      </div>
      <div className="plans-card__price">
        <span className="plans-card__amount">
          {price.amount}
          {plan.monthlyPrice > 0 && <small> / mes</small>}
        </span>
        <span className="plans-card__note">{price.note}</span>
      </div>
      <ul>
        {card.bullets.map((bullet) => (
          <li key={bullet}>
            <CheckIcon />
            {bullet}
          </li>
        ))}
      </ul>
      <p className="plans-card__ideal">
        <strong>Ideal para</strong> {card.ideal}
      </p>
      {action}
    </article>
  )
}

function CompareCell({ value, planName }: { value: CompareValue; planName: string }) {
  if (value === true) {
    return (
      <>
        <CheckIcon />
        <span className="visually-hidden">Incluido en {planName}</span>
      </>
    )
  }
  if (value === false) {
    return (
      <>
        <span className="plans-compare__no" aria-hidden="true">
          —
        </span>
        <span className="visually-hidden">No incluido en {planName}</span>
      </>
    )
  }
  return <span className="plans-compare__text">{value}</span>
}

function CompareTable({
  plans,
  billing,
  currentCode,
}: {
  plans: SubscriptionPlan[]
  billing: BillingPeriod
  currentCode?: PlanCode
}) {
  const [onlyDiff, setOnlyDiff] = useState(false)
  const toggleId = useId()
  // Las columnas del cuadro siguen el orden Básica, Profesional, Premium.
  const columns = (['basica', 'profesional', 'premium'] as PlanCode[]).map(
    (code) => plans.find((p) => p.code === code) ?? FALLBACK_PLANS.find((p) => p.code === code)!,
  )

  const groups = COMPARE_GROUPS.map((group) => ({
    ...group,
    rows: onlyDiff ? group.rows.filter(({ values: [a, b, c] }) => !(a === b && b === c)) : group.rows,
  })).filter((group) => group.rows.length > 0)

  const shortPrice = (plan: SubscriptionPlan) =>
    plan.monthlyPrice === 0
      ? currency.format(0)
      : billing === 'anual'
        ? `${currency.format(plan.annualPrice)} / año`
        : `${currency.format(plan.monthlyPrice)} / mes`

  return (
    <section className="plans-section" aria-labelledby="plans-compare-title">
      <div className="plans-section__head">
        <h2 id="plans-compare-title">Cuadro comparativo</h2>
        <p>Qué se activa en cada plan, en el panel del negocio (dashboard y módulos) y en lo que ve el cliente.</p>
      </div>
      <div className="plans-compare__tools">
        <label className="plans-compare__toggle" htmlFor={toggleId}>
          <input id={toggleId} type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} />
          Mostrar solo lo que cambia entre planes
        </label>
        <div className="plans-legend">
          <span>
            <Tag tag="soon" /> aún no está disponible
          </span>
          <span>
            <Tag tag="setup" /> se activa con el proveedor de pagos o facturación
          </span>
        </div>
      </div>
      <div className="plans-compare__wrap">
        <table className="plans-compare">
          <thead>
            <tr>
              <th scope="col">Función</th>
              {columns.map((plan) => (
                <th
                  key={plan.code}
                  scope="col"
                  className={['plans-compare__plan', plan.recommended ? 'plans-compare__col--featured' : ''].join(' ')}
                >
                  {plan.name}
                  <span>{shortPrice(plan)}</span>
                  {plan.code === currentCode && <span className="plans-compare__current">Tu plan</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => [
              <tr key={group.title} className="plans-compare__group">
                <th colSpan={4} scope="colgroup">
                  {group.title}
                </th>
              </tr>,
              ...group.rows.map((row) => (
                <tr key={`${group.title}:${row.label}`}>
                  <th scope="row">
                    {row.label}
                    {row.tag && <Tag tag={row.tag} />}
                  </th>
                  {row.values.map((value, i) => (
                    <td
                      key={columns[i].code}
                      className={['plans-compare__value', columns[i].recommended ? 'plans-compare__col--featured' : ''].join(' ')}
                    >
                      <CompareCell value={value} planName={columns[i].name} />
                    </td>
                  ))}
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** Supervisor técnico: plan, estado, vencimiento, complementos y solicitudes de cada negocio. */
function AllSubscriptions({
  plans,
  version,
  onChanged,
}: {
  plans: SubscriptionPlan[]
  version: number
  onChanged: () => Promise<void>
}) {
  const { data, loading, error, reload, refresh } = useAsync(listAllSubscriptions, [version])
  const [savingId, setSavingId] = useState<string>()
  const [saveError, setSaveError] = useState<string>()

  const run = async (row: BusinessSubscriptionOverview, action: () => Promise<unknown>) => {
    setSavingId(row.businessId)
    setSaveError(undefined)
    try {
      await action()
      await Promise.all([refresh(), onChanged()])
    } catch (err) {
      setSaveError(`${row.businessName}: ${errorText(err, 'no se pudo guardar el cambio.')}`)
    } finally {
      setSavingId(undefined)
    }
  }

  const save = (row: BusinessSubscriptionOverview, changes: SubscriptionUpdate) =>
    run(row, () => updateSubscription(row.businessId, changes))

  const approve = (row: BusinessSubscriptionOverview) => {
    const target = plans.find((p) => p.id === row.pendingPlanId)
    if (!target) return
    return run(row, () =>
      changePlan({
        businessId: row.businessId,
        businessName: row.businessName,
        currentPlanName: row.planName ?? '',
        plan: target,
        billing: row.pendingBillingPeriod ?? 'mensual',
        asSupervisor: true,
      }),
    )
  }

  return (
    <section className="plans-section" aria-labelledby="plans-all-title">
      <div className="plans-section__head">
        <h2 id="plans-all-title">Todos los negocios</h2>
        <p>
          Aprueba las solicitudes cuando el pago esté confirmado, o asigna el plan directamente. “Vence” es la fecha
          hasta la que está pago; vacío, no vence. Al vencer, el negocio pasa solo a Básica.
        </p>
      </div>
      {saveError && <div className="form-error-banner">{saveError}</div>}
      {loading && !data ? (
        <PageLoading label="Cargando negocios…" />
      ) : error ? (
        <PageError message={error} onRetry={reload} />
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table plans-admin">
            <thead>
              <tr>
                <th>Negocio</th>
                <th>Plan</th>
                <th>Estado</th>
                <th>Vence</th>
                <th>Factura DIAN</th>
                <th>Solicitud</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((row) => {
                const busy = savingId === row.businessId
                const hasDian = row.addons.includes('factura_dian')
                const pendingPlan = plans.find((p) => p.id === row.pendingPlanId)
                return (
                  <tr key={row.businessId}>
                    <td>{row.businessName}</td>
                    <td>
                      {plans.length > 0 ? (
                        <select
                          value={row.planId}
                          disabled={busy}
                          aria-label={`Plan de ${row.businessName}`}
                          onChange={(e) => save(row, { planId: e.target.value })}
                        >
                          {plans.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        (row.planName ?? '—')
                      )}
                    </td>
                    <td>
                      <select
                        value={row.status}
                        disabled={busy}
                        aria-label={`Estado de ${row.businessName}`}
                        onChange={(e) => save(row, { status: e.target.value as SubscriptionStatus })}
                      >
                        {ALL_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {STATUS_LABEL[status]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {row.status === 'trial' ? (
                        <span title="Fin de la prueba">{formatDate(row.trialEndsAt)}</span>
                      ) : (
                        <input
                          type="date"
                          value={toDateInput(row.currentPeriodEndsAt)}
                          disabled={busy}
                          aria-label={`Vencimiento de ${row.businessName}`}
                          onChange={(e) =>
                            save(row, { currentPeriodEndsAt: e.target.value ? endOfDayIso(e.target.value) : null })
                          }
                        />
                      )}
                    </td>
                    <td>
                      {row.planCode === 'premium' ? (
                        <span className="section-subtitle">Incluida</span>
                      ) : (
                        <label className="plans-admin__addon">
                          <input
                            type="checkbox"
                            checked={hasDian}
                            disabled={busy || plans.length === 0}
                            onChange={() =>
                              save(row, {
                                addons: hasDian
                                  ? row.addons.filter((a) => a !== 'factura_dian')
                                  : [...row.addons, 'factura_dian'],
                              })
                            }
                          />
                          Complemento
                        </label>
                      )}
                    </td>
                    <td>
                      {pendingPlan ? (
                        <div className="plans-admin__request">
                          <span>
                            {pendingPlan.name} · {BILLING_LABEL[row.pendingBillingPeriod ?? 'mensual']}
                            {row.pendingRequestedAt && (
                              <span className="section-subtitle"> · {formatDate(row.pendingRequestedAt)}</span>
                            )}
                          </span>
                          <span className="plans-admin__request-actions">
                            <Button variant="primary" disabled={busy} onClick={() => approve(row)}>
                              Aprobar
                            </Button>
                            <Button
                              variant="tertiary"
                              disabled={busy}
                              onClick={() => run(row, () => cancelPlanChange(row.businessId))}
                            >
                              Rechazar
                            </Button>
                          </span>
                        </div>
                      ) : (
                        <span className="section-subtitle">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
