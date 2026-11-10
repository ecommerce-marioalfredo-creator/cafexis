import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ROLE_LABEL } from '@/components/layout/roles'
import { SubscriptionEditModal } from './SubscriptionEditModal'
import { ApplyPromoModal } from './ApplyPromoModal'
import {
  BILLING_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  accountAlerts,
  chargeFor,
  discountActive,
  formatDate,
  formatDateTime,
  money,
  monthlyRevenue,
  planName,
  subscriptionEndsAt,
} from './superUserFormat'
import type { AdminPlan, PlatformAccount, PromoCode } from '@/types/domain'

type AccountFilter = 'todos' | 'atender' | 'trial' | 'basica' | 'profesional' | 'premium' | 'cancelada'

const FILTERS: Array<{ id: AccountFilter; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'atender', label: 'Por atender' },
  { id: 'trial', label: 'En prueba' },
  { id: 'basica', label: 'Básica' },
  { id: 'profesional', label: 'Profesional' },
  { id: 'premium', label: 'Premium' },
  { id: 'cancelada', label: 'Canceladas' },
]

function matchesFilter(account: PlatformAccount, filter: AccountFilter): boolean {
  const sub = account.subscription
  switch (filter) {
    case 'todos':
      return true
    case 'atender':
      return accountAlerts(account).length > 0
    case 'trial':
      return sub?.status === 'trial'
    case 'cancelada':
      return sub?.status === 'cancelada'
    default:
      return sub?.effectivePlanCode === filter && sub.status !== 'cancelada'
  }
}

interface Props {
  accounts: PlatformAccount[]
  plans: AdminPlan[]
  codes: PromoCode[]
  onChanged: (message: string) => Promise<void>
}

/** Negocios con su suscripción completa y todos sus usuarios. */
export function AccountsView({ accounts, plans, codes, onChanged }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<AccountFilter>('todos')
  const [showUsers, setShowUsers] = useState(true)
  const [editing, setEditing] = useState<PlatformAccount>()
  const [applying, setApplying] = useState<PlatformAccount>()

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return accounts
      .filter((a) => matchesFilter(a, filter))
      .filter(
        (a) =>
          !q ||
          a.name.toLowerCase().includes(q) ||
          (a.slug ?? '').includes(q) ||
          a.users.some((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) ||
          a.invitations.some((i) => i.email.toLowerCase().includes(q)),
      )
  }, [accounts, query, filter])

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.id, accounts.filter((a) => matchesFilter(a, f.id)).length])),
    [accounts],
  ) as Record<AccountFilter, number>

  return (
    <section className="su-section" aria-label="Negocios y usuarios">
      <div className="su-toolbar">
        <input
          className="console-search"
          type="search"
          placeholder="Buscar negocio, usuario o correo…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar negocio, usuario o correo"
        />
        <label className="su-check">
          <input type="checkbox" checked={showUsers} onChange={(e) => setShowUsers(e.target.checked)} />
          Mostrar usuarios
        </label>
      </div>
      <div className="page-toolbar__filters su-filters" role="group" aria-label="Filtrar negocios">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            className={['filter-chip', filter === f.id ? 'filter-chip--active' : ''].join(' ')}
            onClick={() => setFilter(f.id)}
          >
            {f.label} ({counts[f.id]})
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Ningún negocio coincide" description="Prueba con otro filtro o búsqueda." />
      ) : (
        <div className="su-accounts">
          {rows.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              plans={plans}
              showUsers={showUsers}
              highlight={query.trim().toLowerCase()}
              onEdit={() => setEditing(account)}
              onApplyCode={() => setApplying(account)}
            />
          ))}
        </div>
      )}

      {editing && (
        <SubscriptionEditModal
          account={editing}
          plans={plans}
          onClose={() => setEditing(undefined)}
          onSaved={async (message) => {
            setEditing(undefined)
            await onChanged(message)
          }}
        />
      )}
      {applying && (
        <ApplyPromoModal
          account={applying}
          plans={plans}
          codes={codes}
          onClose={() => setApplying(undefined)}
          onApplied={async (message) => {
            setApplying(undefined)
            await onChanged(message)
          }}
        />
      )}
    </section>
  )
}

function AccountCard({
  account,
  plans,
  showUsers,
  highlight,
  onEdit,
  onApplyCode,
}: {
  account: PlatformAccount
  plans: AdminPlan[]
  showUsers: boolean
  highlight: string
  onEdit: () => void
  onApplyCode: () => void
}) {
  const sub = account.subscription
  const effective = plans.find((p) => p.code === sub?.effectivePlanCode)
  const lapsed = sub && sub.planCode !== sub.effectivePlanCode
  const ends = sub ? subscriptionEndsAt(sub) : undefined
  const pendingPlan = plans.find((p) => p.id === sub?.pendingPlanId)
  const hasDiscount = discountActive(sub)
  const revenue = monthlyRevenue(account, plans)
  const alerts = accountAlerts(account)
  const activeUsers = account.users.filter((u) => u.active).length

  const usage: Array<{ key: 'usuarios' | 'productos' | 'insumos'; label: string }> = [
    { key: 'usuarios', label: 'Equipo' },
    { key: 'productos', label: 'Productos' },
    { key: 'insumos', label: 'Insumos' },
  ]

  return (
    <article className="su-account" aria-labelledby={`su-account-${account.id}`}>
      <header className="su-account__head">
        <div className="su-account__title">
          <span className="su-account__swatch" style={{ background: account.primaryColor }} aria-hidden="true" />
          <div>
            <h3 id={`su-account-${account.id}`}>{account.name}</h3>
            <p className="su-muted">
              Cliente desde {formatDate(account.createdAt)}
              {account.slug && (
                <>
                  {' · '}
                  <a href={`/c/${account.slug}`} target="_blank" rel="noreferrer">
                    /c/{account.slug}
                  </a>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="su-account__actions">
          <Button variant="primary" onClick={onEdit} disabled={!sub}>
            Editar suscripción
          </Button>
          <Button variant="secondary" onClick={onApplyCode} disabled={!sub}>
            Aplicar código
          </Button>
          <Link className="btn btn--tertiary" to={`/soporte/negocios/${account.id}`}>
            Ver en consola
          </Link>
        </div>
      </header>

      {sub ? (
        <dl className="su-account__sub">
          <div>
            <dt>Plan</dt>
            <dd>
              <strong>{effective?.name ?? planName(plans, sub.effectivePlanCode)}</strong>
              {lapsed && <span className="su-muted"> · contratado {sub.planName}, vencido</span>}
            </dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>
              <Badge tone={STATUS_TONE[sub.status]}>{STATUS_LABEL[sub.status]}</Badge>
            </dd>
          </div>
          <div>
            <dt>{sub.status === 'trial' ? 'Prueba hasta' : 'Pago hasta'}</dt>
            <dd>{ends ? formatDate(ends) : sub.status === 'cancelada' ? '—' : 'Sin vencimiento'}</dd>
          </div>
          <div>
            <dt>Forma de pago</dt>
            <dd>
              {BILLING_LABEL[sub.billingPeriod]}
              {revenue > 0 && <span className="su-muted"> · {money(revenue)}/mes</span>}
            </dd>
          </div>
          <div>
            <dt>Descuento</dt>
            <dd>
              {hasDiscount ? (
                <>
                  {sub.discountPercent} %{sub.discountEndsAt ? ` hasta ${formatDate(sub.discountEndsAt)}` : ''}
                  {sub.discountCode && <span className="su-muted"> · {sub.discountCode}</span>}
                </>
              ) : (
                <span className="su-muted">Ninguno</span>
              )}
            </dd>
          </div>
          <div>
            <dt>Factura DIAN</dt>
            <dd>
              {sub.effectivePlanCode === 'premium'
                ? 'Incluida'
                : sub.addons.includes('factura_dian')
                  ? 'Complemento'
                  : <span className="su-muted">No</span>}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="su-edit__preview su-edit__preview--warning">
          Este negocio no tiene una fila de suscripción. Se crea sola al registrar un negocio nuevo; para uno antiguo, ejecuta
          de nuevo el respaldo de la 0012.
        </p>
      )}

      {(alerts.length > 0 || pendingPlan) && (
        <div className="su-account__alerts">
          {alerts.map((a) => (
            <Badge key={a.label} tone={a.tone}>
              {a.label}
            </Badge>
          ))}
          {pendingPlan && sub && (
            <span className="su-muted">
              Pide {pendingPlan.name} {BILLING_LABEL[sub.pendingBillingPeriod ?? 'mensual'].toLowerCase()} el{' '}
              {formatDate(sub.pendingRequestedAt)}: cobra{' '}
              {money(chargeFor(pendingPlan, sub.pendingBillingPeriod ?? 'mensual', hasDiscount ? sub.discountPercent : undefined))}.
              Apruébalo en “Editar suscripción”.
            </span>
          )}
        </div>
      )}

      <ul className="su-account__usage" aria-label="Uso del plan">
        {usage.map(({ key, label }) => {
          const max = effective?.limits[key]
          const used = account.usage[key]
          return (
            <li key={key} className={max !== undefined && used >= max ? 'su-account__usage--full' : ''}>
              {label}: <strong>{used}</strong>
              {max !== undefined ? ` de ${max}` : ''}
            </li>
          )
        })}
        <li>
          Clientes registrados: <strong>{account.usage.clientes}</strong>
        </li>
      </ul>

      {showUsers && (
        <div className="data-table-wrapper">
          <table className="data-table su-users">
            <caption className="visually-hidden">Usuarios de {account.name}</caption>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Último ingreso</th>
              </tr>
            </thead>
            <tbody>
              {account.users.length === 0 && account.invitations.length === 0 && (
                <tr>
                  <td colSpan={4} className="su-muted">
                    Sin usuarios.
                  </td>
                </tr>
              )}
              {account.users.map((u) => {
                const match = highlight && (u.name.toLowerCase().includes(highlight) || u.email.toLowerCase().includes(highlight))
                return (
                  <tr key={u.id} className={match ? 'su-users__match' : undefined}>
                    <td>
                      <span className="su-users__name">{u.name}</span>
                      <span className="su-muted su-users__email">{u.email}</span>
                    </td>
                    <td>{ROLE_LABEL[u.role]}</td>
                    <td>
                      <Badge tone={u.active ? 'success' : 'neutral'}>{u.active ? 'Activo' : 'Inactivo'}</Badge>
                    </td>
                    <td>{formatDateTime(u.lastSignInAt)}</td>
                  </tr>
                )
              })}
              {account.invitations.map((i) => (
                <tr key={i.id}>
                  <td>
                    <span className="su-users__name">{i.name}</span>
                    <span className="su-muted su-users__email">{i.email}</span>
                  </td>
                  <td>{ROLE_LABEL[i.role]}</td>
                  <td>
                    <Badge tone="info">Invitación pendiente</Badge>
                  </td>
                  <td className="su-muted">Invitado el {formatDate(i.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="su-muted su-users__summary">
            {activeUsers} activo{activeUsers === 1 ? '' : 's'} de {account.users.length}
            {account.invitations.length > 0
              ? ` · ${account.invitations.length} ${account.invitations.length === 1 ? 'invitación pendiente' : 'invitaciones pendientes'}`
              : ''}
          </p>
        </div>
      )}

      {account.redemptions.length > 0 && (
        <p className="su-muted su-account__codes">
          Códigos usados:{' '}
          {account.redemptions.map((r, i) => (
            <span key={`${r.code}-${r.createdAt}`}>
              {i > 0 && ' · '}
              <strong className="su-code">{r.code}</strong> ({r.summary}, {formatDate(r.createdAt)}
              {r.byPlatform ? ', aplicado por Cafexis' : ''})
            </span>
          ))}
        </p>
      )}
    </article>
  )
}
