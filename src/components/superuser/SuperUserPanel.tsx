import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAsync } from '@/hooks/useAsync'
import { usePlan } from '@/context/PlanContext'
import { MetricCard } from '@/components/ui/MetricCard'
import { PageError, PageLoading } from '@/components/ui/PageState'
import { listAdminPlans, listPlatformAccounts, listPromoCodes } from '@/services/api/superUserService'
import { AccountsView } from './AccountsView'
import { PromoCodesView } from './PromoCodesView'
import { PlansEditor } from './PlansEditor'
import { accountAlerts, isCurrent, money, monthlyRevenue, promoState } from './superUserFormat'
import type { AdminPlan, PlatformAccount, PromoCode } from '@/types/domain'
import './superuser.css'

type Section = 'negocios' | 'codigos' | 'planes'

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'negocios', label: 'Negocios y usuarios' },
  { id: 'codigos', label: 'Códigos de promoción' },
  { id: 'planes', label: 'Planes' },
]

interface PanelData {
  accounts: PlatformAccount[]
  plans: AdminPlan[]
  codes: PromoCode[]
}

const loadPanel = async (): Promise<PanelData> => {
  const [accounts, plans, codes] = await Promise.all([listPlatformAccounts(), listAdminPlans(), listPromoCodes()])
  return { accounts, plans, codes }
}

/**
 * Panel del super usuario (supervisor técnico), dentro del Dashboard: todos
 * los negocios con su suscripción y sus usuarios, los códigos de promoción y
 * los planes. Ver 0021_super_usuario_promociones_cafexis.sql.
 */
export function SuperUserPanel() {
  const [params, setParams] = useSearchParams()
  const section: Section = SECTIONS.some((s) => s.id === params.get('seccion')) ? (params.get('seccion') as Section) : 'negocios'
  const { data, loading, error, reload, refresh } = useAsync(loadPanel, [])
  const { refresh: refreshPlan } = usePlan()
  const [notice, setNotice] = useState<string>()

  // Tras cualquier cambio: se vuelve a consultar el panel y el plan del
  // negocio que se está operando (puede ser uno de los que se acaba de editar).
  const onChanged = useCallback(
    async (message: string) => {
      setNotice(message)
      await Promise.all([refresh(), refreshPlan()])
    },
    [refresh, refreshPlan],
  )

  const metrics = useMemo(() => {
    if (!data) return undefined
    const { accounts, plans, codes } = data
    const subs = accounts
      .map((a) => a.subscription)
      .filter((s): s is NonNullable<PlatformAccount['subscription']> => s !== undefined)
    const paying = subs.filter(
      (s) => s.status === 'activa' && s.effectivePlanCode !== 'basica' && isCurrent(s.status, s.trialEndsAt, s.currentPeriodEndsAt),
    )
    const users = accounts.flatMap((a) => a.users)
    return {
      businesses: accounts.length,
      trials: subs.filter((s) => s.status === 'trial' && isCurrent(s.status, s.trialEndsAt)).length,
      activeUsers: users.filter((u) => u.active).length,
      invitations: accounts.reduce((sum, a) => sum + a.invitations.length, 0),
      paying: paying.length,
      byPlan: plans
        .filter((p) => p.monthlyPrice > 0)
        .map((p) => `${p.name} ${paying.filter((s) => s.effectivePlanCode === p.code).length}`)
        .join(' · '),
      revenue: accounts.reduce((sum, a) => sum + monthlyRevenue(a, plans), 0),
      attention: accounts.filter((a) => accountAlerts(a).length > 0).length,
      pending: subs.filter((s) => s.pendingPlanId).length,
      codes: codes.filter((c) => promoState(c) === 'activo').length,
    }
  }, [data])

  if (loading && !data) return <PageLoading label="Cargando el panel del super usuario…" />
  if (error && !data) return <PageError message={error} onRetry={reload} />
  if (!data || !metrics) return null

  return (
    <div className="su-panel">
      <section className="dashboard-page__metrics" aria-label="Resumen de la plataforma">
        <MetricCard
          label="Negocios"
          value={String(metrics.businesses)}
          hint={`${metrics.trials} en prueba · ${metrics.paying} pagando`}
          icon="🏪"
        />
        <MetricCard
          label="Usuarios activos"
          value={String(metrics.activeUsers)}
          hint={
            metrics.invitations > 0
              ? `${metrics.invitations} ${metrics.invitations === 1 ? 'invitación pendiente' : 'invitaciones pendientes'}`
              : 'Sin invitaciones pendientes'
          }
          icon="👥"
        />
        <MetricCard label="Ingreso mensual estimado" value={money(metrics.revenue)} hint={metrics.byPlan || undefined} icon="💳" />
        <MetricCard
          label="Por atender"
          value={String(metrics.attention)}
          hint={
            metrics.pending > 0
              ? `${metrics.pending} ${metrics.pending === 1 ? 'solicitud de plan' : 'solicitudes de plan'}`
              : 'Sin solicitudes de plan'
          }
          tone={metrics.attention > 0 ? 'warning' : 'default'}
          icon="🔔"
        />
      </section>

      <div className="page-toolbar__filters" role="tablist" aria-label="Secciones del panel">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={section === s.id}
            className={['filter-chip', section === s.id ? 'filter-chip--active' : ''].join(' ')}
            onClick={() => {
              const next = new URLSearchParams(params)
              if (s.id === 'negocios') next.delete('seccion')
              else next.set('seccion', s.id)
              setParams(next, { replace: true })
              setNotice(undefined)
            }}
          >
            {s.label}
            {s.id === 'codigos' && ` (${metrics.codes})`}
          </button>
        ))}
      </div>

      {notice && (
        <div className="form-success-banner" role="status">
          {notice}
        </div>
      )}

      {section === 'negocios' && (
        <AccountsView accounts={data.accounts} plans={data.plans} codes={data.codes} onChanged={onChanged} />
      )}
      {section === 'codigos' && <PromoCodesView codes={data.codes} plans={data.plans} onChanged={onChanged} />}
      {section === 'planes' && <PlansEditor plans={data.plans} accounts={data.accounts} onChanged={onChanged} />}
    </div>
  )
}
