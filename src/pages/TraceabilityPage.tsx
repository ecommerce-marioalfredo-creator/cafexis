import { useTraceability } from '@/hooks/useTraceability'
import { TraceabilityCard } from '@/components/domain/TraceabilityCard'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { EmptyState } from '@/components/ui/EmptyState'

export function TraceabilityPage() {
  const { lots, loading, error, reload } = useTraceability()

  if (loading) return <PageLoading label="Cargando lotes de café…" />
  if (error) return <PageError message={error} onRetry={reload} />

  return (
    <div>
      <p className="section-subtitle">
        Cada lote conserva su proceso, variedad y origen hasta la finca cuando existe. Esta historia puede compartirse
        con el cliente final mediante un código QR.
      </p>

      {lots.length === 0 ? (
        <EmptyState title="Aún no hay lotes registrados" />
      ) : (
        <div className="card-grid">
          {lots.map((lot) => (
            <TraceabilityCard key={lot.id} lot={lot} />
          ))}
        </div>
      )}
    </div>
  )
}
