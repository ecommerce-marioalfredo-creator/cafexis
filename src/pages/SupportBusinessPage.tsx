import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { usePlatformBusinessDetail, useSupportCases } from '@/hooks/useSupport'
import { CaseList } from '@/components/support/CaseList'
import { CaseThread } from '@/components/support/CaseThread'
import { NewCaseModal } from '@/components/support/NewCaseModal'
import { formatDateTime, formatRelative } from '@/components/support/supportLabels'
import { ROLE_LABEL } from '@/components/layout/roles'
import { ColumnChart } from '@/components/reports/ColumnChart'
import { PAYMENT_LABEL, currency } from '@/components/domain/paymentMethods'
import { ORDER_STATUS_META } from '@/components/domain/orderStatus'
import { formatBucket } from '@/services/api/reportPeriods'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageLoading, PageError } from '@/components/ui/PageState'
import '@/components/support/support.css'

const compactCurrency = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: 'compact', maximumFractionDigits: 1 })

/** /soporte/casos/:caseId — un caso visto por el equipo de plataforma. */
export function SupportCasePage() {
  const { caseId } = useParams()
  return <CaseThread caseId={caseId!} staff backTo="/soporte?vista=casos" backLabel="Bandeja de casos" />
}

/**
 * /soporte/negocios/:businessId — diagnóstico de un negocio en solo
 * lectura (usuarios, alertas, ventas recientes, compras y casos). El
 * supervisor técnico puede además entrar a operarlo con el selector de
 * negocio ya existente (Fase 3); soporte no.
 */
export function SupportBusinessPage() {
  const { businessId } = useParams()
  const navigate = useNavigate()
  const { user, switchBusiness } = useAuth()
  const { detail, loading, error, reload } = usePlatformBusinessDetail(businessId!)
  const { cases, open } = useSupportCases({ businessId })
  const [modalOpen, setModalOpen] = useState(false)
  const [switching, setSwitching] = useState(false)

  if (loading) return <PageLoading label="Cargando negocio…" />
  if (error) return <PageError message={error} onRetry={reload} />
  if (!detail) return null

  const { business } = detail
  const isSupervisor = user?.role === 'supervisor_tecnico'

  const operate = async () => {
    setSwitching(true)
    try {
      await switchBusiness(business.id)
      navigate('/')
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div className="section-stack">
      <div>
        <Link to="/soporte" className="case-thread__back">
          ← Todos los negocios
        </Link>
        <div className="case-thread__header">
          <div>
            <h3 className="case-thread__subject">{business.name}</h3>
            <p className="section-subtitle">
              {business.country} · cliente desde {formatDateTime(business.createdAt)}
              {business.slug && (
                <>
                  {' · '}
                  <a href={`/c/${business.slug}`} target="_blank" rel="noreferrer">
                    catálogo público
                  </a>
                </>
              )}
            </p>
          </div>
          <div className="report-page__actions">
            <Button variant="secondary" onClick={() => setModalOpen(true)}>
              Abrir caso para este negocio
            </Button>
            {isSupervisor && (
              <Button variant="primary" onClick={operate} disabled={switching}>
                {switching ? 'Entrando…' : 'Operar este negocio'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <Card title="Ventas últimos 14 días">
        <ColumnChart
          points={detail.sales14d.map((d) => ({
            key: d.day,
            label: `${formatBucket(d.day, 'dia')} · ${d.orders} pedido${d.orders === 1 ? '' : 's'}`,
            shortLabel: formatBucket(d.day, 'dia', true),
            value: d.revenue,
          }))}
          formatValue={(v) => currency.format(v)}
          formatTick={(v) => compactCurrency.format(v)}
          ariaLabel={`Ventas de ${business.name} en los últimos 14 días`}
        />
      </Card>

      <section>
        <h3>Casos de este negocio</h3>
        {cases.length === 0 ? <EmptyState title="Sin casos" /> : <CaseList cases={cases} basePath="/soporte/casos" showAssignee />}
      </section>

      <div className="console-detail__grid">
        <Card title={`Usuarios (${detail.users.length})`}>
          {detail.pendingInvitations > 0 && (
            <p className="section-subtitle">{detail.pendingInvitations} invitación(es) pendiente(s) de aceptar.</p>
          )}
          <ul className="console-detail__list">
            {detail.users.map((u) => (
              <li key={u.id}>
                <span>
                  <strong>{u.name}</strong>
                  <br />
                  <span className="console-detail__muted">
                    {u.email} · {u.lastSignInAt ? `entró ${formatRelative(u.lastSignInAt)}` : 'nunca ha entrado'}
                  </span>
                </span>
                <Badge tone={u.active ? 'info' : 'neutral'}>{u.active ? ROLE_LABEL[u.role] : 'Inactivo'}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Alertas de inventario">
          {detail.inventoryAlerts.length === 0 ? (
            <p className="section-subtitle">Todo el inventario está en niveles saludables.</p>
          ) : (
            <ul className="console-detail__list">
              {detail.inventoryAlerts.map((i) => (
                <li key={i.name}>
                  <span>
                    {i.name}
                    <br />
                    <span className="console-detail__muted">
                      Quedan {i.quantity} {i.unit} · umbral {i.threshold} {i.unit}
                    </span>
                  </span>
                  <Badge tone={i.status === 'agotado' ? 'error' : 'warning'}>{i.status === 'agotado' ? 'Agotado' : 'Bajo'}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Últimos pedidos">
          {detail.recentOrders.length === 0 ? (
            <p className="section-subtitle">Este negocio aún no tiene pedidos.</p>
          ) : (
            <ul className="console-detail__list">
              {detail.recentOrders.map((o) => (
                <li key={o.code}>
                  <span>
                    <strong>{o.code}</strong> · {o.items} producto{o.items === 1 ? '' : 's'}
                    <br />
                    <span className="console-detail__muted">
                      {formatDateTime(o.createdAt)} · {PAYMENT_LABEL[o.paymentMethod] ?? o.paymentMethod} ·{' '}
                      {ORDER_STATUS_META[o.status]?.label ?? o.status}
                    </span>
                  </span>
                  <strong>{currency.format(o.total)}</strong>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Compras abiertas">
          {detail.openPurchaseOrders.length === 0 ? (
            <p className="section-subtitle">Sin órdenes de compra abiertas.</p>
          ) : (
            <ul className="console-detail__list">
              {detail.openPurchaseOrders.map((p) => (
                <li key={p.code}>
                  <span>
                    <strong>{p.code}</strong>
                    <br />
                    <span className="console-detail__muted">
                      {p.origin === 'sugerida_sistema' ? 'Propuesta del sistema' : 'Manual'} · {formatRelative(p.createdAt)}
                    </span>
                  </span>
                  <Badge tone={p.status === 'propuesta' ? 'warning' : 'info'}>{p.status === 'propuesta' ? 'Por revisar' : 'Por recibir'}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {modalOpen && (
        <NewCaseModal
          businesses={[{ id: business.id, name: business.name }]}
          defaultBusinessId={business.id}
          onSave={open}
          onCreated={(id) => navigate(`/soporte/casos/${id}`)}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}
