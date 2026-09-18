/**
 * Tipos de fila de Supabase (esquema en supabase/migrations/0001_schema_cafexis.sql).
 * Escritos a mano a partir del SQL ya aplicado — no generados con `supabase gen
 * types` porque este entorno no tiene la CLI conectada al proyecto. Si el
 * esquema cambia, actualizar este archivo junto con las migraciones.
 *
 * snake_case aquí (como en Postgres) — el mapeo a los tipos camelCase de
 * src/types/domain.ts vive en src/services/api/mappers.ts.
 */

export type BusinessTypeRow = 'cafeteria' | 'grano_molido' | 'mixto'
export type UserRoleRow = 'supervisor_tecnico' | 'administrador' | 'barista' | 'cliente'
export type StockStatusRow = 'ok' | 'bajo' | 'agotado'
export type CoffeeProcessRow = 'lavado' | 'honey' | 'natural' | 'otro'
export type OrderStatusRow = 'pedido' | 'en_preparacion' | 'listo' | 'entregado'
export type PaymentMethodRow = 'efectivo' | 'tarjeta' | 'transferencia' | 'billetera_digital' | 'cripto'
export type PurchaseOrderOriginRow = 'sugerida_sistema' | 'manual'
export type PurchaseOrderStatusRow = 'propuesta' | 'confirmada' | 'recibida' | 'cancelada'
export type InvitationStatusRow = 'pendiente' | 'aceptada' | 'expirada'

export interface BusinessRow {
  id: string
  name: string
  type: BusinessTypeRow
  country: string
  primary_color: string
  logo_url: string | null
  created_at: string
  updated_at: string
}

export interface AppUserRow {
  id: string
  business_id: string
  name: string
  email: string
  role: UserRoleRow
  active: boolean
  created_at: string
}

export interface UserInvitationRow {
  id: string
  business_id: string
  email: string
  name: string
  role: UserRoleRow
  invited_by: string | null
  status: InvitationStatusRow
  created_at: string
}

export interface InventoryItemRow {
  id: string
  business_id: string
  name: string
  unit: string
  quantity: number
  low_stock_threshold: number
  status: StockStatusRow
  created_at: string
  updated_at: string
}

export interface ProductRow {
  id: string
  business_id: string
  name: string
  category: string
  price: number
  image_url: string | null
  created_at: string
  updated_at: string
}

export interface ProductRecipeItemRow {
  id: string
  product_id: string
  inventory_item_id: string
  quantity: number
  unit: string
  created_at: string
  // Presente solo cuando se hace un select anidado (`inventory_items_cafexis(name)`).
  inventory_items_cafexis?: { name: string } | null
}

export interface CoffeeLotRow {
  id: string
  business_id: string
  code: string
  variety: string
  process: CoffeeProcessRow
  origin_country: string
  origin_region: string
  origin_farm: string | null
  story: string | null
  qr_url: string | null
  quantity_kg: number
  harvest_year: number
  created_at: string
  updated_at: string
}

export interface SupplierRow {
  id: string
  nit: string
  name: string
  location: string
  created_at: string
  updated_at: string
}

export interface SupplierBranchRow {
  id: string
  supplier_id: string
  branch_name: string
}

export interface BusinessSupplierRow {
  business_id: string
  supplier_id: string
  created_at: string
  // Presente solo en el select anidado usado por suppliersService.
  suppliers_cafexis?: (SupplierRow & { supplier_branches_cafexis?: SupplierBranchRow[] }) | null
}

export interface OrderRow {
  id: string
  business_id: string
  code: string
  customer_name: string
  table_or_reference: string | null
  total: number
  status: OrderStatusRow
  payment_method: PaymentMethodRow
  created_at: string
  updated_at: string
  // Presente solo en el select anidado usado por salesService/dashboardService.
  order_items_cafexis?: OrderItemRow[]
}

export interface OrderItemRow {
  id: string
  order_id: string
  product_id: string | null
  product_name: string
  quantity: number
  unit_price: number
}

export interface PurchaseOrderRow {
  id: string
  business_id: string
  code: string
  supplier_id: string
  origin: PurchaseOrderOriginRow
  reason: string | null
  status: PurchaseOrderStatusRow
  created_at: string
  updated_at: string
  suppliers_cafexis?: { name: string } | null
  purchase_order_lines_cafexis?: PurchaseOrderLineRow[]
}

export interface PurchaseOrderLineRow {
  id: string
  purchase_order_id: string
  inventory_item_id: string
  quantity: number
  unit: string
  inventory_items_cafexis?: { name: string } | null
}

export interface CustomReportRow {
  id: string
  business_id: string
  created_by: string | null
  name: string
  description: string | null
  config: Record<string, unknown>
  created_at: string
}
