import { supabase, getActiveBusinessId } from './supabaseClient'
import { mapProduct } from './mappers'
import type { Product } from '@/types/domain'
import type { ProductRow, ProductRecipeItemRow } from '@/types/database'

const PRODUCT_SELECT = '*, product_recipe_items_cafexis(*, inventory_items_cafexis(name))'

interface ProductWithRecipeRow extends ProductRow {
  product_recipe_items_cafexis?: ProductRecipeItemRow[]
}

function mapRow(row: ProductWithRecipeRow): Product {
  return mapProduct(row, row.product_recipe_items_cafexis ?? [])
}

export async function listProducts(): Promise<Product[]> {
  const businessId = await getActiveBusinessId()

  const { data, error } = await supabase
    .from('products_cafexis')
    .select(PRODUCT_SELECT)
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .returns<ProductWithRecipeRow[]>()

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapRow)
}

async function replaceRecipe(productId: string, recipe: Product['recipe']): Promise<void> {
  const { error: deleteError } = await supabase
    .from('product_recipe_items_cafexis')
    .delete()
    .eq('product_id', productId)
  if (deleteError) throw new Error(deleteError.message)

  if (!recipe || recipe.length === 0) return

  const { error: insertError } = await supabase.from('product_recipe_items_cafexis').insert(
    recipe.map((r) => ({
      product_id: productId,
      inventory_item_id: r.inventoryItemId,
      quantity: r.quantity,
      unit: r.unit,
    })),
  )
  if (insertError) throw new Error(insertError.message)
}

export async function createProduct(input: Omit<Product, 'id'>): Promise<Product> {
  const businessId = await getActiveBusinessId()

  const { data, error } = await supabase
    .from('products_cafexis')
    .insert({
      business_id: businessId,
      name: input.name,
      category: input.category,
      price: input.price,
      image_url: input.imageUrl ?? null,
    })
    .select()
    .single<ProductRow>()

  if (error || !data) throw new Error(error?.message ?? 'No se pudo crear el producto.')

  await replaceRecipe(data.id, input.recipe)
  return mapProduct(data, [])
}

export async function updateProduct(id: string, input: Omit<Product, 'id'>): Promise<Product> {
  const { data, error } = await supabase
    .from('products_cafexis')
    .update({
      name: input.name,
      category: input.category,
      price: input.price,
      image_url: input.imageUrl ?? null,
    })
    .eq('id', id)
    .select()
    .single<ProductRow>()

  if (error || !data) throw new Error(error?.message ?? `Producto ${id} no encontrado`)

  await replaceRecipe(id, input.recipe)
  return mapProduct(data, [])
}
