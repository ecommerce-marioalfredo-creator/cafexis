import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { cancelPlanChange, changePlan } from '@/services/api/subscriptionService'
import { updateAccountSubscription } from '@/services/api/superUserService'
import {
  ALL_STATUSES,
  BILLING_LABEL,
  STATUS_LABEL,
  addMonthsInput,
  chargeFor,
  discountActive,
  endOfDayIso,
  errorText,
  formatDate,
  isCurrent,
  money,
  toDateInput,
} from './superUserFormat'
import type { AdminPlan, BillingPeriod, PlanFeature, PlatformAccount, SubscriptionStatus } from '@/types/domain'

interface Props {
  account: PlatformAccount
  plans: AdminPlan[]
  onClose: () => void
  /** Después de guardar, aprobar o rechazar: el panel vuelve a consultar. */
  onSaved: (message: string) => Promise<void>
}

/**
 * Todo lo que el super usuario puede cambiar de la suscripción de un negocio:
 * plan, estado, forma de pago, fin de la prueba, hasta cuándo está pago,
 * complemento de factura DIAN, descuento, y la solicitud de cambio pendiente.
 */
export function SubscriptionEditModal({ account, plans, onClose, onSaved }: Props) {
  const sub = account.subscription!
  const ids = useId()
  const [planId, setPlanId] = useState(sub.planId)
  const [status, setStatus] = useState<SubscriptionStatus>(sub.status)
  const [billing, setBilling] = useState<BillingPeriod>(sub.billingPeriod)
  const [trialEnds, setTrialEnds] = useState(toDateInput(sub.trialEndsAt))
  const [periodEnds, setPeriodEnds] = useState(toDateInput(sub.currentPeriodEndsAt))
  const [dian, setDian] = useState(sub.addons.includes('factura_dian'))
  const [discountOn, setDiscountOn] = useState(Boolean(sub.discountPercent))
  const [discountPercent, setDiscountPercent] = useState(sub.discountPercent ? String(sub.discountPercent) : '10')
  const [discountEnds, setDiscountEnds] = useState(toDateInput(sub.discountEndsAt))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  const plan = plans.find((p) => p.id === planId)
  const pendingPlan = plans.find((p) => p.id === sub.pendingPlanId)
  const percent = Number(discountPercent)
  const percentValid = !discountOn || (Number.isInteger(percent) && percent >= 1 && percent <= 100)

  // Vista previa con la misma regla de la base de datos (0019).
  const trialIso = trialEnds ? endOfDayIso(trialEnds) : null
  const periodIso = periodEnds ? endOfDayIso(periodEnds) : null
  const current = isCurrent(status, trialIso, periodIso)
  const operatesOn = status === 'cancelada' ? undefined : current ? plan : plans.find((p) => p.code === 'basica')

  const otherAddons = sub.addons.filter((a) => a !== 'factura_dian')
  const addons: PlanFeature[] = dian && plan?.code !== 'premium' ? [...otherAddons, 'factura_dian'] : otherAddons

  const run = async (action: () => Promise<unknown>, message: string, fallback: string) => {
    setSaving(true)
    setError(undefined)
    try {
      await action()
      await onSaved(message)
    } catch (err) {
      setError(errorText(err, fallback))
      setSaving(false)
    }
  }

  const save = () => {
    if (!percentValid) {
      setError('El descuento debe ser un número entero entre 1 y 100.')
      return
    }
    void run(
      () =>
        updateAccountSubscription(account.id, {
          planId,
          status,
          billingPeriod: billing,
          trialEndsAt: trialIso,
          currentPeriodEndsAt: periodIso,
          addons,
          discountPercent: discountOn ? percent : null,
          discountEndsAt: discountOn && discountEnds ? endOfDayIso(discountEnds) : null,
        }),
      `Guardaste la suscripción de ${account.name}.`,
      'No se pudo guardar la suscripción.',
    )
  }

  const approve = () => {
    if (!pendingPlan) return
    void run(
      () =>
        changePlan({
          businessId: account.id,
          businessName: account.name,
          currentPlanName: sub.planName ?? '',
          plan: pendingPlan,
          billing: sub.pendingBillingPeriod ?? 'mensual',
          asSupervisor: true,
        }),
      `Aprobaste el plan ${pendingPlan.name} para ${account.name}.`,
      'No se pudo aprobar la solicitud.',
    )
  }

  const reject = () =>
    void run(() => cancelPlanChange(account.id), `Rechazaste la solicitud de ${account.name}.`, 'No se pudo rechazar la solicitud.')

  const pendingDiscount = discountActive(sub) ? sub.discountPercent : undefined

  return (
    <Modal
      title={`Suscripción de ${account.name}`}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save} disabled={saving || !percentValid}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </>
      }
    >
      <div className="su-edit">
        {pendingPlan && (
          <div className="su-edit__pending" role="status">
            <p>
              <strong>
                Solicitud del negocio: {pendingPlan.name}, pago {BILLING_LABEL[sub.pendingBillingPeriod ?? 'mensual'].toLowerCase()}
              </strong>{' '}
              · {formatDate(sub.pendingRequestedAt)}
            </p>
            <p className="su-muted">
              Cobra {money(chargeFor(pendingPlan, sub.pendingBillingPeriod ?? 'mensual', pendingDiscount))}
              {pendingDiscount ? ` (con ${pendingDiscount} % de descuento)` : ''}. Al aprobar, el plan queda pago por{' '}
              {sub.pendingBillingPeriod === 'anual' ? 'un año' : 'un mes'} desde hoy.
              {sub.pendingCaseId && (
                <>
                  {' '}
                  <Link to={`/soporte/casos/${sub.pendingCaseId}`}>Ver el caso</Link>
                </>
              )}
            </p>
            <div className="su-edit__pending-actions">
              <Button variant="primary" onClick={approve} disabled={saving}>
                Aprobar y activar
              </Button>
              <Button variant="tertiary" onClick={reject} disabled={saving}>
                Rechazar
              </Button>
            </div>
          </div>
        )}

        <div className="su-edit__grid">
          <FormField label="Plan contratado" htmlFor={`${ids}-plan`}>
            <select id={`${ids}-plan`} value={planId} onChange={(e) => setPlanId(e.target.value)}>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.monthlyPrice > 0 ? ` · ${money(p.monthlyPrice)}/mes` : ' · gratis'}
                  {p.active ? '' : ' (no está a la venta)'}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Estado" htmlFor={`${ids}-status`} hint="Cancelada bloquea el panel del negocio.">
            <select id={`${ids}-status`} value={status} onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Forma de pago" htmlFor={`${ids}-billing`}>
            <select id={`${ids}-billing`} value={billing} onChange={(e) => setBilling(e.target.value as BillingPeriod)}>
              <option value="mensual">Mensual{plan && plan.monthlyPrice > 0 ? ` · ${money(plan.monthlyPrice)}` : ''}</option>
              <option value="anual">Anual{plan && plan.annualPrice > 0 ? ` · ${money(plan.annualPrice)}` : ''}</option>
            </select>
          </FormField>

          <FormField
            label="Fin de la prueba"
            htmlFor={`${ids}-trial`}
            hint={status === 'trial' ? 'Vacío: la prueba no vence.' : 'Solo cuenta con el estado “En prueba”.'}
          >
            <input id={`${ids}-trial`} type="date" value={trialEnds} onChange={(e) => setTrialEnds(e.target.value)} />
          </FormField>

          <div className="form-field">
            <label htmlFor={`${ids}-period`}>Pago vigente hasta</label>
            <input id={`${ids}-period`} type="date" value={periodEnds} onChange={(e) => setPeriodEnds(e.target.value)} />
            <span className="su-edit__quick">
              <button type="button" className="filter-chip" onClick={() => setPeriodEnds(addMonthsInput(periodEnds, 1))}>
                +1 mes
              </button>
              <button type="button" className="filter-chip" onClick={() => setPeriodEnds(addMonthsInput(periodEnds, 12))}>
                +1 año
              </button>
              <button type="button" className="filter-chip" onClick={() => setPeriodEnds('')}>
                Sin vencimiento
              </button>
            </span>
            <span className="form-field__hint">
              {status === 'activa' ? 'Vacío: el plan no vence.' : 'Solo cuenta con el estado “Activa”.'}
            </span>
          </div>

          <div className="form-field">
            <span className="su-edit__label">Complemento</span>
            <label className="su-check">
              <input
                type="checkbox"
                checked={plan?.code === 'premium' || dian}
                disabled={plan?.code === 'premium'}
                onChange={(e) => setDian(e.target.checked)}
              />
              Factura electrónica DIAN
            </label>
            <span className="form-field__hint">
              {plan?.code === 'premium' ? 'Ya viene incluida en Premium.' : 'Se vende aparte con Profesional.'}
            </span>
          </div>
        </div>

        <fieldset className="su-edit__discount">
          <legend>Descuento</legend>
          <label className="su-check">
            <input type="checkbox" checked={discountOn} onChange={(e) => setDiscountOn(e.target.checked)} />
            Aplicar un descuento al cobrar el plan
          </label>
          {discountOn && (
            <div className="su-edit__grid">
              <FormField
                label="Porcentaje"
                htmlFor={`${ids}-pct`}
                error={percentValid ? undefined : 'Entre 1 y 100.'}
                hint={plan && plan.monthlyPrice > 0 ? `Cobra ${money(chargeFor(plan, billing, percentValid ? percent : 0))}` : undefined}
              >
                <input
                  id={`${ids}-pct`}
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  inputMode="numeric"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                />
              </FormField>
              <FormField label="Hasta" htmlFor={`${ids}-disc-ends`} hint="Vacío: sin fecha.">
                <input id={`${ids}-disc-ends`} type="date" value={discountEnds} onChange={(e) => setDiscountEnds(e.target.value)} />
              </FormField>
            </div>
          )}
          {sub.discountCode && discountOn && <p className="su-muted">Viene del código {sub.discountCode}.</p>}
        </fieldset>

        <p className={['su-edit__preview', operatesOn ? '' : 'su-edit__preview--warning'].join(' ')}>
          {status === 'cancelada'
            ? `Con estos datos, ${account.name} queda bloqueado: nadie del equipo puede entrar al panel.`
            : `Con estos datos, ${account.name} opera en ${operatesOn?.name ?? 'Básica'}${
                !current ? ` (el plan ${plan?.name ?? ''} ya no está vigente)` : ''
              }.`}
        </p>

        {error && <div className="form-error-banner">{error}</div>}
      </div>
    </Modal>
  )
}
