/**
 * Traduce filas de Supabase (snake_case, ver src/types/database.ts) a los
 * tipos de dominio que ya consumen hooks y páginas (camelCase, ver
 * src/types/domain.ts). Mantiene el mapeo en un solo lugar para que los
 * *Service no repitan esta lógica.
 */
import type {
  BusinessRow,
  AppUserRow,
  InventoryItemRow,
  ProductRow,
  ProductRecipeItemRow,
  CoffeeLotRow,
  BusinessSupplierRow,
  OrderRow,
  OrderItemRow,
  PurchaseOrderRow,
  CustomReportRow,
} from '@/types/database'
import type {
  Business,
  AppUser,
  InventoryItem,
  Product,
  RecipeIngredient,
  CoffeeLot,
  Supplier,
  Order,
  OrderItem,
  PurchaseOrder,
  ReportDefinition,
} from '@/types/domain'

export function mapBusiness(row: BusinessRow): Business {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    country: row.country,
    branding: { primaryColor: row.primary_color, logoUrl: row.logo_url ?? undefined },
  }
}

export function mapAppUser(row: AppUserRow): AppUser {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    email: row.email,
    role: row.role,
    active: row.active,
  }
}

export function mapInventoryItem(row: InventoryItemRow): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    quantity: Number(row.quantity),
    lowStockThreshold: Number(row.low_stock_threshold),
    status: row.status,
  }
}

export function mapRecipeItem(row: ProductRecipeItemRow): RecipeIngredient {
  return {
    inventoryItemId: row.inventory_item_id,
    inventoryItemName: row.inventory_items_cafexis?.name ?? '',
    quantity: Number(row.quantity),
    unit: row.unit,
  }
}

export function mapProduct(row: ProductRow, recipeRows: ProductRecipeItemRow[] = []): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: Number(row.price),
    imageUrl: row.image_url ?? undefined,
    recipe: recipeRows.length > 0 ? recipeRows.map(mapRecipeItem) : undefined,
  }
}

export function mapCoffeeLot(row: CoffeeLotRow): CoffeeLot {
  return {
    id: row.id,
    code: row.code,
    variety: row.variety,
    process: row.process,
    origin: {
      country: row.origin_country,
      region: row.origin_region,
      farm: row.origin_farm ?? undefined,
    },
    story: row.story ?? undefined,
    qrUrl: row.qr_url ?? undefined,
    quantityKg: Number(row.quantity_kg),
    harvestYear: row.harvest_year,
  }
}

/** A partir de la fila puente business_suppliers_cafexis con su join anidado. */
export function mapBusinessSupplier(row: BusinessSupplierRow): Supplier {
  const supplier = row.suppliers_cafexis
  return {
    id: supplier?.id ?? row.supplier_id,
    nit: supplier?.nit ?? '',
    name: supplier?.name ?? '',
    location: supplier?.location ?? '',
    branches: supplier?.supplier_branches_cafexis?.map((b) => b.branch_name),
  }
}

export function mapOrderItem(row: OrderItemRow): OrderItem {
  return {
    productId: row.product_id ?? '',
    productName: row.product_name,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
  }
}

export function mapOrder(row: OrderRow): Order {
  return {
    id: row.id,
    code: row.code,
    customerName: row.customer_name,
    tableOrReference: row.table_or_reference ?? undefined,
    items: (row.order_items_cafexis ?? []).map(mapOrderItem),
    total: Number(row.total),
    status: row.status,
    paymentMethod: row.payment_method,
    createdAt: row.created_at,
  }
}

export function mapPurchaseOrder(row: PurchaseOrderRow): PurchaseOrder {
  return {
    id: row.id,
    code: row.code,
    supplierId: row.supplier_id,
    supplierName: row.suppliers_cafexis?.name ?? '',
    origin: row.origin,
    reason: row.reason ?? undefined,
    status: row.status,
    lines: (row.purchase_order_lines_cafexis ?? []).map((l) => ({
      inventoryItemId: l.inventory_item_id,
      inventoryItemName: l.inventory_items_cafexis?.name ?? '',
      quantity: Number(l.quantity),
      unit: l.unit,
    })),
    createdAt: row.created_at,
  }
}

export function mapCustomReport(row: CustomReportRow): ReportDefinition {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    custom: true,
  }
}
