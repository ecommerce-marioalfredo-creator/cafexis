import { useState } from 'react'
import { useTraceability } from '@/hooks/useTraceability'
import { TraceabilityCard } from '@/components/domain/TraceabilityCard'
import { CoffeeLotModal } from '@/components/domain/CoffeeLotModal'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import type { CoffeeLot } from '@/types/domain'

export function TraceabilityPage() {
  const { lots, loading, error, reload, create, update } = useTraceability()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingLot, setEditingLot] = useState<CoffeeLot>()

  if (loading) return <PageLoading label="Cargando lotes de café…" />
  if (error) return <PageError message={error} onRetry={reload} />

  const openCreate = () => {
    setEditingLot(undefined)
    setModalOpen(true)
  }

  const openEdit = (lot: CoffeeLot) => {
    setEditingLot(lot)
    setModalOpen(true)
  }

  const closeModal = () => setModalOpen(false)

  const handleSave = async (input: Parameters<typeof create>[0]) => {
    if (editingLot) {
      await update(editingLot.id, input)
    } else {
      await create(input)
    }
  }

  return (
    <div>
      <div className="page-toolbar">
        <p className="section-subtitle">
          Cada lote conserva su proceso, variedad y origen hasta la finca cuando existe. Esta historia puede compartirse
          con el cliente final mediante un código QR.
        </p>
        <Button variant="primary" onClick={openCreate}>
          Nuevo lote
        </Button>
      </div>

      {lots.length === 0 ? (
        <EmptyState title="Aún no hay lotes registrados" />
      ) : (
        <div className="card-grid">
          {lots.map((lot) => (
            <TraceabilityCard key={lot.id} lot={lot} onEdit={openEdit} />
          ))}
        </div>
      )}

      {modalOpen && <CoffeeLotModal lot={editingLot} onSave={handleSave} onClose={closeModal} />}
    </div>
  )
}
