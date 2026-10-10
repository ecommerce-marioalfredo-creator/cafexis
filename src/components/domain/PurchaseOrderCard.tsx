import { useState } from 'react'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus, Supplier } from '@/types/domain'
import './PurchaseOrderCard.css'

const STATUS_META: Record<PurchaseOrderStatus, { label: string; tone: BadgeTone }> = {
  propuesta: { label: 'Pendiente de revisión', tone: 'neutral' },
  confirmada: { label: 'Confirmada · por recibir', tone: 'info' },
  recibida: { label: 'Recibida', tone: 'success' },
  cancelada: { label: 'Cancelada', tone: 'error' },
}

const dateFormat = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' })

interface PurchaseOrderCardProps {
  order: PurchaseOrder
  /** Proveedores del negocio, para elegir uno al confirmar una propuesta. */
  suppliers?: Supplier[]
  onConfirm?: (supplierId: string, lines: PurchaseOrderLine[]) => Promise<void>
  onReceive?: () => Promise<void>
  onCancel?: () => Promise<void>
}

/**
 * Design System sección 14 (Automatización e IA): el usuario conserva el
 * control. Se explica por qué se generó la sugerencia, se diferencia de
 * una acción ya ejecutada, y se permite ajustar proveedor y cantidades
 * (0 = quitar el insumo) antes de confirmar. Recibir suma las cantidades al
 * inventario; cancelar no toca el inventario.
 */
export function PurchaseOrderCard({ order, suppliers = [], onConfirm, onReceive, onCancel }: PurchaseOrderCardProps) {
  const [lines, setLines] = useState(order.lines)
  const [supplierId, setSupplierId] = useState(order.supplierId ?? '')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string>()

  const isProposal = order.status === 'propuesta'
  const meta = STATUS_META[order.status]

  // El proveedor de la orden puede venir del directorio compartido sin estar
  // ligado al negocio: se agrega a las opciones para no perderlo.
  const supplierOptions =
    order.supplierId && !suppliers.some((s) => s.id === order.supplierId)
      ? [{ id: order.supplierId, name: order.supplierName }, ...suppliers]
      : suppliers

  const updateQuantity = (inventoryItemId: string, quantity: number) => {
    setLines((prev) => prev.map((l) => (l.inventoryItemId === inventoryItemId ? { ...l, quantity } : l)))
  }

  const run = async (action: () => Promise<void>) => {
    setActionError(undefined)
    setBusy(true)
    try {
      await action()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo completar la acción.')
    } finally {
      setBusy(false)
    }
  }

  const handleConfirm = () => {
    if (!onConfirm) return
    const kept = lines.filter((l) => l.quantity > 0)
    if (!supplierId) return setActionError('Selecciona un proveedor para confirmar.')
    if (kept.length === 0) return setActionError('Deja al menos un insumo con cantidad mayor a cero.')
    run(() => onConfirm(supplierId, kept))
  }

  const handleReceive = () => {
    if (!onReceive) return
    if (!window.confirm(`¿Marcar ${order.code} como recibida? Las cantidades se sumarán al inventario.`)) return
    run(onReceive)
  }

  const handleCancel = () => {
    if (!onCancel) return
    if (!window.confirm(`¿Cancelar ${order.code}? Esta acción no se puede deshacer.`)) return
    run(onCancel)
  }

  return (
    <article className="po-card">
      <header className="po-card__header">
        <div>
          <strong>{order.code}</strong>
          <span className="po-card__supplier">{order.supplierName || 'Sin proveedor asignado'}</span>
        </div>
        <Badge tone={order.origin === 'sugerida_sistema' ? 'info' : 'neutral'}>
          {order.origin === 'sugerida_sistema' ? 'Sugerida por el sistema' : 'Creada manualmente'}
        </Badge>
      </header>

      {order.reason && <p className="po-card__reason">{order.reason}</p>}

      {isProposal && onConfirm && (
        <select
          className="po-card__supplier-select"
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          aria-label={`Proveedor de ${order.code}`}
        >
          <option value="">Selecciona un proveedor…</option>
          {supplierOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}

      <ul className="po-card__lines">
        {lines.map((line) => (
          <li key={line.inventoryItemId}>
            <span>{line.inventoryItemName}</span>
            {isProposal && onConfirm ? (
              <input
                type="number"
                min={0}
                step={0.01}
                value={line.quantity}
                onChange={(e) => updateQuantity(line.inventoryItemId, Number(e.target.value))}
                aria-label={`Cantidad a comprar de ${line.inventoryItemName}`}
              />
            ) : (
              <span>{line.quantity}</span>
            )}
            <span className="po-card__unit">{line.unit}</span>
          </li>
        ))}
      </ul>

      {order.receivedAt && (
        <p className="po-card__meta">Recibida el {dateFormat.format(new Date(order.receivedAt))}</p>
      )}

      {actionError && <div className="form-error-banner">{actionError}</div>}

      <footer className="po-card__footer">
        <Badge tone={meta.tone}>{meta.label}</Badge>
        <div className="po-card__actions">
          {onCancel && (order.status === 'propuesta' || order.status === 'confirmada') && (
            <Button variant="tertiary" onClick={handleCancel} disabled={busy}>
              {isProposal ? 'Descartar' : 'Cancelar'}
            </Button>
          )}
          {isProposal && onConfirm && (
            <Button variant="primary" onClick={handleConfirm} disabled={busy}>
              Confirmar
            </Button>
          )}
          {order.status === 'confirmada' && onReceive && (
            <Button variant="primary" onClick={handleReceive} disabled={busy}>
              Recibir
            </Button>
          )}
        </div>
      </footer>
    </article>
  )
}
