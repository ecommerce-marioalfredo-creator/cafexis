/**
 * Modelo de dominio de Cafexis.
 * Basado en documento_alcance_proyecto.pdf. Estas formas son el contrato
 * que también deberá exponer el futuro backend: las pantallas y hooks
 * consumen estos tipos a través de la capa de servicios (services/api),
 * nunca directamente del mock.
 */

export type BusinessType = 'cafeteria' | 'grano_molido' | 'mixto'

/** Personalización visual que cada negocio define al registrarse (sección "theming"). */
export interface BusinessBranding {
  primaryColor: string
  logoUrl?: string
}

export interface Business {
  id: string
  name: string
  type: BusinessType
  country: string
  branding: BusinessBranding
  /** Identificador en la URL pública (/c/:slug), único en toda la plataforma. */
  slug: string
}

/** Datos editables del negocio desde Configuración (el logo se sube aparte, ver uploadBusinessLogo). */
export interface BusinessUpdateInput {
  name: string
  type: BusinessType
  country: string
  primaryColor: string
}

export type UserRole = 'supervisor_tecnico' | 'soporte' | 'administrador' | 'barista' | 'cliente'

export interface AppUser {
  id: string
  businessId: string
  name: string
  email: string
  role: UserRole
  active: boolean
}

/** Rol que se puede asignar a un usuario interno invitado (nunca 'cliente' ni 'supervisor_tecnico'). */
/** 'soporte' solo lo puede invitar el supervisor técnico (lo valida la Edge Function y la base de datos). */
export type InvitableRole = 'administrador' | 'barista' | 'soporte'

export type InvitationStatus = 'pendiente' | 'aceptada' | 'expirada'

export interface UserInvitation {
  id: string
  businessId: string
  email: string
  name: string
  role: UserRole
  status: InvitationStatus
  createdAt: string
}

// --- Autenticación (mock local vía localStorage, ver services/api/authService.ts) ---

export interface AuthSession {
  userId: string
  businessId: string
}

export interface RegisterInput {
  businessName: string
  businessType: BusinessType
  country: string
  ownerName: string
  email: string
  password: string
  primaryColor: string
  logoUrl?: string
}

export interface LoginInput {
  email: string
  password: string
}

// --- Inventario ---

export type StockStatus = 'ok' | 'bajo' | 'agotado'

export interface InventoryItem {
  id: string
  name: string
  unit: string // ej. "kg", "l", "uds"
  quantity: number
  lowStockThreshold: number
  status: StockStatus
  /** Proveedor al que se propone reponerlo cuando baja del umbral. */
  preferredSupplierId?: string
}

/** Datos editables de un ingrediente/insumo (la existencia se ajusta aparte, ver adjustInventoryQuantity). */
export interface InventoryItemInput {
  name: string
  unit: string
  lowStockThreshold: number
  preferredSupplierId?: string
}

/** Al crear un ingrediente nuevo también se define su existencia inicial. */
export interface NewInventoryItemInput extends InventoryItemInput {
  quantity: number
}

// --- Productos y recetas (cafeterías) ---

export interface RecipeIngredient {
  inventoryItemId: string
  inventoryItemName: string
  quantity: number
  unit: string
}

export interface Product {
  id: string
  name: string
  category: string
  price: number
  imageUrl?: string
  recipe?: RecipeIngredient[]
  /** Lote de café (coffee_lots_cafexis) del que proviene, si es café empacado. */
  coffeeLotId?: string
  /** Kg del lote que consume cada unidad vendida (ej. bolsa de 500 g = 0.5); sin esto no se descuenta el lote. */
  lotKgPerUnit?: number
}

// --- Trazabilidad (café en grano/molido) ---

export type CoffeeProcess = 'lavado' | 'honey' | 'natural' | 'otro'

export interface CoffeeLot {
  id: string
  code: string
  variety: string
  process: CoffeeProcess
  origin: {
    country: string
    region: string
    farm?: string
  }
  story?: string
  qrUrl?: string
  quantityKg: number
  harvestYear: number
}

/** Datos para crear/editar un lote de café. */
export interface CoffeeLotInput {
  code: string
  variety: string
  process: CoffeeProcess
  origin: {
    country: string
    region: string
    farm?: string
  }
  story?: string
  quantityKg: number
  harvestYear: number
}

// --- Ventas / pedidos ---

/** 'pendiente_pago' solo ocurre en pedidos públicos del cliente final, mientras se confirma el cobro en línea (Fase 6). */
export type OrderStatus = 'pendiente_pago' | 'pedido' | 'en_preparacion' | 'listo' | 'entregado'

/** 'billetera_digital' y 'cripto' solo existen en pedidos antiguos; el punto de venta ofrece los cuatro primeros. */
export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia' | 'nequi' | 'billetera_digital' | 'cripto'

export interface OrderItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
}

export interface Order {
  id: string
  code: string
  customerName: string
  tableOrReference?: string
  items: OrderItem[]
  total: number
  status: OrderStatus
  paymentMethod: PaymentMethod
  createdAt: string
}

/** Venta registrada desde el punto de venta. Los precios los toma la base de datos, no el cliente. */
export interface NewSaleInput {
  items: Array<{ productId: string; quantity: number }>
  paymentMethod: PaymentMethod
  tableOrReference?: string
  customerName?: string
}

// --- Proveedores ---

export interface Supplier {
  id: string
  nit: string
  name: string
  location: string
  branches?: string[]
}

/** Datos para dar de alta un proveedor nuevo (si el NIT ya existe, se reutiliza en vez de crear uno). */
export interface SupplierInput {
  nit: string
  name: string
  location: string
  branches: string[]
}

// --- Compras ---

export type PurchaseOrderOrigin = 'sugerida_sistema' | 'manual'
export type PurchaseOrderStatus = 'propuesta' | 'confirmada' | 'recibida' | 'cancelada'

export interface PurchaseOrderLine {
  inventoryItemId: string
  inventoryItemName: string
  quantity: number
  unit: string
}

export interface PurchaseOrder {
  id: string
  code: string
  /** Vacío en propuestas de insumos sin proveedor preferido; se exige al confirmar. */
  supplierId?: string
  supplierName: string
  origin: PurchaseOrderOrigin
  reason?: string
  status: PurchaseOrderStatus
  lines: PurchaseOrderLine[]
  createdAt: string
  receivedAt?: string
}

/** Orden de compra creada a mano (nace confirmada). */
export interface NewPurchaseOrderInput {
  supplierId: string
  reason?: string
  lines: Array<Omit<PurchaseOrderLine, 'inventoryItemName'>>
}

// --- Reportes / dashboard ---

export interface DashboardSummary {
  salesToday: number
  activeOrders: number
  lowStockAlerts: number
  topProducts: Array<{ productName: string; unitsSold: number }>
  inventoryAlerts: Array<{ itemName: string; remaining: string }>
}

/** De dónde salen los datos del reporte. */
export type ReportDataset = 'ventas' | 'insumos' | 'lotes'

/**
 * Cómo se agrupan las filas. 'auto' elige la escala de tiempo según el
 * período (hora para un día, día para semana/mes). 'elemento' = por insumo
 * o por lote.
 */
export type ReportGroupBy =
  | 'auto'
  | 'producto'
  | 'categoria'
  | 'metodo_pago'
  | 'elemento'
  | 'hora'
  | 'dia'
  | 'semana'
  | 'mes'

export type ReportTimeGroupBy = 'hora' | 'dia' | 'semana' | 'mes'

/** Período: día/semana/mes navegables, ventanas móviles o un rango fijo. */
export type ReportPeriodKind = 'dia' | 'semana' | 'mes' | 'ultimos_7' | 'ultimos_30' | 'rango'

/** Dato que grafica el reporte. Ventas: dinero/unidades/pedidos; inventario: el resto. */
export type ReportMetric = 'dinero' | 'unidades' | 'pedidos' | 'vendido' | 'entradas' | 'ajustes' | 'existencia' | 'cobertura'

export interface ReportFilters {
  productIds?: string[]
  categories?: string[]
  paymentMethods?: PaymentMethod[]
  /** Insumos (dataset 'insumos') o lotes (dataset 'lotes'). */
  elementIds?: string[]
}

/** Lo que guarda custom_reports_cafexis.config; los predefinidos usan la misma forma. */
export interface ReportConfig {
  dataset: ReportDataset
  groupBy: ReportGroupBy
  metric: ReportMetric
  chart: 'barras' | 'tabla'
  period: ReportPeriodKind
  /** Solo con period = 'rango' (yyyy-mm-dd, ambos inclusive). */
  rangeFrom?: string
  rangeTo?: string
  filters?: ReportFilters
  /** Tabla secundaria (ej. ventas por método de pago en "Total de ventas"). */
  breakdown?: 'metodo_pago'
}

export interface ReportDefinition {
  id: string
  name: string
  description: string
  custom: boolean
  config: ReportConfig
}

export type ReportDefinitionInput = Pick<ReportDefinition, 'name' | 'description' | 'config'>

export interface SalesReportRow {
  key: string
  label: string
  units: number
  revenue: number
  orders: number
}

export interface StockReportRow {
  key: string
  label: string
  unit: string
  /** Salidas por ventas (positivo). */
  sold: number
  /** Entradas por compras recibidas o existencia inicial. */
  received: number
  /** Ajustes manuales netos (con signo). */
  adjusted: number
  currentQuantity?: number
  threshold?: number
  /** Consumo diario promedio del período. */
  dailyRate?: number
  /** Días que dura la existencia actual a ese ritmo (vacío si no hubo ventas). */
  daysCoverage?: number
}

/** Período ya resuelto a fechas, listo para consultar. */
export interface ResolvedPeriod {
  from: Date
  /** Exclusivo. */
  to: Date
  label: string
}

export interface ReplenishmentProjection {
  inventoryItemId: string
  name: string
  unit: string
  quantity: number
  lowStockThreshold: number
  status: StockStatus
  dailyConsumption: number
  /** Días de historial realmente usados (menos que la ventana si el negocio es nuevo). */
  historyDays: number
  daysUntilOut?: number
  depletesAt?: string
  daysUntilThreshold?: number
  suggestedQuantity: number
  preferredSupplierId?: string
  inOpenOrder: boolean
}

// --- Cliente final (Fase 5): catálogo público, trazabilidad por QR, pedido ---

/** Lo mínimo que un visitante sin cuenta puede ver de un negocio (get_public_business_cafexis). */
export interface PublicBusiness {
  id: string
  name: string
  type: BusinessType
  branding: BusinessBranding
  slug: string
}

/** Producto del catálogo público (sin receta ni datos internos del negocio). */
export interface PublicProduct {
  id: string
  name: string
  category: string
  price: number
  imageUrl?: string
}

/** Lote de café mostrado en la página pública de trazabilidad (/trazabilidad/:lotId). */
export interface PublicCoffeeLot {
  id: string
  businessId: string
  businessName: string
  code: string
  variety: string
  process: CoffeeProcess
  origin: {
    country: string
    region: string
    farm?: string
  }
  story?: string
  quantityKg: number
  harvestYear: number
}

/** Perfil del cliente final (login con Google), sin negocio fijo. */
export interface Customer {
  id: string
  name: string
  email: string
  phone?: string
}

/** Un negocio al que el cliente ya está vinculado (pantalla "Mis negocios"). */
export interface CustomerBusinessLink {
  business: PublicBusiness
  linkedAt: string
}

/** Pedido hecho por el cliente desde /c/:slug. */
export interface NewPublicOrderInput {
  businessId: string
  items: Array<{ productId: string; quantity: number }>
  paymentMethod: PaymentMethod
  tableOrReference?: string
}

// --- Fase 7: plataforma y soporte ---

export type SupportCaseStatus = 'abierto' | 'en_progreso' | 'esperando_cliente' | 'resuelto' | 'cerrado'
export type SupportCasePriority = 'baja' | 'media' | 'alta' | 'urgente'
export type SupportCaseCategory = 'inventario' | 'ventas' | 'compras' | 'usuarios' | 'reportes' | 'cuenta' | 'otro'

export interface SupportCaseSummary {
  id: string
  code: string
  businessId: string
  businessName: string
  subject: string
  category: SupportCaseCategory
  priority: SupportCasePriority
  status: SupportCaseStatus
  openedByName?: string
  assignedTo?: string
  assignedToName?: string
  /** Mensajes públicos (sin eventos ni notas internas). */
  messages: number
  firstResponseAt?: string
  lastActivityAt: string
  createdAt: string
}

export interface SupportCaseMessage {
  id: string
  /** nota_interna solo llega al equipo de plataforma. */
  kind: 'mensaje' | 'nota_interna' | 'evento'
  body: string
  authorName?: string
  authorIsStaff: boolean
  createdAt: string
}

export interface SupportCaseDetail extends Omit<SupportCaseSummary, 'messages'> {
  description: string
  resolvedAt?: string
  closedAt?: string
  messages: SupportCaseMessage[]
}

export interface NewSupportCaseInput {
  subject: string
  description: string
  category: SupportCaseCategory
  priority: SupportCasePriority
  /** Solo el equipo de plataforma puede abrir casos para otro negocio. */
  businessId?: string
}

export interface SupportStaffMember {
  id: string
  name: string
  role: UserRole
}

export interface PlatformBusinessOverview {
  id: string
  name: string
  type: BusinessType
  slug?: string
  primaryColor: string
  logoUrl?: string
  createdAt: string
  activeUsers: number
  lastSignInAt?: string
  lastOrderAt?: string
  ordersToday: number
  salesToday: number
  orders7d: number
  sales7d: number
  lowStock: number
  outOfStock: number
  openProposals: number
  openCases: number
  urgentCases: number
}

export interface PlatformBusinessDetail {
  business: { id: string; name: string; type: BusinessType; country: string; slug?: string; primaryColor: string; logoUrl?: string; createdAt: string }
  users: Array<{ id: string; name: string; email: string; role: UserRole; active: boolean; lastSignInAt?: string }>
  pendingInvitations: number
  inventoryAlerts: Array<{ name: string; quantity: number; unit: string; threshold: number; status: StockStatus }>
  recentOrders: Array<{ code: string; createdAt: string; total: number; status: OrderStatus; paymentMethod: PaymentMethod; items: number }>
  openPurchaseOrders: Array<{ code: string; status: PurchaseOrderStatus; origin: PurchaseOrderOrigin; createdAt: string }>
  sales14d: Array<{ day: string; revenue: number; orders: number }>
}

// --- Fase 6: suscripciones, pagos en línea, facturación DIAN ---

export type SubscriptionStatus = 'trial' | 'activa' | 'vencida' | 'cancelada'
export type BillingPeriod = 'mensual' | 'anual'

export interface SubscriptionPlan {
  id: string
  name: string
  priceCents: number
  billingPeriod: BillingPeriod
  trialDays: number
  active: boolean
}

/** Estado de suscripción de un negocio a la plataforma (no confundir con una suscripción de ese negocio a sus propios clientes). */
export interface BusinessSubscription {
  businessId: string
  planId: string
  planName?: string
  status: SubscriptionStatus
  trialEndsAt?: string
  currentPeriodEndsAt?: string
  /** true si el negocio puede operar ahora mismo (trial vigente o período activo). */
  isActive: boolean
}

/** Fila de business_subscriptions_cafexis con el nombre del negocio, para la lista del supervisor. */
export interface BusinessSubscriptionOverview extends BusinessSubscription {
  businessName: string
}

export type PaymentTransactionStatus = 'pendiente' | 'aprobada' | 'declinada' | 'error'

export interface PaymentTransaction {
  id: string
  orderId: string
  provider: string
  status: PaymentTransactionStatus
  amountCents: number
  createdAt: string
}

export type InvoiceStatus = 'pendiente' | 'emitida' | 'error'

export interface Invoice {
  id: string
  orderId: string
  status: InvoiceStatus
  cufe?: string
  pdfUrl?: string
  xmlUrl?: string
  errorMessage?: string
}
