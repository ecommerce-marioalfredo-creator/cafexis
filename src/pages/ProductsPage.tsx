import { useState } from 'react'
import { useProducts } from '@/hooks/useProducts'
import { RecipeCard } from '@/components/domain/RecipeCard'
import { ProductFormModal } from '@/components/domain/ProductFormModal'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import type { Product } from '@/types/domain'

export function ProductsPage() {
  const { products, loading, error, reload, create, update } = useProducts()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product>()

  if (loading) return <PageLoading label="Cargando productos…" />
  if (error) return <PageError message={error} onRetry={reload} />

  const openCreate = () => {
    setEditingProduct(undefined)
    setModalOpen(true)
  }

  const openEdit = (product: Product) => {
    setEditingProduct(product)
    setModalOpen(true)
  }

  const closeModal = () => setModalOpen(false)

  const handleSave = async (input: Omit<Product, 'id'>) => {
    if (editingProduct) {
      await update(editingProduct.id, input)
    } else {
      await create(input)
    }
  }

  return (
    <div>
      <div className="page-toolbar">
        <span className="section-subtitle">{products.length} productos registrados</span>
        <Button variant="primary" onClick={openCreate}>
          Nuevo producto
        </Button>
      </div>

      {products.length === 0 ? (
        <EmptyState title="Aún no has registrado productos" description="Crea tu primera bebida o café empacado." />
      ) : (
        <div className="card-grid">
          {products.map((product) => (
            <RecipeCard key={product.id} product={product} onEdit={openEdit} />
          ))}
        </div>
      )}

      {modalOpen && <ProductFormModal product={editingProduct} onSave={handleSave} onClose={closeModal} />}
    </div>
  )
}
