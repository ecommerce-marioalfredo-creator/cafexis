import { useReports } from '@/hooks/useReports'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export function ReportsPage() {
  const { reports, loading, error, reload } = useReports()

  if (loading) return <PageLoading label="Cargando reportes…" />
  if (error) return <PageError message={error} onRetry={reload} />

  return (
    <div className="section-stack">
      <section>
        <h3>Reportes predefinidos</h3>
        <div className="card-grid card-grid--spaced">
          {reports.map((report) => (
            <Card key={report.id} title={report.name}>
              <p className="section-subtitle">{report.description}</p>
              <Button variant="secondary">Consultar</Button>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h3>Generador de reportes personalizados</h3>
        <Card>
          <p className="section-subtitle">
            Selecciona la información específica que quieras consultar: producto, período, tipo de dato y forma de
            visualización.
          </p>
          <Button variant="primary">Crear reporte personalizado</Button>
        </Card>
      </section>
    </div>
  )
}
