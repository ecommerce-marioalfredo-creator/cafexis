import type { Product } from '@/types/domain'
import './RecipeCard.css'

const currency = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

interface RecipeCardProps {
  product: Product
  onEdit?: (product: Product) => void
}

export function RecipeCard({ product, onEdit }: RecipeCardProps) {
  return (
    <article className="recipe-card">
      <header className="recipe-card__header">
        <div>
          <strong>{product.name}</strong>
          <span className="recipe-card__category">{product.category}</span>
        </div>
        <span className="recipe-card__price">{currency.format(product.price)}</span>
      </header>
      {product.recipe && product.recipe.length > 0 ? (
        <ul className="recipe-card__ingredients">
          {product.recipe.map((ingredient) => (
            <li key={ingredient.inventoryItemId}>
              {ingredient.inventoryItemName} · {ingredient.quantity} {ingredient.unit}
            </li>
          ))}
        </ul>
      ) : (
        <p className="recipe-card__no-recipe">Producto empacado, sin receta asociada.</p>
      )}
      {onEdit && (
        <button className="recipe-card__edit" onClick={() => onEdit(product)}>
          Editar
        </button>
      )}
    </article>
  )
}
