import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useReports } from '@/hooks/useReports'
import { ReportViewer } from '@/components/reports/ReportViewer'
import { CustomReportModal } from '@/components/reports/CustomReportModal'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import type { ReportDefinition } from '@/types/domain'

export function ReportsPage() {
  const { reports, loading, error, reload, create, update, remove } = useReports()
  const [searchParams, setSearchParams] = useSearchParams()
  const [editing, setEditing] = useState<ReportDefinition | 'new'>()
  const [deleteError, setDeleteError] = useState<string>()

  if (loading) return <PageLoading label="Cargando reportes…" />
  if (error) return <PageError message={error} onRetry={reload} />

  const openId = searchParams.get('reporte')
  const open = openId ? reports.find((r) => r.id === openId) : undefined
  const predefined = reports.filter((r) => !r.custom)
  const custom = reports.filter((r) => r.custom)

  const openReport = (id?: string) => setSearchParams(id ? { reporte: id } : {})

  const handleDelete = async (report: ReportDefinition) => {
    if (!window.confirm(`¿Eliminar el reporte "${report.name}"? Esta acción no se puede deshacer.`)) return
    setDeleteError(undefined)
    try {
      await remove(report.id)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'No se pudo eliminar el reporte.')
    }
  }

  const modal = editing && (
    <CustomReportModal
      report={editing === 'new' ? undefined : editing}
      onSave={(input) => (editing === 'new' ? create(input) : update(editing.id, input))}
      onClose={() => setEditing(undefined)}
    />
  )

  if (open) {
    return (
      <div className="section-stack">
        <div className="page-toolbar report-page__header">
          <div>
            <Button variant="tertiary" onClick={() => openReport()}>
              ← Todos los reportes
            </Button>
            <h3>{open.name}</h3>
            {open.description && <p className="section-subtitle">{open.description}</p>}
          </div>
          {open.custom && (
            <Button variant="secondary" onClick={() => setEditing(open)}>
              Editar reporte
            </Button>
          )}
        </div>
        {/* key: al editar la configuración, el visor se reinicia con el nuevo período por defecto. */}
        <ReportViewer key={`${open.id}:${JSON.stringify(open.config)}`} report={open} />
        {modal}
      </div>
    )
  }

  return (
    <div className="section-stack">
      {openId && <div className="form-error-banner">El reporte que intentas abrir ya no existe.</div>}

      <section>
        <h3>Reportes predefinidos</h3>
        <p className="section-subtitle">Filtra por día, semana o mes y recorre períodos anteriores.</p>
        <div className="card-grid">
          {predefined.map((report) => (
            <Card key={report.id} title={report.name}>
              <p className="section-subtitle">{report.description}</p>
              <Button variant="secondary" onClick={() => openReport(report.id)}>
                Consultar
              </Button>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="page-toolbar">
          <div>
            <h3>Reportes personalizados</h3>
            <p className="section-subtitle">
              Elige qué datos consultar, cómo agruparlos, qué medir y con qué filtros, y guárdalo para volver a usarlo.
            </p>
          </div>
          <Button variant="primary" onClick={() => setEditing('new')}>
            Crear reporte personalizado
          </Button>
        </div>
        {deleteError && <div className="form-error-banner">{deleteError}</div>}
        {custom.length === 0 ? (
          <EmptyState title="Aún no hay reportes personalizados" description="Crea el primero con el botón de arriba." />
        ) : (
          <div className="card-grid">
            {custom.map((report) => (
              <Card key={report.id} title={report.name}>
                {report.description && <p className="section-subtitle">{report.description}</p>}
                <div className="report-page__actions">
                  <Button variant="secondary" onClick={() => openReport(report.id)}>
                    Consultar
                  </Button>
                  <Button variant="tertiary" onClick={() => setEditing(report)}>
                    Editar
                  </Button>
                  <Button variant="tertiary" onClick={() => handleDelete(report)}>
                    Eliminar
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {modal}
    </div>
  )
}
