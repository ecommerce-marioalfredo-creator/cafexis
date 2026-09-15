import { useProducts } from '@/hooks/useProducts'
import { RecipeCard } from '@/components/domain/RecipeCard'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'

export function ProductsPage() {
  const { products, loading, error, reload } = useProducts()

  if (loading) return <PageLoading label="Cargando productos…" />
  if (error) return <PageError message={error} onRetry={reload} />

  return (
    <div>
      <div className="page-toolbar">
        <span className="section-subtitle">{products.length} productos registrados</span>
        <Button variant="primary">Nuevo producto</Button>
      </div>

      {products.length === 0 ? (
        <EmptyState title="Aún no has registrado productos" description="Crea tu primera bebida o café empacado." />
      ) : (
        <div className="card-grid">
          {products.map((product) => (
            <RecipeCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}
