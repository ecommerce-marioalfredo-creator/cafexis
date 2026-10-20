import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import type { Order } from '@/types/domain'

interface CancelOrderModalProps {
  order: Order
  onCancel: (reason: string) => Promise<void>
  onClose: () => void
}

const REASON_MAX_LENGTH = 500

/**
 * Cancela un pedido no entregado (solo administrador o supervisor). La base
 * de datos repone exactamente el inventario que descontó la venta y deja el
 * pedido fuera de las cifras de ventas.
 */
export function CancelOrderModal({ order, onCancel, onClose }: CancelOrderModalProps) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  const handleCancel = async () => {
    setError(undefined)
    setSaving(true)
    try {
      await onCancel(reason)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cancelar el pedido.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`Cancelar pedido · ${order.code}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Volver
          </Button>
          <Button variant="danger" type="button" onClick={handleCancel} disabled={saving}>
            {saving ? 'Cancelando…' : 'Cancelar pedido'}
          </Button>
        </>
      }
    >
      <p>
        Los ingredientes y el café que descontó este pedido vuelven al inventario, y deja de contar como venta. No se
        puede deshacer.
      </p>
      {order.status === 'pendiente_pago' && order.paymentMethod !== 'efectivo' && (
        <p className="section-subtitle">
          Si el cliente alcanzó a pagar en línea, tendrás que devolverle el dinero desde tu cuenta de la pasarela.
        </p>
      )}

      <FormField label="Motivo (opcional)" htmlFor="cancel-order-reason" hint="El cliente lo verá en su historial.">
        <textarea
          id="cancel-order-reason"
          rows={3}
          maxLength={REASON_MAX_LENGTH}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej. El cliente no pasó a recoger"
        />
      </FormField>

      {error && <div className="form-error-banner">{error}</div>}
    </Modal>
  )
}
