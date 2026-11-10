import { useId, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { createPromoCode, normalizePromoCode, updatePromoCode } from '@/services/api/superUserService'
import {
  addMonthsInput,
  endOfDayIso,
  errorText,
  generatePromoCode,
  promoBenefitText,
  toDateInput,
  todayInput,
} from './superUserFormat'
import type { AdminPlan, PromoBenefit, PromoCode, PromoCodeInput } from '@/types/domain'

interface Props {
  plans: AdminPlan[]
  /** Sin código: crear uno nuevo. */
  promo?: PromoCode
  onClose: () => void
  onSaved: (message: string) => Promise<void>
}

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,39}$/

const toInt = (value: string) => (value.trim() === '' ? undefined : Number(value))

/**
 * Crear o editar un código de promoción. Un código que ya se usó conserva lo
 * que dio: solo cambian la descripción, el vencimiento, el tope y si está
 * activo (la base de datos también lo exige).
 */
export function PromoCodeFormModal({ plans, promo, onClose, onSaved }: Props) {
  const ids = useId()
  const paidPlans = plans.filter((p) => p.monthlyPrice > 0)
  const used = (promo?.redemptions.length ?? 0) > 0

  const [code, setCode] = useState(promo?.code ?? generatePromoCode())
  const [description, setDescription] = useState(promo?.description ?? '')
  const [benefit, setBenefit] = useState<PromoBenefit>(promo?.benefit ?? 'dias_gratis')
  const [planId, setPlanId] = useState(
    promo ? (promo.planId ?? '') : (paidPlans.find((p) => p.code === 'premium') ?? paidPlans[0])?.id ?? '',
  )
  const [freeDays, setFreeDays] = useState(String(promo?.freeDays ?? 30))
  const [discountPercent, setDiscountPercent] = useState(String(promo?.discountPercent ?? 20))
  const [discountMonths, setDiscountMonths] = useState(String(promo?.discountMonths ?? 3))
  const [expires, setExpires] = useState(promo ? toDateInput(promo.expiresAt) : addMonthsInput('', 1))
  const [maxRedemptions, setMaxRedemptions] = useState(promo?.maxRedemptions ? String(promo.maxRedemptions) : '')
  const [active, setActive] = useState(promo?.active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  const normalized = normalizePromoCode(code)
  const days = toInt(freeDays)
  const percent = toInt(discountPercent)
  const months = toInt(discountMonths)
  const max = toInt(maxRedemptions)

  const errors = {
    code: CODE_PATTERN.test(normalized) ? undefined : 'De 3 a 40 caracteres: letras sin tilde, números, guion o guion bajo.',
    plan: benefit === 'dias_gratis' && !planId ? 'Elige el plan que regala el código.' : undefined,
    days:
      benefit === 'dias_gratis' && !(Number.isInteger(days) && days! >= 1 && days! <= 366) ? 'Entre 1 y 366 días.' : undefined,
    percent:
      benefit === 'descuento' && !(Number.isInteger(percent) && percent! >= 1 && percent! <= 100) ? 'Entre 1 y 100.' : undefined,
    months:
      benefit === 'descuento' && !(Number.isInteger(months) && months! >= 1 && months! <= 36) ? 'Entre 1 y 36 meses.' : undefined,
    expires: !expires
      ? 'Elige hasta cuándo se puede usar.'
      : !promo && expires < todayInput()
        ? 'La fecha ya pasó.'
        : undefined,
    max: max !== undefined && !(Number.isInteger(max) && max >= 1) ? 'Un número entero mayor que 0, o vacío.' : undefined,
  }
  const valid = Object.values(errors).every((e) => !e)

  const input: PromoCodeInput = {
    code: normalized,
    description,
    benefit,
    planId: planId || undefined,
    freeDays: days,
    discountPercent: percent,
    discountMonths: months,
    expiresAt: expires ? endOfDayIso(expires) : '',
    maxRedemptions: max,
    active,
  }

  const save = async () => {
    if (!valid) return
    setSaving(true)
    setError(undefined)
    try {
      if (promo) await updatePromoCode(promo.id, input)
      else await createPromoCode(input)
      await onSaved(promo ? `Guardaste el código ${normalized}.` : `Creaste el código ${normalized}.`)
    } catch (err) {
      setError(errorText(err, 'No se pudo guardar el código.'))
      setSaving(false)
    }
  }

  return (
    <Modal
      title={promo ? `Editar código ${promo.code}` : 'Nuevo código de promoción'}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save} disabled={saving || !valid}>
            {saving ? 'Guardando…' : promo ? 'Guardar código' : 'Crear código'}
          </Button>
        </>
      }
    >
      <div className="su-edit">
        {used && (
          <p className="su-edit__preview">
            Este código ya lo usaron {promo!.redemptions.length} negocio(s): su beneficio no cambia. Puedes cambiar la
            descripción, el vencimiento, el tope de usos o desactivarlo.
          </p>
        )}

        <div className="su-edit__grid">
          <FormField label="Código" htmlFor={`${ids}-code`} error={errors.code} hint="Lo escribe el cliente en Suscripción.">
            <span className="su-code-input">
              <input
                id={`${ids}-code`}
                value={code}
                disabled={used}
                autoComplete="off"
                maxLength={40}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
              {!used && (
                <Button variant="secondary" type="button" onClick={() => setCode(generatePromoCode())}>
                  Generar
                </Button>
              )}
            </span>
          </FormField>

          <FormField label="Descripción (opcional)" htmlFor={`${ids}-desc`} hint="Solo la ves tú. Ej.: Feria del café 2026.">
            <input id={`${ids}-desc`} value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} />
          </FormField>
        </div>

        <fieldset className="su-edit__discount" disabled={used}>
          <legend>Qué da el código</legend>
          <div className="page-toolbar__filters" role="radiogroup" aria-label="Tipo de beneficio">
            {(
              [
                ['dias_gratis', 'Días gratis de un plan'],
                ['descuento', 'Descuento en el precio'],
              ] as Array<[PromoBenefit, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={benefit === value}
                className={['filter-chip', benefit === value ? 'filter-chip--active' : ''].join(' ')}
                onClick={() => {
                  setBenefit(value)
                  if (value === 'dias_gratis' && !planId) setPlanId(paidPlans[0]?.id ?? '')
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="su-edit__grid">
            <FormField label="Plan" htmlFor={`${ids}-plan`} error={errors.plan}>
              <select id={`${ids}-plan`} value={planId} onChange={(e) => setPlanId(e.target.value)}>
                {benefit === 'descuento' && <option value="">Cualquier plan pago</option>}
                {paidPlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </FormField>

            {benefit === 'dias_gratis' ? (
              <FormField
                label="Días gratis"
                htmlFor={`${ids}-days`}
                error={errors.days}
                hint="Se aplica al instante. Si ya tiene ese plan, se suman al final."
              >
                <input
                  id={`${ids}-days`}
                  type="number"
                  min={1}
                  max={366}
                  inputMode="numeric"
                  value={freeDays}
                  onChange={(e) => setFreeDays(e.target.value)}
                />
              </FormField>
            ) : (
              <>
                <FormField label="Descuento (%)" htmlFor={`${ids}-pct`} error={errors.percent}>
                  <input
                    id={`${ids}-pct`}
                    type="number"
                    min={1}
                    max={100}
                    inputMode="numeric"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                  />
                </FormField>
                <FormField
                  label="Durante (meses)"
                  htmlFor={`${ids}-months`}
                  error={errors.months}
                  hint="Cuenta desde el día en que se usa el código."
                >
                  <input
                    id={`${ids}-months`}
                    type="number"
                    min={1}
                    max={36}
                    inputMode="numeric"
                    value={discountMonths}
                    onChange={(e) => setDiscountMonths(e.target.value)}
                  />
                </FormField>
              </>
            )}
          </div>
        </fieldset>

        <div className="su-edit__grid">
          <FormField
            label="Se puede usar hasta"
            htmlFor={`${ids}-expires`}
            error={errors.expires}
            hint="Después de esta fecha nadie lo puede usar. Lo que ya se dio no se pierde."
          >
            <input
              id={`${ids}-expires`}
              type="date"
              min={promo ? undefined : todayInput()}
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
            />
          </FormField>

          <FormField
            label="Tope de usos (opcional)"
            htmlFor={`${ids}-max`}
            error={errors.max}
            hint="Cuántos negocios lo pueden usar. Vacío: sin tope. Cada negocio, una sola vez."
          >
            <input
              id={`${ids}-max`}
              type="number"
              min={1}
              inputMode="numeric"
              value={maxRedemptions}
              onChange={(e) => setMaxRedemptions(e.target.value)}
            />
          </FormField>
        </div>

        <label className="su-check">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Activo (se puede usar)
        </label>

        {valid && (
          <p className="su-edit__preview">
            <strong>{normalized}</strong>: {promoBenefitText(input, plans)}. Se puede usar hasta el{' '}
            {new Date(input.expiresAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
            {max ? `, por ${max} negocio${max === 1 ? '' : 's'}` : ''}.
          </p>
        )}
        {error && <div className="form-error-banner">{error}</div>}
      </div>
    </Modal>
  )
}
