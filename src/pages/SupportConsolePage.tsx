import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { usePlatformOverview, useSupportCases } from '@/hooks/useSupport'
import { CaseList } from '@/components/support/CaseList'
import { NewCaseModal } from '@/components/support/NewCaseModal'
import { ACTIVE_STATUSES, DONE_STATUSES, formatRelative } from '@/components/support/supportLabels'
import { currency } from '@/components/domain/paymentMethods'
import { MetricCard } from '@/components/ui/MetricCard'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageLoading, PageError } from '@/components/ui/PageState'
import type { PlatformBusinessOverview, SupportCaseStatus } from '@/types/domain'
import '@/components/support/support.css'

const DAY_MS = 86_400_000

/** Señales de atención de un negocio: color + texto, nunca solo color. */
export function businessHealth(b: PlatformBusinessOverview): Array<{ label: string; tone: BadgeTone }> {
  const issues: Array<{ label: string; tone: BadgeTone }> = []
  const ageDays = (Date.now() - new Date(b.createdAt).getTime()) / DAY_MS
  if (b.urgentCases > 0) issues.push({ label: `${b.urgentCases} caso${b.urgentCases === 1 ? '' : 's'} urgente${b.urgentCases === 1 ? '' : 's'}`, tone: 'error' })
  if (b.outOfStock > 0) issues.push({ label: `${b.outOfStock} insumo${b.outOfStock === 1 ? '' : 's'} agotado${b.outOfStock === 1 ? '' : 's'}`, tone: 'warning' })
  if (ageDays > 7 && (!b.lastOrderAt || Date.now() - new Date(b.lastOrderAt).getTime() > 7 * DAY_MS)) {
    issues.push({ label: 'Sin ventas en 7 días', tone: 'warning' })
  }
  if (ageDays > 14 && (!b.lastSignInAt || Date.now() - new Date(b.lastSignInAt).getTime() > 14 * DAY_MS)) {
    issues.push({ label: 'Nadie entra hace 14 días', tone: 'neutral' })
  }
  if (b.activeUsers === 0) issues.push({ label: 'Sin usuarios activos', tone: 'error' })
  return issues.length > 0 ? issues : [{ label: 'Al día', tone: 'success' }]
}

type CaseFilter = 'activos' | 'sin_asignar' | 'mios' | 'resueltos' | 'todos'
const CASE_FILTERS: Array<{ id: CaseFilter; label: string }> = [
  { id: 'activos', label: 'Activos' },
  { id: 'sin_asignar', label: 'Sin asignar' },
  { id: 'mios', label: 'Asignados a mí' },
  { id: 'resueltos', label: 'Resueltos y cerrados' },
  { id: 'todos', label: 'Todos' },
]

/**
 * Consola del supervisor técnico y del equipo de soporte (Fase 7): salud de
 * todos los negocios y bandeja de casos. Solo lectura sobre los negocios;
 * el supervisor puede además "operar" uno desde su detalle.
 */
export function SupportConsolePage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('vista') === 'casos' ? 'casos' : 'negocios'
  const { businesses, loading, error, reload } = usePlatformOverview()

  if (loading) return <PageLoading label="Cargando consola…" />
  if (error) return <PageError message={error} onRetry={reload} />

  const openCases = businesses.reduce((s, b) => s + b.openCases, 0)
  const urgent = businesses.reduce((s, b) => s + b.urgentCases, 0)
  const needAttention = businesses.filter((b) => businessHealth(b)[0].tone !== 'success').length

  return (
    <div className="section-stack">
      <div className="dashboard-page__metrics">
        <MetricCard label="Negocios" value={String(businesses.length)} hint={`${needAttention} requieren atención`} />
        <MetricCard label="Casos abiertos" value={String(openCases)} hint={urgent > 0 ? `${urgent} urgentes` : 'Ninguno urgente'} tone={urgent > 0 ? 'warning' : 'default'} />
        <MetricCard label="Ventas de hoy (plataforma)" value={currency.format(businesses.reduce((s, b) => s + b.salesToday, 0))} />
        <MetricCard label="Pedidos últimos 7 días" value={String(businesses.reduce((s, b) => s + b.orders7d, 0))} />
      </div>

      <div className="page-toolbar__filters" role="tablist" aria-label="Vista de la consola">
        {(['negocios', 'casos'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={['filter-chip', tab === t ? 'filter-chip--active' : ''].join(' ')}
            onClick={() => setParams(t === 'casos' ? { vista: 'casos' } : {})}
          >
            {t === 'negocios' ? 'Negocios' : `Casos (${openCases})`}
          </button>
        ))}
      </div>

      {tab === 'negocios' ? <BusinessesTable businesses={businesses} /> : <CasesInbox businesses={businesses} />}
    </div>
  )
}

function BusinessesTable({ businesses }: { businesses: PlatformBusinessOverview[] }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [onlyAttention, setOnlyAttention] = useState(false)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return businesses
      .filter((b) => !q || b.name.toLowerCase().includes(q) || (b.slug ?? '').includes(q))
      .filter((b) => !onlyAttention || businessHealth(b)[0].tone !== 'success')
      // Primero los que tienen casos urgentes, luego casos abiertos, luego por nombre.
      .sort((a, b) => b.urgentCases - a.urgentCases || b.openCases - a.openCases || a.name.localeCompare(b.name))
  }, [businesses, query, onlyAttention])

  return (
    <section>
      <div className="page-toolbar">
        <input
          className="console-search"
          type="search"
          placeholder="Buscar negocio…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar negocio"
        />
        <label className="replenishment__toggle case-thread__internal">
          <input type="checkbox" checked={onlyAttention} onChange={(e) => setOnlyAttention(e.target.checked)} />
          Solo los que requieren atención
        </label>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Ningún negocio coincide" />
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table console-table">
            <thead>
              <tr>
                <th>Negocio</th>
                <th>Estado</th>
                <th className="console-table__num">Usuarios</th>
                <th className="console-table__num">Ventas hoy</th>
                <th className="console-table__num">Ventas 7 días</th>
                <th className="console-table__num">Casos abiertos</th>
                <th>Última venta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} onClick={() => navigate(`/soporte/negocios/${b.id}`)}>
                  <td>
                    <span className="console-table__business">
                      <span className="console-table__swatch" style={{ background: b.primaryColor }} aria-hidden="true" />
                      <Link to={`/soporte/negocios/${b.id}`} onClick={(e) => e.stopPropagation()}>
                        {b.name}
                      </Link>
                    </span>
                  </td>
                  <td>
                    <span className="console-health">
                      {businessHealth(b).map((h) => (
                        <Badge key={h.label} tone={h.tone}>
                          {h.label}
                        </Badge>
                      ))}
                    </span>
                  </td>
                  <td className="console-table__num">{b.activeUsers}</td>
                  <td className="console-table__num">{currency.format(b.salesToday)}</td>
                  <td className="console-table__num">{currency.format(b.sales7d)}</td>
                  <td className="console-table__num">{b.openCases}</td>
                  <td>{b.lastOrderAt ? formatRelative(b.lastOrderAt) : 'Nunca'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function CasesInbox({ businesses }: { businesses: PlatformBusinessOverview[] }) {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<CaseFilter>('activos')
  const [modalOpen, setModalOpen] = useState(false)
  const statuses: SupportCaseStatus[] | undefined =
    filter === 'resueltos' ? DONE_STATUSES : filter === 'todos' ? undefined : ACTIVE_STATUSES
  const { cases, loading, error, reload, open } = useSupportCases({ statuses, assignedToMe: filter === 'mios' })
  const shown = filter === 'sin_asignar' ? cases.filter((c) => !c.assignedTo) : cases

  return (
    <section>
      <div className="page-toolbar">
        <div className="page-toolbar__filters">
          {CASE_FILTERS.map((f) => (
            <button
              key={f.id}
              className={['filter-chip', filter === f.id ? 'filter-chip--active' : ''].join(' ')}
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button variant="secondary" onClick={() => setModalOpen(true)}>
          Abrir caso para un negocio
        </Button>
      </div>

      {loading && cases.length === 0 ? (
        <PageLoading label="Cargando casos…" />
      ) : error ? (
        <PageError message={error} onRetry={reload} />
      ) : shown.length === 0 ? (
        <EmptyState title="No hay casos en esta bandeja" />
      ) : (
        <CaseList cases={shown} basePath="/soporte/casos" showBusiness showAssignee />
      )}

      {modalOpen && (
        <NewCaseModal
          businesses={businesses.map((b) => ({ id: b.id, name: b.name }))}
          onSave={open}
          onCreated={(id) => navigate(`/soporte/casos/${id}`)}
          onClose={() => setModalOpen(false)}
        />
      )}
    </section>
  )
}
