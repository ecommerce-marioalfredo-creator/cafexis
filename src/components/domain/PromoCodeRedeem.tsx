import { useId, useState, type FormEvent } from 'react'
import { useAsync } from '@/hooks/useAsync'
import { Button } from '@/components/ui/Button'
import { getBusinessPromoStatus, redeemPromoCode } from '@/services/api/superUserService'
import './PromoCodeRedeem.css'

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })

/**
 * "¿Tienes un código de promoción?" en Suscripción (0021). El código se
 * canjea en la base de datos (redeem_promo_code_cafexis), que aplica los días
 * gratis o deja el descuento. Sin la 0021 aplicada, no se muestra.
 */
export function PromoCodeRedeem({ onRedeemed }: { onRedeemed: () => Promise<void> }) {
  const inputId = useId()
  const { data: status, refresh } = useAsync(getBusinessPromoStatus, [])
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const [success, setSuccess] = useState<string>()

  if (!status) return null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    setSaving(true)
    setError(undefined)
    setSuccess(undefined)
    try {
      const result = await redeemPromoCode(code)
      setSuccess(
        result.benefit === 'dias_gratis'
          ? `¡Listo! Código ${result.code}: ${result.summary}.`
          : `¡Listo! Código ${result.code}: ${result.summary}. Se descuenta cuando coordinemos el cobro de tu plan.`,
      )
      setCode('')
      await Promise.all([refresh(), onRedeemed()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aplicar el código.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="promo-redeem" aria-labelledby={`${inputId}-title`}>
      <div className="promo-redeem__text">
        <h3 id={`${inputId}-title`}>¿Tienes un código de promoción?</h3>
        {status.discountPercent ? (
          <p>
            Tienes <strong>{status.discountPercent} % de descuento</strong>
            {status.discountEndsAt ? ` hasta el ${formatDate(status.discountEndsAt)}` : ''}: se aplica al cobrar tu plan.
          </p>
        ) : (
          <p>Escríbelo aquí: puede darte días gratis de un plan o un descuento.</p>
        )}
      </div>
      <form className="promo-redeem__form" onSubmit={submit}>
        <label htmlFor={inputId} className="visually-hidden">
          Código de promoción
        </label>
        <input
          id={inputId}
          value={code}
          placeholder="Ej.: CAFEXIS-7K2M9P"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={40}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <Button variant="secondary" type="submit" disabled={saving || !code.trim()}>
          {saving ? 'Aplicando…' : 'Aplicar'}
        </Button>
      </form>
      {success && (
        <p className="form-success-banner promo-redeem__message" role="status">
          {success}
        </p>
      )}
      {error && (
        <p className="form-error-banner promo-redeem__message" role="alert">
          {error}
        </p>
      )}
      {status.redemptions.length > 0 && (
        <p className="promo-redeem__used">
          Códigos usados:{' '}
          {status.redemptions.map((r) => `${r.code} (${r.summary})`).join(' · ')}
        </p>
      )}
    </section>
  )
}
