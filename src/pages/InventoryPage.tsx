import { useMemo, useState } from 'react'
import { useInventory } from '@/hooks/useInventory'
import { useSuppliers } from '@/hooks/useSuppliers'
import { InventoryRow } from '@/components/domain/InventoryRow'
import { InventoryItemModal } from '@/components/domain/InventoryItemModal'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import type { InventoryItem, InventoryItemInput, NewInventoryItemInput, StockStatus } from '@/types/domain'

const FILTERS: Array<{ value: StockStatus | 'todos'; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'bajo', label: 'Próximos a agotarse' },
  { value: 'agotado', label: 'Agotados' },
  { value: 'ok', label: 'Disponibles' },
]

export function InventoryPage() {
  const { items, loading, error, reload, create, update, adjustQuantity } = useInventory()
  const { suppliers } = useSuppliers()
  const [filter, setFilter] = useState<StockStatus | 'todos'>('todos')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem>()

  const filtered = useMemo(
    () => (filter === 'todos' ? items : items.filter((i) => i.status === filter)),
    [items, filter],
  )

  if (loading) return <PageLoading label="Cargando inventario…" />
  if (error) return <PageError message={error} onRetry={reload} />

  const openCreate = () => {
    setEditingItem(undefined)
    setModalOpen(true)
  }

  const openEdit = (item: InventoryItem) => {
    setEditingItem(item)
    setModalOpen(true)
  }

  const closeModal = () => setModalOpen(false)

  const handleSave = async (input: InventoryItemInput | NewInventoryItemInput) => {
    if (editingItem) {
      await update(editingItem.id, input)
    } else {
      await create(input as NewInventoryItemInput)
    }
  }

  return (
    <div>
      <div className="page-toolbar">
        <div className="page-toolbar__filters">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              className={['filter-chip', filter === f.value ? 'filter-chip--active' : ''].join(' ')}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button variant="primary" onClick={openCreate}>
          Nuevo ingrediente
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No hay ingredientes en esta categoría" />
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ingrediente / insumo</th>
                <th>Existencia</th>
                <th>Umbral de alerta</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <InventoryRow key={item.id} item={item} onEdit={openEdit} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <InventoryItemModal
          item={editingItem}
          suppliers={suppliers}
          onSave={handleSave}
          onAdjustQuantity={editingItem ? (quantity) => adjustQuantity(editingItem.id, quantity) : undefined}
          onClose={closeModal}
        />
      )}
    </div>
  )
}
