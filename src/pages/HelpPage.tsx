import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSupportCases } from '@/hooks/useSupport'
import { CaseList } from '@/components/support/CaseList'
import { CaseThread } from '@/components/support/CaseThread'
import { NewCaseModal } from '@/components/support/NewCaseModal'
import { ACTIVE_STATUSES, DONE_STATUSES } from '@/components/support/supportLabels'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'

/**
 * "Ayuda y soporte" del negocio (administrador y barista): sus casos con
 * el equipo de Cafexis. /ayuda lista; /ayuda/:caseId abre la conversación.
 */
export function HelpPage() {
  const { caseId } = useParams()
  if (caseId) return <CaseThread caseId={caseId} staff={false} backTo="/ayuda" backLabel="Mis casos" />
  return <HelpCaseList />
}

function HelpCaseList() {
  const navigate = useNavigate()
  const { cases, loading, error, reload, open } = useSupportCases()
  const [modalOpen, setModalOpen] = useState(false)

  if (loading) return <PageLoading label="Cargando casos…" />
  if (error) return <PageError message={error} onRetry={reload} />

  const active = cases.filter((c) => ACTIVE_STATUSES.includes(c.status))
  const resolved = cases.filter((c) => c.status === 'resuelto')
  const closed = cases.filter((c) => DONE_STATUSES.includes(c.status) && c.status !== 'resuelto')

  return (
    <div className="section-stack">
      <div className="page-toolbar">
        <p className="section-subtitle">
          ¿Algo no funciona o no cuadra? Abre un caso y el equipo de soporte de Cafexis te responde aquí mismo.
        </p>
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          Abrir un caso
        </Button>
      </div>

      {resolved.length > 0 && (
        <section>
          <h3>Por confirmar</h3>
          <p className="section-subtitle">Soporte los marcó como resueltos: confírmalos o reábrelos.</p>
          <CaseList cases={resolved} basePath="/ayuda" />
        </section>
      )}

      <section>
        <h3>En curso</h3>
        {active.length === 0 ? (
          <EmptyState title="No tienes casos abiertos" />
        ) : (
          <CaseList cases={active} basePath="/ayuda" showAssignee />
        )}
      </section>

      {closed.length > 0 && (
        <section>
          <h3>Cerrados</h3>
          <CaseList cases={closed} basePath="/ayuda" />
        </section>
      )}

      {modalOpen && (
        <NewCaseModal
          onSave={open}
          onCreated={(id) => navigate(`/ayuda/${id}`)}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}
