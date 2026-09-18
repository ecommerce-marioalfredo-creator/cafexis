import { useState } from 'react'
import { useUsers, useBusiness, useInvitations } from '@/hooks/useBusiness'
import { useAuth } from '@/context/AuthContext'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { InviteUserModal } from '@/components/domain/InviteUserModal'
import type { AppUser, InvitableRole, UserRole } from '@/types/domain'

const ROLE_LABEL: Record<UserRole, string> = {
  supervisor_tecnico: 'Supervisor técnico',
  administrador: 'Administrador / dueño',
  barista: 'Barista / vendedor',
  cliente: 'Cliente final',
}

const ASSIGNABLE_ROLES: InvitableRole[] = ['administrador', 'barista']

export function SettingsPage() {
  const { users, loading, error, reload, invite, updateRole, setActive } = useUsers()
  const { business, loading: loadingBusiness } = useBusiness()
  const { invitations, loading: loadingInvitations, reload: reloadInvitations } = useInvitations()
  const { user: sessionUser } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)

  if (loading || loadingBusiness) return <PageLoading label="Cargando configuración…" />
  if (error) return <PageError message={error} onRetry={reload} />

  // El supervisor técnico gestiona cualquier negocio; el administrador solo
  // el suyo (ya filtrado por RLS). La UI oculta los controles para todos los
  // demás roles como defensa en profundidad — RLS ya lo bloquea en el
  // servidor si alguien intenta forzarlo.
  const canManageUsers = sessionUser?.role === 'administrador' || sessionUser?.role === 'supervisor_tecnico'

  const handleInvite = async (input: { email: string; name: string; role: InvitableRole }) => {
    await invite(input)
    reloadInvitations()
  }

  const handleRoleChange = (user: AppUser, role: UserRole) => {
    if (user.id === sessionUser?.id) return // no te puedes cambiar tu propio rol (reforzado también por trigger)
    updateRole(user.id, role)
  }

  return (
    <div className="section-stack">
      <section>
        <h3>Datos del negocio</h3>
        <Card>
          <div className="settings-page__business">
            {business?.branding.logoUrl ? (
              <img src={business.branding.logoUrl} alt={business.name} className="settings-page__logo" />
            ) : (
              <span
                className="settings-page__logo-fallback"
                style={{ background: business?.branding.primaryColor }}
                aria-hidden="true"
              >
                {business?.name.charAt(0).toUpperCase()}
              </span>
            )}
            <div>
              <p>
                <strong>{business?.name}</strong>
              </p>
              <p className="section-subtitle">
                {business?.type === 'mixto' ? 'Cafetería y venta de café en grano/molido' : business?.type} ·{' '}
                {business?.country}
              </p>
            </div>
          </div>
          <p className="settings-page__brand-color">
            Color de marca: <span className="settings-page__color-dot" style={{ background: business?.branding.primaryColor }} />
            {business?.branding.primaryColor}
          </p>
        </Card>
      </section>

      <section>
        <div className="page-toolbar">
          <h3>Usuarios internos</h3>
          {canManageUsers && (
            <Button variant="primary" onClick={() => setModalOpen(true)}>
              Invitar usuario
            </Button>
          )}
        </div>
        <div className="card-grid">
          {users.map((user) => {
            const isSelf = user.id === sessionUser?.id
            return (
              <Card key={user.id} title={user.name}>
                <p className="section-subtitle">{user.email}</p>

                {canManageUsers && !isSelf && user.role !== 'supervisor_tecnico' ? (
                  <select
                    className="settings-page__role-select"
                    value={user.role}
                    onChange={(e) => handleRoleChange(user, e.target.value as UserRole)}
                    aria-label={`Rol de ${user.name}`}
                  >
                    {ASSIGNABLE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABEL[role]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge tone={user.active ? 'success' : 'neutral'}>{ROLE_LABEL[user.role]}</Badge>
                )}

                {canManageUsers && !isSelf && user.role !== 'supervisor_tecnico' && (
                  <button
                    className="settings-page__toggle-active"
                    onClick={() => setActive(user.id, !user.active)}
                  >
                    {user.active ? 'Desactivar' : 'Activar'}
                  </button>
                )}

                {isSelf && <span className="settings-page__you-tag">Tú</span>}
              </Card>
            )
          })}
        </div>
      </section>

      {canManageUsers && (
        <section>
          <h3>Invitaciones pendientes</h3>
          {loadingInvitations ? (
            <PageLoading label="Cargando invitaciones…" />
          ) : invitations.length === 0 ? (
            <EmptyState title="No hay invitaciones pendientes" />
          ) : (
            <div className="card-grid">
              {invitations.map((inv) => (
                <Card key={inv.id} title={inv.name}>
                  <p className="section-subtitle">{inv.email}</p>
                  <Badge tone="warning">Pendiente de aceptar · {ROLE_LABEL[inv.role]}</Badge>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {modalOpen && <InviteUserModal onInvite={handleInvite} onClose={() => setModalOpen(false)} />}
    </div>
  )
}
