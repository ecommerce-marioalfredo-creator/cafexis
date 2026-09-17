import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { Button } from '@/components/ui/Button'
import { useInventory } from '@/hooks/useInventory'
import type { Product, RecipeIngredient } from '@/types/domain'
import './ProductFormModal.css'

interface ProductFormModalProps {
  product?: Product
  onSave: (input: Omit<Product, 'id'>) => Promise<void>
  onClose: () => void
}

interface RecipeLine {
  key: string
  inventoryItemId: string
  quantity: string
}

const EMPTY_LINE = (): RecipeLine => ({ key: crypto.randomUUID(), inventoryItemId: '', quantity: '' })

/**
 * Crea o edita un producto y su receta (ingredientes de inventario + cantidad).
 * La unidad de cada línea se toma del ítem de inventario elegido, para que
 * nunca quede desincronizada con lo que existe en Inventario.
 */
export function ProductFormModal({ product, onSave, onClose }: ProductFormModalProps) {
  const { items: inventoryItems, loading: loadingInventory } = useInventory()

  const [name, setName] = useState(product?.name ?? '')
  const [category, setCategory] = useState(product?.category ?? '')
  const [price, setPrice] = useState(product ? String(product.price) : '')
  const [lines, setLines] = useState<RecipeLine[]>(() =>
    product?.recipe && product.recipe.length > 0
      ? product.recipe.map((r) => ({ key: crypto.randomUUID(), inventoryItemId: r.inventoryItemId, quantity: String(r.quantity) }))
      : [],
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const isEditing = Boolean(product)

  const addLine = () => setLines((prev) => [...prev, EMPTY_LINE()])
  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key))
  const updateLine = (key: string, patch: Partial<RecipeLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'El nombre es obligatorio.'
    const priceNumber = Number(price)
    if (!price || Number.isNaN(priceNumber) || priceNumber <= 0) next.price = 'Ingresa un precio válido.'
    if (lines.some((l) => !l.inventoryItemId)) next.recipe = 'Selecciona un ingrediente en cada línea de la receta.'
    if (lines.some((l) => !l.quantity || Number(l.quantity) <= 0)) next.recipe = 'Ingresa una cantidad válida en cada línea.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const recipe: RecipeIngredient[] = lines.map((l) => {
      const item = inventoryItems.find((i) => i.id === l.inventoryItemId)!
      return {
        inventoryItemId: item.id,
        inventoryItemName: item.name,
        quantity: Number(l.quantity),
        unit: item.unit,
      }
    })

    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        category: category.trim() || 'Bebidas',
        price: Number(price),
        recipe: recipe.length > 0 ? recipe : undefined,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={isEditing ? 'Editar producto' : 'Nuevo producto'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="product-form" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar producto'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} id="product-form">
        <FormField label="Nombre" htmlFor="product-name" error={errors.name}>
          <input id="product-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Latte vainilla" />
        </FormField>

        <FormField label="Categoría" htmlFor="product-category" hint="Ej. Bebidas, Café empacado">
          <input id="product-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Bebidas" />
        </FormField>

        <FormField label="Precio" htmlFor="product-price" error={errors.price}>
          <input
            id="product-price"
            type="number"
            min={0}
            step={100}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="9500"
          />
        </FormField>

        <div className="product-form__recipe">
          <div className="product-form__recipe-header">
            <span>Receta (opcional)</span>
            <button type="button" className="product-form__add-line" onClick={addLine} disabled={loadingInventory}>
              + Agregar ingrediente
            </button>
          </div>

          {lines.length === 0 && <p className="section-subtitle">Sin ingredientes: se trata como producto empacado.</p>}

          {lines.map((line) => {
            const selected = inventoryItems.find((i) => i.id === line.inventoryItemId)
            return (
              <div className="product-form__recipe-line" key={line.key}>
                <select
                  value={line.inventoryItemId}
                  onChange={(e) => updateLine(line.key, { inventoryItemId: e.target.value })}
                  aria-label="Ingrediente"
                >
                  <option value="">Selecciona un ingrediente…</option>
                  {inventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
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
                <span className="product-form__unit">{selected?.unit ?? ''}</span>
                <button
                  type="button"
                  className="product-form__remove-line"
                  onClick={() => removeLine(line.key)}
                  aria-label="Quitar ingrediente"
                >
                  ✕
                </button>
              </div>
            )
          })}

          {errors.recipe && <span className="form-field__error">{errors.recipe}</span>}
        </div>
      </form>
    </Modal>
  )
}
