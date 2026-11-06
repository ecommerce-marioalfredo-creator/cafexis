import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { PAYMENT_LABEL, SALE_PAYMENT_METHODS, currency } from './paymentMethods'
import type { Order, PaymentMethod } from '@/types/domain'
import './ConfirmPaymentModal.css'

interface ConfirmPaymentModalProps {
  order: Order
  onConfirm: (paymentMethod: PaymentMethod) => Promise<void>
  onClose: () => void
}

/**
 * Confirma que el cliente pagó un pedido público "por confirmar". El pedido
 * pasa directo a "En preparación". Trae marcada la forma de pago que eligió el
 * cliente, y se puede corregir si pagó de otra manera.
 */
export function ConfirmPaymentModal({ order, onConfirm, onClose }: ConfirmPaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    SALE_PAYMENT_METHODS.includes(order.paymentMethod) ? order.paymentMethod : 'efectivo',
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  const handleConfirm = async () => {
    setError(undefined)
    setSaving(true)
    try {
      await onConfirm(paymentMethod)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo confirmar el pago.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`Confirmar pago · ${order.code}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Volver
          </Button>
          <Button variant="primary" type="button" onClick={handleConfirm} disabled={saving}>
            {saving ? 'Confirmando…' : `Recibí ${currency.format(order.total)}`}
          </Button>
        </>
      }
    >
      <p>
        Confirma que {order.customerName} ya pagó <strong>{currency.format(order.total)}</strong>. El pedido pasará a
        “En preparación”.
      </p>

      <div className="confirm-payment__methods" role="radiogroup" aria-label="Método con el que pagó">
        <span className="confirm-payment__label">¿Cómo pagó?</span>
        <div className="page-toolbar__filters">
          {SALE_PAYMENT_METHODS.map((method) => (
            <button
              type="button"
              key={method}
              role="radio"
              aria-checked={paymentMethod === method}
              className={['filter-chip', paymentMethod === method ? 'filter-chip--active' : ''].join(' ')}
              onClick={() => setPaymentMethod(method)}
            >
              {PAYMENT_LABEL[method]}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="form-error-banner">{error}</div>}
    </Modal>
  )
}
