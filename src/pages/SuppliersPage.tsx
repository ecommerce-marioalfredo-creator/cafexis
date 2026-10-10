import { useState } from 'react'
import { useSuppliers } from '@/hooks/useSuppliers'
import { SupplierModal } from '@/components/domain/SupplierModal'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export function SuppliersPage() {
  const { suppliers, loading, error, reload, findByNit, add } = useSuppliers()
  const [modalOpen, setModalOpen] = useState(false)

  if (loading) return <PageLoading label="Cargando proveedores…" />
  if (error) return <PageError message={error} onRetry={reload} />

  return (
    <div>
      <div className="page-toolbar">
        <p className="section-subtitle">
          Proveedores compartidos entre negocios de la plataforma. Si un proveedor ya existe (por NIT), se reutiliza su
          información en lugar de registrarlo de nuevo.
        </p>
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          Agregar proveedor
        </Button>
      </div>

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

      {modalOpen && <SupplierModal onFindByNit={findByNit} onSave={add} onClose={() => setModalOpen(false)} />}
    </div>
  )
}
