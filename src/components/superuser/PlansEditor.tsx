import { useId, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { FEATURE_PITCH } from '@/components/plan/planCatalog'
import { updateAdminPlan } from '@/services/api/superUserService'
import { errorText, money } from './superUserFormat'
import type { AdminPlan, PlanFeature, PlanLimit, PlatformAccount } from '@/types/domain'

const ALL_FEATURES = Object.keys(FEATURE_PITCH) as PlanFeature[]

const LIMITS: Array<{ key: PlanLimit; label: string; hint: string }> = [
  { key: 'usuarios', label: 'Usuarios del equipo', hint: 'Administradores y baristas activos más invitaciones.' },
  { key: 'productos', label: 'Productos', hint: 'Productos del catálogo.' },
  { key: 'insumos', label: 'Insumos', hint: 'Insumos del inventario.' },
  { key: 'historial_dias', label: 'Días de historial', hint: 'Cuántos días atrás se ven los pedidos en Reportes.' },
]

interface Props {
  plans: AdminPlan[]
  accounts: PlatformAccount[]
  onChanged: (message: string) => Promise<void>
}

/**
 * Los planes que se venden. Un cambio aplica al instante a todos los negocios
 * de ese plan; la base de datos valida funciones y límites, y no deja cobrar
 * la Básica ni quitarla de la venta.
 */
export function PlansEditor({ plans, accounts, onChanged }: Props) {
  return (
    <section className="su-section" aria-label="Planes">
      <p className="su-muted su-plans__intro">
        Los cambios aplican al instante a todos los negocios de ese plan. Las tarjetas y el cuadro comparativo de
        Suscripción tienen textos fijos en <code>src/components/plan/planCatalog.ts</code>: si cambias funciones o límites,
        actualízalos también para que digan lo mismo.
      </p>
      <div className="su-plans">
        {plans.map((plan) => (
          <PlanForm
            key={`${plan.id}-${plan.sortOrder}-${plan.name}-${plan.monthlyPrice}-${plan.recommended}`}
            plan={plan}
            businesses={accounts.filter((a) => a.subscription?.planId === plan.id).length}
            onChanged={onChanged}
          />
        ))}
      </div>
    </section>
  )
}

function PlanForm({
  plan,
  businesses,
  onChanged,
}: {
  plan: AdminPlan
  businesses: number
  onChanged: (message: string) => Promise<void>
}) {
  const ids = useId()
  const free = plan.code === 'basica'
  const [name, setName] = useState(plan.name)
  const [description, setDescription] = useState(plan.description)
  const [monthly, setMonthly] = useState(String(plan.monthlyPrice))
  const [annual, setAnnual] = useState(String(plan.annualPrice))
  const [trialDays, setTrialDays] = useState(String(plan.trialDays))
  const [limits, setLimits] = useState<Record<PlanLimit, string>>(() => ({
    usuarios: plan.limits.usuarios?.toString() ?? '',
    productos: plan.limits.productos?.toString() ?? '',
    insumos: plan.limits.insumos?.toString() ?? '',
    historial_dias: plan.limits.historial_dias?.toString() ?? '',
  }))
  const [features, setFeatures] = useState<PlanFeature[]>(plan.features)
  const [recommended, setRecommended] = useState(plan.recommended)
  const [active, setActive] = useState(plan.active)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  const monthlyValue = Number(monthly)
  const annualValue = Number(annual)
  const trialValue = Number(trialDays)
  const limitErrors = LIMITS.filter(({ key }) => {
    const v = limits[key].trim()
    return v !== '' && !(Number.isInteger(Number(v)) && Number(v) >= 1)
  })
  const errors = {
    name: name.trim().length < 2 || name.trim().length > 40 ? 'Entre 2 y 40 caracteres.' : undefined,
    monthly: !(Number.isFinite(monthlyValue) && monthlyValue >= 0) ? 'Un valor en pesos, 0 o más.' : undefined,
    annual: !(Number.isFinite(annualValue) && annualValue >= 0) ? 'Un valor en pesos, 0 o más.' : undefined,
    trial: !(Number.isInteger(trialValue) && trialValue >= 0 && trialValue <= 365) ? 'Entre 0 y 365 días.' : undefined,
  }
  const valid = Object.values(errors).every((e) => !e) && limitErrors.length === 0

  const save = async () => {
    if (!valid) return
    setSaving(true)
    setError(undefined)
    try {
      const nextLimits: Partial<Record<PlanLimit, number>> = {}
      for (const { key } of LIMITS) if (limits[key].trim() !== '') nextLimits[key] = Number(limits[key])
      await updateAdminPlan(plan.id, {
        name: name.trim(),
        description: description.trim(),
        monthlyPrice: monthlyValue,
        annualPrice: annualValue,
        trialDays: trialValue,
        features,
        limits: nextLimits,
        recommended,
        active,
      })
      await onChanged(`Guardaste el plan ${name.trim()}.`)
    } catch (err) {
      setError(errorText(err, 'No se pudo guardar el plan.'))
      setSaving(false)
    }
  }

  const months = monthlyValue > 0 ? annualValue / monthlyValue : 0

  return (
    <article className="su-plan" aria-labelledby={`${ids}-title`}>
      <header className="su-plan__head">
        <h3 id={`${ids}-title`}>{plan.name}</h3>
        <span className="su-muted">
          {businesses} negocio{businesses === 1 ? '' : 's'} · código <code>{plan.code}</code>
        </span>
      </header>

      <div className="su-edit__grid">
        <FormField label="Nombre" htmlFor={`${ids}-name`} error={errors.name}>
          <input id={`${ids}-name`} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label="Descripción" htmlFor={`${ids}-desc`}>
          <input id={`${ids}-desc`} value={description} maxLength={120} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
        <FormField
          label="Precio mensual (COP)"
          htmlFor={`${ids}-monthly`}
          error={errors.monthly}
          hint={free ? 'La Básica siempre es gratis.' : money(monthlyValue || 0)}
        >
          <input
            id={`${ids}-monthly`}
            type="number"
            min={0}
            step={100}
            inputMode="numeric"
            value={monthly}
            disabled={free}
            onChange={(e) => setMonthly(e.target.value)}
          />
        </FormField>
        <FormField
          label="Precio anual (COP)"
          htmlFor={`${ids}-annual`}
          error={errors.annual}
          hint={free ? undefined : `${money(annualValue || 0)}${months > 0 ? ` · equivale a ${months.toFixed(1)} meses` : ''}`}
        >
          <input
            id={`${ids}-annual`}
            type="number"
            min={0}
            step={100}
            inputMode="numeric"
            value={annual}
            disabled={free}
            onChange={(e) => setAnnual(e.target.value)}
          />
        </FormField>
        <FormField
          label="Días de prueba"
          htmlFor={`${ids}-trial`}
          error={errors.trial}
          hint="Los negocios nuevos prueban Premium con los días de Premium."
        >
          <input
            id={`${ids}-trial`}
            type="number"
            min={0}
            max={365}
            inputMode="numeric"
            value={trialDays}
            onChange={(e) => setTrialDays(e.target.value)}
          />
        </FormField>
      </div>

      <fieldset className="su-edit__discount">
        <legend>Límites (vacío = sin límite)</legend>
        <div className="su-edit__grid">
          {LIMITS.map(({ key, label, hint }) => (
            <FormField
              key={key}
              label={label}
              htmlFor={`${ids}-${key}`}
              hint={hint}
              error={limitErrors.some((l) => l.key === key) ? 'Un entero mayor que 0, o vacío.' : undefined}
            >
              <input
                id={`${ids}-${key}`}
                type="number"
                min={1}
                inputMode="numeric"
                value={limits[key]}
                placeholder="Sin límite"
                onChange={(e) => setLimits((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </FormField>
          ))}
        </div>
      </fieldset>

      <fieldset className="su-edit__discount">
        <legend>Funciones incluidas</legend>
        <div className="su-plan__features">
          {ALL_FEATURES.map((feature) => (
            <label key={feature} className="su-check">
              <input
                type="checkbox"
                checked={features.includes(feature)}
                onChange={(e) =>
                  setFeatures((prev) => (e.target.checked ? [...prev, feature] : prev.filter((f) => f !== feature)))
                }
              />
              {FEATURE_PITCH[feature].title}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="su-plan__flags">
        <label className="su-check">
          <input type="checkbox" checked={recommended} onChange={(e) => setRecommended(e.target.checked)} />
          Marcar como recomendado (quita la marca de los demás)
        </label>
        <label className="su-check">
          <input type="checkbox" checked={free || active} disabled={free} onChange={(e) => setActive(e.target.checked)} />
          A la venta {free ? '(la Básica siempre lo está)' : '(si lo quitas, quien ya lo tiene lo conserva)'}
        </label>
      </div>

      {error && <div className="form-error-banner">{error}</div>}
      <div className="su-plan__actions">
        <Button variant="primary" onClick={save} disabled={saving || !valid}>
          {saving ? 'Guardando…' : `Guardar ${plan.name}`}
        </Button>
      </div>
    </article>
  )
}
