import { useId, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { normalizePromoCode, redeemPromoCode } from '@/services/api/superUserService'
import { errorText, formatDate, promoBenefitText, promoState } from './superUserFormat'
import type { AdminPlan, PlatformAccount, PromoCode } from '@/types/domain'

interface Props {
  account: PlatformAccount
  plans: AdminPlan[]
  /** Códigos para elegir de la lista (los que este negocio aún puede usar). */
  codes: PromoCode[]
  onClose: () => void
  onApplied: (message: string) => Promise<void>
}

/** El super usuario aplica un código de promoción a un negocio, con las mismas reglas que el canje del administrador. */
export function ApplyPromoModal({ account, plans, codes, onClose, onApplied }: Props) {
  const ids = useId()
  const usable = codes.filter((c) => promoState(c) === 'activo' && !c.redemptions.some((r) => r.businessId === account.id))
  const [code, setCode] = useState(usable[0]?.code ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  const selected = codes.find((c) => c.code === normalizePromoCode(code))
  const sub = account.subscription
  const replacesPlan =
    selected?.benefit === 'dias_gratis' && sub && plans.find((p) => p.id === selected.planId)?.code !== sub.effectivePlanCode

  const apply = async () => {
    setSaving(true)
    setError(undefined)
    try {
      const result = await redeemPromoCode(code, account.id)
      await onApplied(`${account.name}: código ${result.code} aplicado (${result.summary}).`)
    } catch (err) {
      setError(errorText(err, 'No se pudo aplicar el código.'))
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`Aplicar código a ${account.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={apply} disabled={saving || !code.trim()}>
            {saving ? 'Aplicando…' : 'Aplicar código'}
          </Button>
        </>
      }
    >
      <FormField
        label="Código"
        htmlFor={`${ids}-code`}
        hint={usable.length === 0 ? 'No hay códigos disponibles para este negocio: crea uno en “Códigos de promoción”.' : undefined}
      >
        <input
          id={`${ids}-code`}
          list={`${ids}-codes`}
          value={code}
          autoComplete="off"
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <datalist id={`${ids}-codes`}>
          {usable.map((c) => (
            <option key={c.id} value={c.code}>
              {promoBenefitText(c, plans)}
            </option>
          ))}
        </datalist>
      </FormField>

      {selected && (
        <p className="su-muted">
          {promoBenefitText(selected, plans)}. Se puede usar hasta el {formatDate(selected.expiresAt)}.
        </p>
      )}
      {replacesPlan && (
        <p className="su-edit__preview su-edit__preview--warning">
          Este código cambia el plan del negocio. Si tiene otro plan pago vigente, ajusta después las fechas en “Editar
          suscripción” para no quitarle lo que ya pagó.
        </p>
      )}
      {error && <div className="form-error-banner">{error}</div>}
    </Modal>
  )
}
