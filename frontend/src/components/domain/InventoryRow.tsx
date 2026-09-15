import { Badge } from '@/components/ui/Badge'
import type { InventoryItem, StockStatus } from '@/types/domain'
import './InventoryRow.css'

const STATUS_META: Record<StockStatus, { label: string; tone: 'success' | 'warning' | 'error' }> = {
  ok: { label: 'Disponible', tone: 'success' },
  bajo: { label: 'Próximo a agotarse', tone: 'warning' },
  agotado: { label: 'Agotado', tone: 'error' },
}

export function InventoryRow({ item }: { item: InventoryItem }) {
  const meta = STATUS_META[item.status]
  return (
    <tr className="inventory-row">
      <td className="inventory-row__name">{item.name}</td>
      <td>
        {item.quantity} {item.unit}
      </td>
      <td>
        {item.lowStockThreshold} {item.unit}
      </td>
      <td>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </td>
    </tr>
  )
}
