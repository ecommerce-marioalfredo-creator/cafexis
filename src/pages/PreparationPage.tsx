import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useProducts } from '@/hooks/useProducts'
import { useProductGuides } from '@/hooks/useProductGuides'
import { useAuth } from '@/context/AuthContext'
import { ADMIN_ROLES } from '@/components/layout/roles'
import { GuideViewerModal } from '@/components/domain/GuideViewerModal'
import { ProductGuideFormModal } from '@/components/domain/ProductGuideFormModal'
import { GUIDE_KIND_ICON, GUIDE_KIND_LABEL } from '@/components/domain/guideMedia'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { Product, ProductGuide, ProductGuideInput } from '@/types/domain'
import './PreparationPage.css'

type FormState = { guide?: ProductGuide; productId?: string }

/**
 * Guías de preparación (/preparacion): el recetario del negocio. Por cada
 * producto muestra su receta y los videos o PDF que explican cómo prepararlo.
 *
 *  - Barista: solo consulta (es su "apartado" de capacitación y de consulta
 *    rápida; desde cada comanda en Ventas llega aquí con ?producto=<id>).
 *  - Administrador / supervisor técnico: además sube, edita y borra el
 *    material, y decide si queda disponible para el cliente en el catálogo.
 */
export function PreparationPage() {
  const { user } = useAuth()
  const canManage = Boolean(user && ADMIN_ROLES.includes(user.role))
  const { products, loading: loadingProducts, error: productsError, reload: reloadProducts } = useProducts()
  const { guidesByProductId, loading: loadingGuides, error: guidesError, reload: reloadGuides, create, update, setVisibility, remove } =
    useProductGuides()

  const [searchParams, setSearchParams] = useSearchParams()
  const focusedProductId = searchParams.get('producto') ?? undefined

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('todas')
  const [onlyWithMaterial, setOnlyWithMaterial] = useState(!canManage)
  const [viewing, setViewing] = useState<{ guide: ProductGuide; productName: string }>()
  const [form, setForm] = useState<FormState>()
  const [busyGuideId, setBusyGuideId] = useState<string>()
  const [actionError, setActionError] = useState<string>()

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))).sort(), [products])

  const visibleProducts = useMemo(() => {
    if (focusedProductId) return products.filter((p) => p.id === focusedProductId)
    const q = query.trim().toLowerCase()
    return products
      .filter((p) => category === 'todas' || p.category === category)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
      .filter((p) => !onlyWithMaterial || (guidesByProductId[p.id]?.length ?? 0) > 0)
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
  }, [products, guidesByProductId, focusedProductId, query, category, onlyWithMaterial])

  if (loadingProducts || loadingGuides) return <PageLoading label="Cargando guías de preparación…" />
  if (productsError || guidesError) {
    return (
      <PageError
        message={productsError ?? guidesError ?? ''}
        onRetry={() => {
          reloadProducts()
          reloadGuides()
        }}
      />
    )
  }

  const totalGuides = Object.values(guidesByProductId).reduce((sum, list) => sum + list.length, 0)
  const focusedProduct = focusedProductId ? products.find((p) => p.id === focusedProductId) : undefined

  const clearFocus = () => {
    searchParams.delete('producto')
    setSearchParams(searchParams, { replace: true })
  }

  const runGuideAction = async (guide: ProductGuide, action: () => Promise<void>, fallback: string) => {
    setActionError(undefined)
    setBusyGuideId(guide.id)
    try {
      await action()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : fallback)
    } finally {
      setBusyGuideId(undefined)
    }
  }

  const handleToggleVisibility = (guide: ProductGuide) =>
    runGuideAction(guide, () => setVisibility(guide.id, !guide.visibleToCustomers), 'No se pudo cambiar la visibilidad.')

  const handleDelete = (guide: ProductGuide) => {
    if (!window.confirm(`¿Eliminar "${guide.title}"? Esta acción no se puede deshacer.`)) return
    void runGuideAction(guide, () => remove(guide), 'No se pudo eliminar el material.')
  }

  const handleSave = async (input: ProductGuideInput, file?: File) => {
    if (form?.guide) await update(form.guide, input, file)
    else await create(input, file)
  }

  return (
    <div>
      <div className="page-toolbar">
        <p className="section-subtitle preparation-page__intro">
          {canManage
            ? 'Sube videos o PDF que expliquen cómo se prepara cada producto. Tu equipo los consulta aquí y desde cada comanda; tú decides cuáles ve también el cliente en el catálogo.'
            : 'Consulta cómo se prepara cada producto: su receta y los videos o PDF que dejó el administrador.'}
        </p>
        {canManage && products.length > 0 && (
          <Button variant="primary" onClick={() => setForm({})}>
            Nuevo video o PDF
          </Button>
        )}
      </div>

      {focusedProductId ? (
        <div className="preparation-page__focus">
          <span className="section-subtitle">
            Mostrando: <strong>{focusedProduct?.name ?? 'producto no encontrado'}</strong>
          </span>
          <Button variant="tertiary" onClick={clearFocus}>
            Ver todos los productos
          </Button>
        </div>
      ) : (
        products.length > 0 && (
          <div className="preparation-page__filters">
            <input
              className="preparation-page__search"
              type="search"
              placeholder="Buscar producto…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar producto"
            />
            {categories.length > 1 && (
              <div className="page-toolbar__filters" role="group" aria-label="Categoría">
                {['todas', ...categories].map((c) => (
                  <button
                    type="button"
                    key={c}
                    aria-pressed={category === c}
                    className={['filter-chip', category === c ? 'filter-chip--active' : ''].join(' ')}
                    onClick={() => setCategory(c)}
                  >
                    {c === 'todas' ? 'Todas' : c}
                  </button>
                ))}
              </div>
            )}
            <label className="preparation-page__toggle">
              <input type="checkbox" checked={onlyWithMaterial} onChange={(e) => setOnlyWithMaterial(e.target.checked)} />
              Solo con videos o PDF ({totalGuides})
            </label>
          </div>
        )
      )}

      {actionError && <div className="form-error-banner">{actionError}</div>}

      {products.length === 0 ? (
        <EmptyState
          title="Aún no hay productos"
          description={canManage ? 'Crea tus productos en “Productos y recetas” y luego agrégales su material de preparación.' : undefined}
        />
      ) : visibleProducts.length === 0 ? (
        <EmptyState
          title={onlyWithMaterial && !focusedProductId ? 'Ningún producto tiene videos o PDF todavía' : 'Ningún producto coincide'}
          description={
            onlyWithMaterial && !focusedProductId
              ? canManage
                ? 'Desmarca “Solo con videos o PDF” para ver todos tus productos y agregarles material.'
                : 'Cuando el administrador suba material de preparación, aparecerá aquí.'
              : undefined
          }
        />
      ) : (
        <div className="card-grid preparation-page__grid">
          {visibleProducts.map((product) => (
            <PreparationCard
              key={product.id}
              product={product}
              guides={guidesByProductId[product.id] ?? []}
              canManage={canManage}
              busyGuideId={busyGuideId}
              onView={(guide) => setViewing({ guide, productName: product.name })}
              onAdd={() => setForm({ productId: product.id })}
              onEdit={(guide) => setForm({ guide })}
              onToggleVisibility={handleToggleVisibility}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {viewing && <GuideViewerModal guide={viewing.guide} productName={viewing.productName} onClose={() => setViewing(undefined)} />}
      {form && (
        <ProductGuideFormModal
          products={products}
          guide={form.guide}
          defaultProductId={form.productId}
          onSave={handleSave}
          onClose={() => setForm(undefined)}
        />
      )}
    </div>
  )
}

interface PreparationCardProps {
  product: Product
  guides: ProductGuide[]
  canManage: boolean
  busyGuideId?: string
  onView: (guide: ProductGuide) => void
  onAdd: () => void
  onEdit: (guide: ProductGuide) => void
  onToggleVisibility: (guide: ProductGuide) => void
  onDelete: (guide: ProductGuide) => void
}

function PreparationCard({ product, guides, canManage, busyGuideId, onView, onAdd, onEdit, onToggleVisibility, onDelete }: PreparationCardProps) {
  return (
    <article className="preparation-card">
      <header className="preparation-card__header">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt="" loading="lazy" className="preparation-card__image" />
        ) : (
          <span className="preparation-card__image preparation-card__image--empty" aria-hidden="true">
            ☕
          </span>
        )}
        <div>
          <strong>{product.name}</strong>
          <span className="preparation-card__category">{product.category}</span>
        </div>
      </header>

      {product.recipe && product.recipe.length > 0 && (
        <details className="preparation-card__recipe">
          <summary>Receta ({product.recipe.length} ingredientes)</summary>
          <ul>
            {product.recipe.map((ingredient) => (
              <li key={ingredient.inventoryItemId}>
                {ingredient.inventoryItemName} · {ingredient.quantity} {ingredient.unit}
              </li>
            ))}
          </ul>
        </details>
      )}

      {guides.length === 0 ? (
        <p className="preparation-card__empty">Aún no hay videos ni PDF para este producto.</p>
      ) : (
        <ul className="preparation-card__guides">
          {guides.map((guide) => {
            const busy = busyGuideId === guide.id
            return (
              <li key={guide.id} className="preparation-card__guide">
                <button type="button" className="preparation-card__guide-open" onClick={() => onView(guide)}>
                  <span aria-hidden="true">{GUIDE_KIND_ICON[guide.kind]}</span>
                  <span className="preparation-card__guide-title">
                    {guide.title}
                    <span className="preparation-card__guide-kind">
                      {GUIDE_KIND_LABEL[guide.kind]}
                      {guide.externalUrl ? ' · enlace' : ''}
                    </span>
                  </span>
                  <span className="preparation-card__guide-cta">Ver</span>
                </button>

                {canManage && (
                  <div className="preparation-card__guide-admin">
                    <Badge tone={guide.visibleToCustomers ? 'success' : 'neutral'}>
                      {guide.visibleToCustomers ? 'Visible para el cliente' : 'Solo personal'}
                    </Badge>
                    <div className="preparation-card__guide-actions">
                      <button type="button" disabled={busy} onClick={() => onToggleVisibility(guide)}>
                        {guide.visibleToCustomers ? 'Ocultar al cliente' : 'Mostrar al cliente'}
                      </button>
                      <button type="button" disabled={busy} onClick={() => onEdit(guide)}>
                        Editar
                      </button>
                      <button type="button" disabled={busy} className="preparation-card__danger" onClick={() => onDelete(guide)}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {canManage && (
        <button type="button" className="preparation-card__add" onClick={onAdd}>
          + Agregar video o PDF
        </button>
      )}
    </article>
  )
}
