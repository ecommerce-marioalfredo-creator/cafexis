import { useMemo, useState } from 'react'
import { useInventory } from '@/hooks/useInventory'
import { InventoryRow } from '@/components/domain/InventoryRow'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { EmptyState } from '@/components/ui/EmptyState'
import type { StockStatus } from '@/types/domain'

const FILTERS: Array<{ value: StockStatus | 'todos'; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'bajo', label: 'Próximos a agotarse' },
  { value: 'agotado', label: 'Agotados' },
  { value: 'ok', label: 'Disponibles' },
]

export function InventoryPage() {
  const { items, loading, error, reload } = useInventory()
  const [filter, setFilter] = useState<StockStatus | 'todos'>('todos')

  const filtered = useMemo(
    () => (filter === 'todos' ? items : items.filter((i) => i.status === filter)),
    [items, filter],
  )

  if (loading) return <PageLoading label="Cargando inventario…" />
  if (error) return <PageError message={error} onRetry={reload} />

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
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <InventoryRow key={item.id} item={item} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
