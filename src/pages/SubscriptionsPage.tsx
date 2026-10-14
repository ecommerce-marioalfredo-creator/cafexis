import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useSubscription, useAllSubscriptions } from '@/hooks/useSubscription'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { BadgeTone } from '@/components/ui/Badge'
import type { SubscriptionStatus } from '@/types/domain'
import './SubscriptionsPage.css'

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trial: 'Período de prueba',
  activa: 'Activa',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
}

const STATUS_TONE: Record<SubscriptionStatus, BadgeTone> = {
  trial: 'info',
  activa: 'success',
  vencida: 'error',
  cancelada: 'neutral',
}

function formatDate(iso?: string): string {
  if (!iso) return 'Sin fecha límite'
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Suscripciones (Fase 6). El administrador de un negocio solo ve el estado
 * del suyo (useSubscription); el supervisor técnico, además, ve y cambia
 * el de cualquier negocio (useAllSubscriptions) — igual distinción que ya
 * hace RLS en 0012_fase6_integraciones_cafexis.sql.
 */
export function SubscriptionsPage() {
  const { user } = useAuth()
  const isSupervisor = user?.role === 'supervisor_tecnico'

  const { subscription, loading: loadingMine, error: errorMine, reload: reloadMine } = useSubscription()
  const { subscriptions, loading: loadingAll, error: errorAll, updateStatus } = useAllSubscriptions()

  const [savingId, setSavingId] = useState<string>()

  if (loadingMine || (isSupervisor && loadingAll)) return <PageLoading label="Cargando suscripción…" />
  if (errorMine) return <PageError message={errorMine} onRetry={reloadMine} />
  if (isSupervisor && errorAll) return <PageError message={errorAll} />

  const handleChange = async (businessId: string, status: SubscriptionStatus) => {
    setSavingId(businessId)
    try {
      await updateStatus(businessId, status)
    } finally {
      setSavingId(undefined)
    }
  }

  return (
    <div className="section-stack">
      <section>
        <h3>Tu suscripción</h3>
        {subscription ? (
          <Card>
            <div className="subscriptions-page__row">
              <Badge tone={STATUS_TONE[subscription.status]}>{STATUS_LABEL[subscription.status]}</Badge>
              {subscription.planName && <span className="section-subtitle">Plan {subscription.planName}</span>}
            </div>
            {subscription.status === 'trial' && (
              <p className="section-subtitle">Tu prueba termina el {formatDate(subscription.trialEndsAt)}.</p>
            )}
            {subscription.status === 'activa' && (
              <p className="section-subtitle">
                {subscription.currentPeriodEndsAt
                  ? `Tu suscripción vence el ${formatDate(subscription.currentPeriodEndsAt)}.`
                  : 'Tu suscripción está activa, sin fecha de vencimiento.'}
              </p>
            )}
          </Card>
        ) : (
          <Card>
            <p className="section-subtitle">No se encontró información de suscripción para tu negocio.</p>
          </Card>
        )}
      </section>

      {isSupervisor && (
        <section>
          <h3>Todos los negocios</h3>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Negocio</th>
                  <th>Estado</th>
                  <th>Vence</th>
                  <th>Cambiar a</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((s) => (
                  <tr key={s.businessId}>
                    <td>{s.businessName}</td>
                    <td>
                      <Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                    </td>
                    <td>{formatDate(s.status === 'trial' ? s.trialEndsAt : s.currentPeriodEndsAt)}</td>
                    <td>
                      <div className="subscriptions-page__actions">
                        {(['trial', 'activa', 'vencida', 'cancelada'] as SubscriptionStatus[])
                          .filter((status) => status !== s.status)
                          .map((status) => (
                            <Button
                              key={status}
                              variant="secondary"
                              disabled={savingId === s.businessId}
                              onClick={() => handleChange(s.businessId, status)}
                            >
                              {STATUS_LABEL[status]}
                            </Button>
                          ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
