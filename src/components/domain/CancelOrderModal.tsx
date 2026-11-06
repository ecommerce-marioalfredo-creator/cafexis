import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import type { Order } from '@/types/domain'

interface CancelOrderModalProps {
  order: Order
  /** Quién cancela: cambia lo que se le explica y a quién le llegará el motivo. */
  audience: 'negocio' | 'cliente'
  onCancel: (reason: string) => Promise<void>
  onClose: () => void
}

const REASON_MAX_LENGTH = 500

/**
 * Cancela un pedido no entregado. El pedido no se borra: queda como cancelado
 * en los históricos, la base de datos repone exactamente el inventario que
 * descontó y avisa a las dos partes (0016_cancelacion_y_avisos_cafexis.sql).
 */
export function CancelOrderModal({ order, audience, onCancel, onClose }: CancelOrderModalProps) {
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
      {audience === 'cliente' ? (
        <p>Le avisaremos al negocio y el pedido quedará como cancelado en tu historial. No se puede deshacer.</p>
      ) : (
        <>
          <p>
            Los ingredientes y el café que descontó este pedido vuelven al inventario y deja de contar como venta. Si el
            cliente pidió desde el catálogo, recibirá un aviso. No se puede deshacer.
          </p>
          <p className="section-subtitle">Si el cliente ya pagó, devuélvele el dinero aparte: esta acción no mueve dinero.</p>
        </>
      )}

      <FormField
        label="Motivo (opcional)"
        htmlFor="cancel-order-reason"
        hint={audience === 'cliente' ? 'El negocio lo verá en el aviso.' : 'El cliente lo verá en su historial.'}
      >
        <textarea
          id="cancel-order-reason"
          rows={3}
          maxLength={REASON_MAX_LENGTH}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={audience === 'cliente' ? 'Ej. Ya no alcanzo a esperar' : 'Ej. El cliente no pasó a recoger'}
        />
      </FormField>

      {error && <div className="form-error-banner">{error}</div>}
    </Modal>
  )
}
