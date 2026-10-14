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
  SupplierRow,
  SupplierBranchRow,
  BusinessSupplierRow,
  OrderRow,
  OrderItemRow,
  PurchaseOrderRow,
  CustomReportRow,
  UserInvitationRow,
  PublicBusinessRow,
  PublicProductRow,
  PublicCoffeeLotRow,
  CustomerRow,
  CustomerBusinessRow,
  BusinessSubscriptionRow,
  PaymentTransactionRow,
  InvoiceRow,
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
  ReportConfig,
  UserInvitation,
  PublicBusiness,
  PublicProduct,
  PublicCoffeeLot,
  Customer,
  CustomerBusinessLink,
  BusinessSubscription,
  BusinessSubscriptionOverview,
  PaymentTransaction,
  Invoice,
} from '@/types/domain'

export function mapBusiness(row: BusinessRow): Business {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    country: row.country,
    branding: { primaryColor: row.primary_color, logoUrl: row.logo_url ?? undefined },
    slug: row.slug,
  }
}

export function mapPublicBusiness(row: PublicBusinessRow): PublicBusiness {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    branding: { primaryColor: row.primary_color, logoUrl: row.logo_url ?? undefined },
    slug: row.slug,
  }
}

export function mapPublicProduct(row: PublicProductRow): PublicProduct {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: Number(row.price),
    imageUrl: row.image_url ?? undefined,
  }
}

export function mapPublicCoffeeLot(row: PublicCoffeeLotRow): PublicCoffeeLot {
  return {
    id: row.id,
    businessId: row.business_id,
    businessName: row.business_name,
    code: row.code,
    variety: row.variety,
    process: row.process,
    origin: {
      country: row.origin_country,
      region: row.origin_region,
      farm: row.origin_farm ?? undefined,
    },
    story: row.story ?? undefined,
    quantityKg: Number(row.quantity_kg),
    harvestYear: row.harvest_year,
  }
}

export function mapCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? undefined,
  }
}

export function mapCustomerBusinessLink(row: CustomerBusinessRow): CustomerBusinessLink {
  const b = row.businesses_cafexis
  return {
    business: b
      ? {
          id: b.id,
          name: b.name,
          type: b.type,
          branding: { primaryColor: b.primary_color, logoUrl: b.logo_url ?? undefined },
          slug: b.slug,
        }
      : { id: row.business_id, name: '', type: 'cafeteria', branding: { primaryColor: '#D85A30' }, slug: '' },
    linkedAt: row.linked_at,
  }
}

export function mapUserInvitation(row: UserInvitationRow): UserInvitation {
  return {
    id: row.id,
    businessId: row.business_id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
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
    preferredSupplierId: row.preferred_supplier_id ?? undefined,
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
    coffeeLotId: row.coffee_lot_id ?? undefined,
    lotKgPerUnit: row.lot_kg_per_unit != null ? Number(row.lot_kg_per_unit) : undefined,
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

/** Proveedor directo (sin pasar por la fila puente de negocio), usado al buscar por NIT. */
export function mapSupplier(row: SupplierRow, branchRows: SupplierBranchRow[] = []): Supplier {
  return {
    id: row.id,
    nit: row.nit,
    name: row.name,
    location: row.location,
    branches: branchRows.length > 0 ? branchRows.map((b) => b.branch_name) : undefined,
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
    supplierId: row.supplier_id ?? undefined,
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
    receivedAt: row.received_at ?? undefined,
  }
}

/** Reportes guardados antes de la Fase 4 (config vacía) se abren como "más vendidos". */
const DEFAULT_REPORT_CONFIG: ReportConfig = {
  dataset: 'ventas',
  groupBy: 'producto',
  metric: 'unidades',
  chart: 'barras',
  period: 'semana',
}

export function mapCustomReport(row: CustomReportRow): ReportDefinition {
  const saved = row.config as Partial<ReportConfig>
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    custom: true,
    config: saved.dataset ? { ...DEFAULT_REPORT_CONFIG, ...saved } : DEFAULT_REPORT_CONFIG,
  }
}

// --- Fase 6: suscripciones, pagos en línea, facturación DIAN ---

function isSubscriptionActive(row: BusinessSubscriptionRow): boolean {
  const now = Date.now()
  if (row.status === 'trial') {
    return !row.trial_ends_at || new Date(row.trial_ends_at).getTime() > now
  }
  if (row.status === 'activa') {
    return !row.current_period_ends_at || new Date(row.current_period_ends_at).getTime() > now
  }
  return false
}

export function mapBusinessSubscription(row: BusinessSubscriptionRow): BusinessSubscription {
  return {
    businessId: row.business_id,
    planId: row.plan_id,
    planName: row.subscription_plans_cafexis?.name,
    status: row.status,
    trialEndsAt: row.trial_ends_at ?? undefined,
    currentPeriodEndsAt: row.current_period_ends_at ?? undefined,
    isActive: isSubscriptionActive(row),
  }
}

export function mapBusinessSubscriptionOverview(row: BusinessSubscriptionRow): BusinessSubscriptionOverview {
  return {
    ...mapBusinessSubscription(row),
    businessName: row.businesses_cafexis?.name ?? '',
  }
}

export function mapPaymentTransaction(row: PaymentTransactionRow): PaymentTransaction {
  return {
    id: row.id,
    orderId: row.order_id,
    provider: row.provider,
    status: row.status,
    amountCents: row.amount_cents,
    createdAt: row.created_at,
  }
}

export function mapInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    orderId: row.order_id,
    status: row.status,
    cufe: row.cufe ?? undefined,
    pdfUrl: row.pdf_url ?? undefined,
    xmlUrl: row.xml_url ?? undefined,
    errorMessage: row.error_message ?? undefined,
  }
}
