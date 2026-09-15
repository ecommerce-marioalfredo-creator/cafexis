import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { PurchaseOrder } from '@/types/domain'
import './PurchaseOrderCard.css'

interface PurchaseOrderCardProps {
  order: PurchaseOrder
  onConfirm?: (lines: PurchaseOrder['lines']) => void
}

/**
 * Design System sección 14 (Automatización e IA): el usuario conserva el
 * control. Se explica por qué se generó la sugerencia, se diferencia de
 * una acción ya ejecutada, y se permite aceptar o editar cantidades antes
 * de confirmar.
 */
export function PurchaseOrderCard({ order, onConfirm }: PurchaseOrderCardProps) {
  const [lines, setLines] = useState(order.lines)
  const isProposal = order.status === 'propuesta'

  const updateQuantity = (inventoryItemId: string, quantity: number) => {
    setLines((prev) => prev.map((l) => (l.inventoryItemId === inventoryItemId ? { ...l, quantity } : l)))
  }

  return (
    <article className="po-card">
      <header className="po-card__header">
        <div>
          <strong>{order.code}</strong>
          <span className="po-card__supplier">{order.supplierName}</span>
        </div>
        <Badge tone={order.origin === 'sugerida_sistema' ? 'info' : 'neutral'}>
          {order.origin === 'sugerida_sistema' ? 'Sugerida por el sistema' : 'Creada manualmente'}
        </Badge>
      </header>

      {order.reason && <p className="po-card__reason">{order.reason}</p>}

      <ul className="po-card__lines">
        {lines.map((line) => (
          <li key={line.inventoryItemId}>
            <span>{line.inventoryItemName}</span>
            {isProposal ? (
              <input
                type="number"
                min={0}
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

      <footer className="po-card__footer">
        <Badge tone={order.status === 'confirmada' || order.status === 'recibida' ? 'success' : 'neutral'}>
          {order.status === 'propuesta' && 'Pendiente de revisión'}
          {order.status === 'confirmada' && 'Confirmada'}
          {order.status === 'recibida' && 'Recibida'}
          {order.status === 'cancelada' && 'Cancelada'}
        </Badge>
        {isProposal && onConfirm && (
          <Button variant="primary" onClick={() => onConfirm(lines)}>
            Confirmar orden
          </Button>
        )}
      </footer>
    </article>
  )
}
