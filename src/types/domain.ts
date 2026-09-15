/**
 * Modelo de dominio de Cafexis.
 * Basado en documento_alcance_proyecto.pdf. Estas formas son el contrato
 * que también deberá exponer el futuro backend: las pantallas y hooks
 * consumen estos tipos a través de la capa de servicios (services/api),
 * nunca directamente del mock.
 */

export type BusinessType = 'cafeteria' | 'grano_molido' | 'mixto'

export interface Business {
  id: string
  name: string
  type: BusinessType
  logoUrl?: string
  country: string
}

export type UserRole = 'supervisor_tecnico' | 'administrador' | 'barista' | 'cliente'

export interface AppUser {
  id: string
  name: string
  email: string
  role: UserRole
  active: boolean
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

// --- Ventas / pedidos ---

export type OrderStatus = 'pedido' | 'en_preparacion' | 'listo' | 'entregado'

export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia' | 'billetera_digital' | 'cripto'

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

// --- Proveedores ---

export interface Supplier {
  id: string
  nit: string
  name: string
  location: string
  branches?: string[]
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
  supplierId: string
  supplierName: string
  origin: PurchaseOrderOrigin
  reason?: string
  status: PurchaseOrderStatus
  lines: PurchaseOrderLine[]
  createdAt: string
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
