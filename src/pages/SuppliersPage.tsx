import { useSuppliers } from '@/hooks/useSuppliers'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Card } from '@/components/ui/Card'

export function SuppliersPage() {
  const { suppliers, loading, error, reload } = useSuppliers()

  if (loading) return <PageLoading label="Cargando proveedores…" />
  if (error) return <PageError message={error} onRetry={reload} />

  return (
    <div>
      <p className="section-subtitle">
        Proveedores compartidos entre negocios de la plataforma. Si un proveedor ya existe (por NIT), se reutiliza su
        información en lugar de registrarlo de nuevo.
      </p>

      {suppliers.length === 0 ? (
        <EmptyState title="Aún no tienes proveedores registrados" />
      ) : (
        <div className="card-grid">
          {suppliers.map((supplier) => (
            <Card key={supplier.id} title={supplier.name}>
              <p className="section-subtitle">NIT {supplier.nit}</p>
              <p>{supplier.location}</p>
              {supplier.branches && supplier.branches.length > 0 && (
                <p className="section-subtitle">Sucursales: {supplier.branches.join(', ')}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
