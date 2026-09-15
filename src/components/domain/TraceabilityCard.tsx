import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { CoffeeLot } from '@/types/domain'
import './TraceabilityCard.css'

const PROCESS_LABEL: Record<CoffeeLot['process'], string> = {
  lavado: 'Lavado',
  honey: 'Honey',
  natural: 'Natural',
  otro: 'Otro proceso',
}

/**
 * Design System sección 15: la trazabilidad es diferenciador de marca.
 * Muestra origen (hasta la finca cuando exista), variedad, proceso,
 * historia y acceso al QR que verá el cliente final.
 */
export function TraceabilityCard({ lot }: { lot: CoffeeLot }) {
  const [showQr, setShowQr] = useState(false)

  return (
    <article className="trace-card">
      <header className="trace-card__header">
        <div>
          <strong>{lot.code}</strong>
          <span className="trace-card__variety">
            {lot.variety} · {PROCESS_LABEL[lot.process]}
          </span>
        </div>
        <Badge tone="info">{lot.quantityKg} kg disponibles</Badge>
      </header>

      <p className="trace-card__origin">
        {lot.origin.farm ? `${lot.origin.farm} · ` : ''}
        {lot.origin.region}, {lot.origin.country} · Cosecha {lot.harvestYear}
      </p>

      {lot.story && <p className="trace-card__story">{lot.story}</p>}

      <footer className="trace-card__footer">
        <Button variant="tertiary" onClick={() => setShowQr((v) => !v)}>
          {showQr ? 'Ocultar código QR' : 'Ver código QR para el cliente'}
        </Button>
        {showQr && (
          <div className="trace-card__qr" role="img" aria-label={`Código QR de trazabilidad para el lote ${lot.code}`}>
            QR
          </div>
        )}
      </footer>
    </article>
  )
}
