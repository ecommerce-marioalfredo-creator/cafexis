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
}

/** Datos editables del negocio desde Configuración (el logo se sube aparte, ver uploadBusinessLogo). */
export interface BusinessUpdateInput {
  name: string
  type: BusinessType
  country: string
  primaryColor: string
}

export type UserRole = 'supervisor_tecnico' | 'administrador' | 'barista' | 'cliente'

export interface AppUser {
  id: string
  businessId: string
  name: string
  email: string
  role: UserRole
  active: boolean
}

/** Rol que se puede asignar a un usuario interno invitado (nunca 'cliente' ni 'supervisor_tecnico'). */
export type InvitableRole = 'administrador' | 'barista'

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

export type OrderStatus = 'pedido' | 'en_preparacion' | 'listo' | 'entregado'

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

export interface ReportDefinition {
  id: string
  name: string
  description: string
  custom: boolean
}
