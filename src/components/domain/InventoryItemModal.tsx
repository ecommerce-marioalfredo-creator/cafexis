import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { Button } from '@/components/ui/Button'
import type { InventoryItem, InventoryItemInput, NewInventoryItemInput, Supplier } from '@/types/domain'
import './InventoryItemModal.css'

interface InventoryItemModalProps {
  item?: InventoryItem
  /** Proveedores del negocio, para elegir a quién proponer la compra cuando el insumo baje del umbral. */
  suppliers?: Supplier[]
  onSave: (input: InventoryItemInput | NewInventoryItemInput) => Promise<void>
  onAdjustQuantity?: (quantity: number) => Promise<void>
  onClose: () => void
}

/**
 * Crea o edita un ingrediente/insumo de inventario. Al crear, pide la
 * existencia inicial; al editar, la existencia se ajusta aparte (campo
 * "Ajustar existencia" con su propio botón) para no mezclar "corregir el
 * umbral" con "registrar una entrada/salida de stock" en un mismo guardado.
 */
export function InventoryItemModal({ item, suppliers = [], onSave, onAdjustQuantity, onClose }: InventoryItemModalProps) {
  const isEditing = Boolean(item)

  const [name, setName] = useState(item?.name ?? '')
  const [unit, setUnit] = useState(item?.unit ?? '')
  const [quantity, setQuantity] = useState(item ? String(item.quantity) : '0')
  const [lowStockThreshold, setLowStockThreshold] = useState(item ? String(item.lowStockThreshold) : '')
  const [preferredSupplierId, setPreferredSupplierId] = useState(item?.preferredSupplierId ?? '')
  const [adjustValue, setAdjustValue] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const [adjusting, setAdjusting] = useState(false)

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'El nombre es obligatorio.'
    if (!unit.trim()) next.unit = 'Indica la unidad (kg, l, uds…).'
    const thresholdNumber = Number(lowStockThreshold)
    if (lowStockThreshold === '' || Number.isNaN(thresholdNumber) || thresholdNumber < 0) {
      next.lowStockThreshold = 'Ingresa un umbral válido.'
    }
    if (!isEditing) {
      const quantityNumber = Number(quantity)
      if (quantity === '' || Number.isNaN(quantityNumber) || quantityNumber < 0) {
        next.quantity = 'Ingresa una existencia inicial válida.'
      }
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaveError(undefined)
    if (!validate()) return

    setSaving(true)
    try {
      const base: InventoryItemInput = {
        name: name.trim(),
        unit: unit.trim(),
        lowStockThreshold: Number(lowStockThreshold),
        preferredSupplierId: preferredSupplierId || undefined,
      }
      await onSave(isEditing ? base : { ...base, quantity: Number(quantity) })
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar el ingrediente.')
    } finally {
      setSaving(false)
    }
  }

  const handleAdjust = async () => {
    if (!onAdjustQuantity) return
    const value = Number(adjustValue)
    if (adjustValue === '' || Number.isNaN(value) || value < 0) {
      setErrors((prev) => ({ ...prev, adjust: 'Ingresa una existencia válida.' }))
      return
    }
    setErrors((prev) => ({ ...prev, adjust: '' }))
    setAdjusting(true)
    try {
      await onAdjustQuantity(value)
      setAdjustValue('')
    } catch (err) {
      setErrors((prev) => ({ ...prev, adjust: err instanceof Error ? err.message : 'No se pudo ajustar la existencia.' }))
    } finally {
      setAdjusting(false)
    }
  }

  return (
    <Modal
      title={isEditing ? 'Editar ingrediente' : 'Nuevo ingrediente'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="inventory-item-form" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} id="inventory-item-form">
        <FormField label="Nombre" htmlFor="inventory-name" error={errors.name}>
          <input id="inventory-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Leche entera" />
        </FormField>

        <FormField label="Unidad" htmlFor="inventory-unit" error={errors.unit} hint="Ej. kg, l, uds">
          <input id="inventory-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg" />
        </FormField>

        {!isEditing && (
          <FormField label="Existencia inicial" htmlFor="inventory-quantity" error={errors.quantity}>
            <input
              id="inventory-quantity"
              type="number"
              min={0}
              step={0.01}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </FormField>
        )}

        <FormField
          label="Umbral de alerta"
          htmlFor="inventory-threshold"
          error={errors.lowStockThreshold}
          hint="Cuando la existencia baje a este nivel o menos, se marcará como 'Próximo a agotarse'."
        >
          <input
            id="inventory-threshold"
            type="number"
            min={0}
            step={0.01}
            value={lowStockThreshold}
            onChange={(e) => setLowStockThreshold(e.target.value)}
          />
        </FormField>

        <FormField
          label="Proveedor preferido (opcional)"
          htmlFor="inventory-supplier"
          hint="A quién se le propone la compra automática cuando este insumo baje del umbral."
        >
          <select id="inventory-supplier" value={preferredSupplierId} onChange={(e) => setPreferredSupplierId(e.target.value)}>
            <option value="">Sin proveedor preferido</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </FormField>

        {saveError && <div className="form-error-banner">{saveError}</div>}
      </form>

      {isEditing && onAdjustQuantity && (
        <div className="inventory-item-form__adjust">
          <FormField
            label="Ajustar existencia"
            htmlFor="inventory-adjust"
            error={errors.adjust}
            hint={`Existencia actual: ${item?.quantity} ${item?.unit}. Ingresa el nuevo total.`}
          >
            <div className="inventory-item-form__adjust-row">
              <input
                id="inventory-adjust"
                type="number"
                min={0}
                step={0.01}
                value={adjustValue}
                onChange={(e) => setAdjustValue(e.target.value)}
                placeholder="Nueva existencia total"
              />
              <Button variant="secondary" type="button" onClick={handleAdjust} disabled={adjusting}>
                {adjusting ? 'Ajustando…' : 'Ajustar'}
              </Button>
            </div>
          </FormField>
        </div>
      )}
    </Modal>
  )
}
