import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormField } from '@/components/ui/FormField'
import { QuantityStepper } from '@/components/domain/QuantityStepper'
import { PAYMENT_LABEL, SALE_PAYMENT_METHODS, currency } from '@/components/domain/paymentMethods'
import { itemCountLabel, type CartLine } from '@/hooks/useCustomerCart'
import type { PaymentMethod } from '@/types/domain'
import './OrderReview.css'

interface OrderReviewProps {
  lines: CartLine[]
  total: number
  itemCount: number
  onChangeQuantity: (productId: string, delta: number) => void
  /** Vuelve al menú con el carrito intacto. */
  onBack: () => void
  /** Sin sesión se puede revisar el pedido, pero enviarlo exige conectarse. */
  connected: boolean
  onConnect: () => void
  /** Cafetería o mixto: el cliente indica su mesa (o "para llevar"). */
  showTableField: boolean
  tableOrReference: string
  onTableOrReferenceChange: (value: string) => void
  paymentMethod: PaymentMethod
  onPaymentMethodChange: (method: PaymentMethod) => void
  submitting: boolean
  /** Además de mientras se envía, mientras se vincula al cliente con el negocio. */
  submitDisabled: boolean
  error?: string
  onSubmit: () => void
}

/**
 * Paso "Tu pedido" del catálogo público, como la pantalla de revisión de los
 * kioscos de autoservicio: el cliente ve todo lo que pidió, ajusta cantidades,
 * elige mesa y forma de pago, y solo entonces envía. El total y el botón de
 * enviar quedan siempre a la vista al fondo de la pantalla.
 */
export function OrderReview({
  lines,
  total,
  itemCount,
  onChangeQuantity,
  onBack,
  connected,
  onConnect,
  showTableField,
  tableOrReference,
  onTableOrReferenceChange,
  paymentMethod,
  onPaymentMethodChange,
  submitting,
  submitDisabled,
  error,
  onSubmit,
}: OrderReviewProps) {
  return (
    <div className="order-review">
      <Button variant="tertiary" className="order-review__back" onClick={onBack}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Seguir comprando
      </Button>

      <header className="order-review__header">
        <h1>Tu pedido</h1>
        {lines.length > 0 && <p>Revisa que todo esté bien antes de enviarlo.</p>}
      </header>

      {lines.length === 0 ? (
        <div className="order-review__empty">
          <EmptyState title="Tu pedido está vacío" description="Agrega productos desde el menú para armar tu pedido." />
          <Button variant="primary" onClick={onBack}>
            Ver el menú
          </Button>
        </div>
      ) : (
        <>
          <ul className="order-review__lines">
            {lines.map(({ product, quantity }) => (
              <li key={product.id} className="order-review__line">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt="" className="order-review__thumb" />
                ) : (
                  <span className="order-review__thumb order-review__thumb--empty" aria-hidden="true">
                    ☕
                  </span>
                )}
                <div className="order-review__line-info">
                  <span className="order-review__line-name">{product.name}</span>
                  <span className="order-review__line-unit">{currency.format(product.price)} c/u</span>
                </div>
                <QuantityStepper
                  className="order-review__line-stepper"
                  name={product.name}
                  quantity={quantity}
                  onChange={(delta) => onChangeQuantity(product.id, delta)}
                />
                <strong className="order-review__line-subtotal">{currency.format(product.price * quantity)}</strong>
              </li>
            ))}
          </ul>

          {showTableField && (
            <section className="order-review__section">
              <h2>¿Dónde lo recibes?</h2>
              <FormField label="Mesa" htmlFor="order-review-table" hint="Ej. Mesa 4, Para llevar">
                <input
                  id="order-review-table"
                  value={tableOrReference}
                  onChange={(e) => onTableOrReferenceChange(e.target.value)}
                />
              </FormField>
            </section>
          )}

          <section className="order-review__section">
            <h2 id="order-review-payment">¿Cómo vas a pagar?</h2>
            <div className="order-review__payment" role="radiogroup" aria-labelledby="order-review-payment">
              {SALE_PAYMENT_METHODS.map((method) => {
                const selected = paymentMethod === method
                return (
                  <button
                    type="button"
                    key={method}
                    role="radio"
                    aria-checked={selected}
                    className={['order-review__payment-option', selected ? 'order-review__payment-option--active' : ''].join(' ')}
                    onClick={() => onPaymentMethodChange(method)}
                  >
                    {selected && (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    )}
                    {PAYMENT_LABEL[method]}
                  </button>
                )
              })}
            </div>
            <p className="order-review__hint">Pagas en el negocio; el equipo confirma tu pago y empieza a prepararlo.</p>
          </section>

          <div className="order-review__dock">
            {error && <div className="form-error-banner">{error}</div>}
            <div className="order-review__total" aria-live="polite">
              <span>Total · {itemCountLabel(itemCount)}</span>
              <strong>{currency.format(total)}</strong>
            </div>
            {connected ? (
              <Button variant="primary" className="btn--block order-review__submit" disabled={submitDisabled} onClick={onSubmit}>
                {submitting ? 'Enviando…' : 'Enviar pedido'}
              </Button>
            ) : (
              <>
                <p className="order-review__connect">Conéctate para enviar tu pedido.</p>
                <Button variant="primary" className="btn--block order-review__submit" onClick={onConnect}>
                  Conectarse
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
