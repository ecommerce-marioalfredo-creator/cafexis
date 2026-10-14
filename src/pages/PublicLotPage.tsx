import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { Badge } from '@/components/ui/Badge'
import { getPublicCoffeeLot } from '@/services/api/publicTraceabilityService'
import type { PublicCoffeeLot, CoffeeProcess } from '@/types/domain'
import './PublicLotPage.css'

const PROCESS_LABEL: Record<CoffeeProcess, string> = {
  lavado: 'Lavado',
  honey: 'Honey',
  natural: 'Natural',
  otro: 'Otro proceso',
}

/**
 * Página pública de trazabilidad de un lote (lo que abre el QR real de
 * TraceabilityCard.tsx): no requiere sesión — es la entrada más sencilla
 * al lado del cliente, según el alcance de la Fase 5.
 */
export function PublicLotPage() {
  const { lotId } = useParams()
  const [lot, setLot] = useState<PublicCoffeeLot>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  const load = () => {
    if (!lotId) return
    setLoading(true)
    setError(undefined)
    getPublicCoffeeLot(lotId)
      .then(setLot)
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar este lote.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [lotId])

  if (loading) return <PageLoading label="Cargando la historia de este café…" />
  if (error) return <PageError message={error} onRetry={load} />
  if (!lot) {
    return (
      <PublicLayout>
        <div className="public-lot__not-found">Este lote no existe o ya no está disponible.</div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <article className="public-lot">
        <header className="public-lot__header">
          <div>
            <p className="public-lot__business">{lot.businessName}</p>
            <h1>{lot.code}</h1>
            <span className="public-lot__variety">
              {lot.variety} · {PROCESS_LABEL[lot.process]}
            </span>
          </div>
          <Badge tone="info">{lot.quantityKg} kg disponibles</Badge>
        </header>

        <p className="public-lot__origin">
          {lot.origin.farm ? `${lot.origin.farm} · ` : ''}
          {lot.origin.region}, {lot.origin.country} · Cosecha {lot.harvestYear}
        </p>

        {lot.story && <p className="public-lot__story">{lot.story}</p>}
      </article>
    </PublicLayout>
  )
}
