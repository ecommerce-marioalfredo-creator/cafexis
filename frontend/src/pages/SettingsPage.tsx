import { useUsers, useBusiness } from '@/hooks/useBusiness'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { UserRole } from '@/types/domain'

const ROLE_LABEL: Record<UserRole, string> = {
  supervisor_tecnico: 'Supervisor técnico',
  administrador: 'Administrador / dueño',
  barista: 'Barista / vendedor',
  cliente: 'Cliente final',
}

export function SettingsPage() {
  const { users, loading, error, reload } = useUsers()
  const { business, loading: loadingBusiness } = useBusiness()

  if (loading || loadingBusiness) return <PageLoading label="Cargando configuración…" />
  if (error) return <PageError message={error} onRetry={reload} />

  return (
    <div className="section-stack">
      <section>
        <h3>Datos del negocio</h3>
        <Card>
          <p>
            <strong>{business?.name}</strong>
          </p>
          <p className="section-subtitle">
            {business?.type === 'mixto' ? 'Cafetería y venta de café en grano/molido' : business?.type} ·{' '}
            {business?.country}
          </p>
        </Card>
      </section>

      <section>
        <div className="page-toolbar">
          <h3>Usuarios internos</h3>
          <Button variant="primary">Invitar usuario</Button>
        </div>
        <div className="card-grid">
          {users.map((user) => (
            <Card key={user.id} title={user.name}>
              <p className="section-subtitle">{user.email}</p>
              <Badge tone={user.active ? 'success' : 'neutral'}>{ROLE_LABEL[user.role]}</Badge>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
