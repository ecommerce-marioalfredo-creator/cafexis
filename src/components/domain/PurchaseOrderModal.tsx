import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { Button } from '@/components/ui/Button'
import type { InventoryItem, NewPurchaseOrderInput, Supplier } from '@/types/domain'
import './PurchaseOrderModal.css'

interface PurchaseOrderModalProps {
  suppliers: Supplier[]
  inventoryItems: InventoryItem[]
  onSave: (input: NewPurchaseOrderInput) => Promise<void>
  onClose: () => void
  /** Borrador precargado (ej. desde la sugerencia de reposición). */
  initial?: { supplierId?: string; reason?: string; lines: Array<{ inventoryItemId: string; quantity: number }> }
}

interface DraftLine {
  key: string
  inventoryItemId: string
  quantity: string
}

const EMPTY_LINE = (): DraftLine => ({ key: crypto.randomUUID(), inventoryItemId: '', quantity: '' })

/**
 * Orden de compra manual. Nace confirmada (la arma una persona), así que
 * queda lista para "Recibir". La unidad de cada línea es la del insumo en
 * Inventario, para que al recibir se sume sin conversiones.
 */
export function PurchaseOrderModal({ suppliers, inventoryItems, onSave, onClose, initial }: PurchaseOrderModalProps) {
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? '')
  const [reason, setReason] = useState(initial?.reason ?? '')
  const [lines, setLines] = useState<DraftLine[]>(() =>
    initial && initial.lines.length > 0
      ? initial.lines.map((l) => ({ key: crypto.randomUUID(), inventoryItemId: l.inventoryItemId, quantity: String(l.quantity) }))
      : [EMPTY_LINE()],
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const updateLine = (key: string, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!supplierId) next.supplier = 'Selecciona un proveedor.'
    if (lines.length === 0) next.lines = 'Agrega al menos un insumo.'
    else if (lines.some((l) => !l.inventoryItemId)) next.lines = 'Selecciona un insumo en cada línea.'
    else if (lines.some((l) => !l.quantity || Number(l.quantity) <= 0)) next.lines = 'Ingresa una cantidad válida en cada línea.'
    else if (new Set(lines.map((l) => l.inventoryItemId)).size !== lines.length) next.lines = 'Cada insumo debe aparecer una sola vez.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaveError(undefined)
    if (!validate()) return

    setSaving(true)
    try {
      await onSave({
        supplierId,
        reason: reason.trim() || undefined,
        lines: lines.map((l) => {
          const item = inventoryItems.find((i) => i.id === l.inventoryItemId)!
          return { inventoryItemId: item.id, quantity: Number(l.quantity), unit: item.unit }
        }),
      })
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo crear la orden de compra.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Nueva orden de compra"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="purchase-order-form" disabled={saving}>
            {saving ? 'Creando…' : 'Crear orden'}
          </Button>
        </>
      }
    >
      <form id="purchase-order-form" onSubmit={handleSubmit}>
        <FormField
          label="Proveedor"
          htmlFor="po-supplier"
          error={errors.supplier}
          hint={suppliers.length === 0 ? 'Primero agrega un proveedor en la sección Proveedores.' : undefined}
        >
          <select id="po-supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Selecciona un proveedor…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Motivo (opcional)" htmlFor="po-reason">
          <input id="po-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. Pedido semanal" />
        </FormField>

        <div className="po-form__lines">
          <div className="po-form__lines-header">
            <span>Insumos</span>
            <button type="button" className="po-form__add-line" onClick={() => setLines((prev) => [...prev, EMPTY_LINE()])}>
              + Agregar insumo
            </button>
          </div>

          {lines.map((line) => {
            const selected = inventoryItems.find((i) => i.id === line.inventoryItemId)
            return (
              <div className="po-form__line" key={line.key}>
                <select
                  value={line.inventoryItemId}
                  onChange={(e) => updateLine(line.key, { inventoryItemId: e.target.value })}
                  aria-label="Insumo"
                >
                  <option value="">Selecciona un insumo…</option>
                  {inventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} (hay {item.quantity} {item.unit})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={line.quantity}
                  onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                  placeholder="Cantidad"
                  aria-label="Cantidad"
                />
                <span className="po-form__unit">{selected?.unit ?? ''}</span>
                <button
                  type="button"
                  className="po-form__remove-line"
                  onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                  aria-label="Quitar insumo"
                >
                  ✕
                </button>
              </div>
            )
          })}

          {errors.lines && <span className="form-field__error">{errors.lines}</span>}
        </div>

        {saveError && <div className="form-error-banner">{saveError}</div>}
      </form>
    </Modal>
  )
}
