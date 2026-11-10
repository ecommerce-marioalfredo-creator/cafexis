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
  /** Se sube al bucket business-logos tras crear el negocio (no se guarda como data URL). */
  logoFile?: File
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

// --- Guías de preparación (videos y PDF por producto, 0018) ---

export type ProductGuideKind = 'video' | 'pdf'

/**
 * Material que explica cómo preparar un producto. Viene de un archivo del
 * bucket privado product-guides (storagePath) o de un enlace externo
 * (externalUrl); nunca de ambos.
 */
export interface ProductGuide {
  id: string
  productId: string
  title: string
  description?: string
  kind: ProductGuideKind
  storagePath?: string
  externalUrl?: string
  /** Si el cliente final lo ve desde el catálogo público. */
  visibleToCustomers: boolean
  createdAt: string
}

/** Datos editables de un material (el archivo, si lo hay, se sube aparte). */
export interface ProductGuideInput {
  productId: string
  title: string
  description?: string
  kind: ProductGuideKind
  /** Enlace externo (YouTube, Vimeo, Drive…); se ignora si se sube un archivo. */
  externalUrl?: string
  visibleToCustomers: boolean
}

/** Lo que el cliente final ve de un material desde el catálogo. */
export type PublicProductGuide = Omit<ProductGuide, 'visibleToCustomers' | 'createdAt'>

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

/**
 * 'pendiente_pago' solo ocurre en pedidos públicos del cliente final, hasta que se confirma el cobro (en línea o en
 * caja). 'cancelado' es final, repone el inventario y el pedido se conserva en los históricos (0014 y 0016).
 */
export type OrderStatus = 'pendiente_pago' | 'pedido' | 'en_preparacion' | 'listo' | 'entregado' | 'cancelado'

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
  /** Último cambio (por ejemplo, cuándo se entregó o se canceló). */
  updatedAt: string
  cancelledAt?: string
  cancelledBySide?: OrderCancelledBySide
  /** Nombre de quien canceló, si fue del negocio (solo en el histórico de Reportes). */
  cancelledByName?: string
  cancellationReason?: string
  /** Factura electrónica del pedido, si se solicitó (solo en el tablero interno de ventas). */
  invoice?: Invoice
}

export type OrderCancelledBySide = 'cliente' | 'negocio'

/** Aviso de cancelación de un pedido, para el negocio o para el cliente que lo hizo. */
export interface OrderNotification {
  id: string
  orderId: string
  message: string
  readAt?: string
  createdAt: string
}

/** Una página del histórico de pedidos de Reportes. */
export interface OrderHistoryPage {
  orders: Order[]
  /** Total de pedidos con el filtro aplicado, no solo los de esta página. */
  total: number
  /** Cancelados del período, sin importar el filtro. */
  cancelled: number
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

/** Perfil del cliente final (con Google o invitado), sin negocio fijo. */
export interface Customer {
  id: string
  name: string
  email: string
  phone?: string
  /** Entró sin cuenta: su historial solo existe en este dispositivo. */
  isGuest: boolean
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

/** Planes de Cafexis (0019_planes_suscripcion_cafexis.sql). El código no cambia; el nombre sí puede. */
export type PlanCode = 'basica' | 'profesional' | 'premium'

/** Funciones que activa un plan: mismas claves que subscription_plans_cafexis.features. */
export type PlanFeature =
  | 'pedidos_cliente'
  | 'compras'
  | 'lotes'
  | 'reportes'
  | 'dashboard_mas_vendidos'
  | 'guias_equipo'
  | 'color_marca'
  | 'trazabilidad_publica'
  | 'guias_cliente'
  | 'reportes_personalizados'
  | 'pagos_en_linea'
  | 'factura_dian'

/** Topes de un plan: mismas claves que subscription_plans_cafexis.limits. Sin la clave, no hay límite. */
export type PlanLimit = 'usuarios' | 'productos' | 'insumos' | 'historial_dias'

export interface SubscriptionPlan {
  id: string
  code: PlanCode
  name: string
  description: string
  /** Pesos, no centavos. */
  monthlyPrice: number
  annualPrice: number
  trialDays: number
  features: PlanFeature[]
  limits: Partial<Record<PlanLimit, number>>
  recommended: boolean
}

/** Plan pago que el negocio pidió y aún no se ha cobrado (0020). */
export interface PendingPlanChange {
  planCode: PlanCode
  planName: string
  billingPeriod: BillingPeriod
  requestedAt: string
  /** Caso de soporte donde se coordina el pago. */
  caseId?: string
}

/** Plan con el que opera el negocio ahora mismo, sus funciones, límites y uso (get_business_plan_cafexis). */
export interface BusinessPlan {
  businessId: string
  status: SubscriptionStatus
  trialEndsAt?: string
  currentPeriodEndsAt?: string
  /** Plan contratado. */
  planCode: PlanCode
  planName: string
  /** Plan con el que opera hoy: el contratado si sigue vigente; si no, Básica. */
  effectivePlanCode: PlanCode
  effectivePlanName: string
  features: PlanFeature[]
  limits: Partial<Record<PlanLimit, number>>
  addons: PlanFeature[]
  usage: Record<'usuarios' | 'productos' | 'insumos', number>
  /** false solo si la cuenta está cancelada: el panel se bloquea. Vencer ya no bloquea, baja a Básica. */
  isActive: boolean
  /** La prueba o el plan pagado vencieron y el negocio opera en Básica. */
  lapsed: boolean
  /** Sin la migración 0019: no hay planes ni datos de uso; el negocio tiene todo, como antes. */
  legacy: boolean
  /** Forma de pago del plan vigente (0020). */
  billingPeriod: BillingPeriod
  pendingChange?: PendingPlanChange
}

/** Resultado de cambiar de plan: aplicado al instante, o solicitud pendiente de pago con su caso de soporte. */
export interface PlanChangeResult {
  applied: boolean
  planName: string
  caseId?: string
  periodEndsAt?: string
}

/** Suscripción de un negocio, para la lista del supervisor técnico. */
export interface BusinessSubscriptionOverview {
  businessId: string
  businessName: string
  planId: string
  planCode?: PlanCode
  planName?: string
  status: SubscriptionStatus
  trialEndsAt?: string
  currentPeriodEndsAt?: string
  addons: PlanFeature[]
  /** Solicitud de cambio pendiente de pago (0020). */
  pendingPlanId?: string
  pendingBillingPeriod?: BillingPeriod
  pendingRequestedAt?: string
}

export interface SubscriptionUpdate {
  planId?: string
  status?: SubscriptionStatus
  /** null quita la fecha de vencimiento. */
  currentPeriodEndsAt?: string | null
  addons?: PlanFeature[]
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

// --- Panel del super usuario (0021_super_usuario_promociones_cafexis.sql) ---

/** dias_gratis: N días de un plan pago, al instante. descuento: N % sobre el precio durante N meses. */
export type PromoBenefit = 'dias_gratis' | 'descuento'

/** Un negocio que usó un código de promoción. */
export interface PromoRedemption {
  businessId: string
  businessName: string
  code: string
  /** Lo que dio, en texto: "30 días de Premium, hasta el 10/12/2026". */
  summary: string
  /** Lo aplicó el supervisor técnico (no el administrador del negocio). */
  byPlatform: boolean
  createdAt: string
}

export interface PromoCodeInput {
  code: string
  description?: string
  benefit: PromoBenefit
  /** dias_gratis: plan que se regala. descuento: plan al que aplica (vacío = cualquier plan pago). */
  planId?: string
  freeDays?: number
  discountPercent?: number
  discountMonths?: number
  /** Último momento en que se puede canjear. */
  expiresAt: string
  /** Vacío = sin tope. */
  maxRedemptions?: number
  active: boolean
}

export interface PromoCode extends PromoCodeInput {
  id: string
  createdAt: string
  redemptions: PromoRedemption[]
}

export interface PromoRedeemResult {
  code: string
  benefit: PromoBenefit
  summary: string
  planName?: string
  endsAt?: string
}

/** Descuento vigente y códigos usados por el negocio activo, para Suscripción. */
export interface BusinessPromoStatus {
  discountPercent?: number
  discountEndsAt?: string
  redemptions: PromoRedemption[]
}

export interface PlatformAccountUser {
  id: string
  name: string
  email: string
  role: UserRole
  active: boolean
  createdAt: string
  lastSignInAt?: string
}

export interface PlatformAccountInvitation {
  id: string
  name: string
  email: string
  role: UserRole
  createdAt: string
}

/** Suscripción completa de un negocio, como la ve el super usuario. */
export interface PlatformAccountSubscription {
  planId: string
  planCode?: PlanCode
  planName?: string
  /** Plan con el que opera hoy (el contratado si sigue vigente; si no, Básica). */
  effectivePlanCode: PlanCode
  status: SubscriptionStatus
  billingPeriod: BillingPeriod
  trialEndsAt?: string
  currentPeriodEndsAt?: string
  addons: PlanFeature[]
  discountPercent?: number
  discountEndsAt?: string
  discountCode?: string
  pendingPlanId?: string
  pendingBillingPeriod?: BillingPeriod
  pendingRequestedAt?: string
  pendingCaseId?: string
  updatedAt: string
}

/** Un negocio con su suscripción, uso, usuarios, invitaciones y códigos usados. */
export interface PlatformAccount {
  id: string
  name: string
  type: BusinessType
  slug?: string
  primaryColor: string
  createdAt: string
  subscription?: PlatformAccountSubscription
  usage: Record<'usuarios' | 'productos' | 'insumos' | 'clientes', number>
  users: PlatformAccountUser[]
  invitations: PlatformAccountInvitation[]
  redemptions: Array<Pick<PromoRedemption, 'code' | 'summary' | 'byPlatform' | 'createdAt'>>
}

/** Todo lo que el super usuario puede cambiar de una suscripción. */
export interface SubscriptionAdminUpdate {
  planId: string
  status: SubscriptionStatus
  billingPeriod: BillingPeriod
  /** null = sin fecha. */
  trialEndsAt: string | null
  currentPeriodEndsAt: string | null
  addons: PlanFeature[]
  /** null quita el descuento (y el código que lo dio). */
  discountPercent: number | null
  discountEndsAt: string | null
}

/** Plan tal como lo edita el super usuario (incluye los que no están a la venta). */
export interface AdminPlan extends SubscriptionPlan {
  active: boolean
  sortOrder: number
}

export type AdminPlanUpdate = Pick<
  AdminPlan,
  'name' | 'description' | 'monthlyPrice' | 'annualPrice' | 'trialDays' | 'features' | 'limits' | 'recommended' | 'active'
>
