/**
 * Datos de ejemplo para el panel del negocio.
 * Representan un negocio mixto (cafetería + venta de café en grano),
 * tal como contempla la sección 3 del documento de alcance del proyecto.
 *
 * Ningún services/api/*Service.ts activo usa ya este archivo: desde la
 * conexión a Supabase, todos leen de las tablas *_cafexis reales. Se
 * conserva como referencia legible de qué datos existen en el seed SQL
 * (supabase/migrations/0003_seed_demo_cafexis.sql es la fuente equivalente
 * ya aplicada en la base de datos).
 */
import type {
  Business,
  AppUser,
  InventoryItem,
  Product,
  CoffeeLot,
  Order,
  Supplier,
  PurchaseOrder,
  ReportDefinition,
} from '@/types/domain'

export const business: Business = {
  id: 'biz-1',
  name: 'Mi Cafetería',
  type: 'mixto',
  country: 'Colombia',
  branding: { primaryColor: '#D85A30' }, // colores por defecto de Cafexis; sin logo propio (demo)
}

export const users: AppUser[] = [
  { id: 'u-1', businessId: 'biz-1', name: 'Laura Gómez', email: 'laura@micafeteria.co', role: 'administrador', active: true },
  { id: 'u-2', businessId: 'biz-1', name: 'Andrés Ruiz', email: 'andres@micafeteria.co', role: 'barista', active: true },
  { id: 'u-3', businessId: 'biz-1', name: 'Soporte Cafexis', email: 'soporte@cafexis.co', role: 'supervisor_tecnico', active: true },
]

/** Contraseña de la cuenta demo (solo para el mock local, ver authService.ts). */
export const DEMO_PASSWORD = 'cafexis123'

export const inventoryItems: InventoryItem[] = [
  { id: 'inv-1', name: 'Leche entera', unit: 'l', quantity: 3, lowStockThreshold: 8, status: 'bajo' },
  { id: 'inv-2', name: 'Café Huila (molido)', unit: 'kg', quantity: 2, lowStockThreshold: 5, status: 'bajo' },
  { id: 'inv-3', name: 'Vasos 12oz', unit: 'uds', quantity: 40, lowStockThreshold: 100, status: 'bajo' },
  { id: 'inv-4', name: 'Azúcar', unit: 'kg', quantity: 12, lowStockThreshold: 5, status: 'ok' },
  { id: 'inv-5', name: 'Jarabe de vainilla', unit: 'l', quantity: 4, lowStockThreshold: 2, status: 'ok' },
  { id: 'inv-6', name: 'Leche de avena', unit: 'l', quantity: 0, lowStockThreshold: 4, status: 'agotado' },
  { id: 'inv-7', name: 'Café Nariño (grano)', unit: 'kg', quantity: 18, lowStockThreshold: 6, status: 'ok' },
  { id: 'inv-8', name: 'Tapas para vaso', unit: 'uds', quantity: 210, lowStockThreshold: 100, status: 'ok' },
]

export const products: Product[] = [
  {
    id: 'p-1',
    name: 'Latte vainilla',
    category: 'Bebidas',
    price: 9500,
    recipe: [
      { inventoryItemId: 'inv-2', inventoryItemName: 'Café Huila (molido)', quantity: 0.02, unit: 'kg' },
      { inventoryItemId: 'inv-1', inventoryItemName: 'Leche entera', quantity: 0.2, unit: 'l' },
      { inventoryItemId: 'inv-5', inventoryItemName: 'Jarabe de vainilla', quantity: 0.03, unit: 'l' },
    ],
  },
  {
    id: 'p-2',
    name: 'Cold brew',
    category: 'Bebidas',
    price: 8000,
    recipe: [{ inventoryItemId: 'inv-2', inventoryItemName: 'Café Huila (molido)', quantity: 0.03, unit: 'kg' }],
  },
  {
    id: 'p-3',
    name: 'Espresso doble',
    category: 'Bebidas',
    price: 6000,
    recipe: [{ inventoryItemId: 'inv-2', inventoryItemName: 'Café Huila (molido)', quantity: 0.018, unit: 'kg' }],
  },
  {
    id: 'p-4',
    name: 'Cappuccino',
    category: 'Bebidas',
    price: 8500,
    recipe: [
      { inventoryItemId: 'inv-2', inventoryItemName: 'Café Huila (molido)', quantity: 0.02, unit: 'kg' },
      { inventoryItemId: 'inv-1', inventoryItemName: 'Leche entera', quantity: 0.15, unit: 'l' },
    ],
  },
  {
    id: 'p-5',
    name: 'Café de origen · Huila (bolsa 500g)',
    category: 'Café empacado',
    price: 32000,
  },
  {
    id: 'p-6',
    name: 'Café Nariño (bolsa 340g)',
    category: 'Café empacado',
    price: 26000,
  },
]

export const coffeeLots: CoffeeLot[] = [
  {
    id: 'lot-1',
    code: 'HUI-2026-04',
    variety: 'Caturra',
    process: 'lavado',
    origin: { country: 'Colombia', region: 'Huila', farm: 'Finca La Esperanza' },
    story:
      'Cultivado a 1.750 msnm por la familia Perdomo, este lote de Caturra se procesa con lavado tradicional y secado en camas africanas.',
    quantityKg: 42,
    harvestYear: 2026,
  },
  {
    id: 'lot-2',
    code: 'NAR-2026-01',
    variety: 'Castillo',
    process: 'honey',
    origin: { country: 'Colombia', region: 'Nariño', farm: 'Finca El Mirador' },
    story: 'Proceso honey que resalta notas dulces y frutales, cosechado en las laderas del volcán Galeras.',
    quantityKg: 18,
    harvestYear: 2026,
  },
  {
    id: 'lot-3',
    code: 'CAU-2025-11',
    variety: 'Típica',
    process: 'natural',
    origin: { country: 'Colombia', region: 'Cauca' },
    quantityKg: 9,
    harvestYear: 2025,
  },
]

const now = Date.now()
const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString()

export const orders: Order[] = [
  {
    id: 'ord-1',
    code: 'A-101',
    customerName: 'Mesa 3',
    tableOrReference: 'Mesa 3',
    items: [{ productId: 'p-1', productName: 'Latte vainilla', quantity: 2, unitPrice: 9500 }],
    total: 19000,
    status: 'entregado',
    paymentMethod: 'tarjeta',
    createdAt: hoursAgo(5),
  },
  {
    id: 'ord-2',
    code: 'A-102',
    customerName: 'Juan Pérez',
    tableOrReference: 'Para llevar',
    items: [{ productId: 'p-2', productName: 'Cold brew', quantity: 1, unitPrice: 8000 }],
    total: 8000,
    status: 'en_preparacion',
    paymentMethod: 'transferencia',
    createdAt: hoursAgo(1),
  },
  {
    id: 'ord-3',
    code: 'A-103',
    customerName: 'Mesa 5',
    tableOrReference: 'Mesa 5',
    items: [
      { productId: 'p-4', productName: 'Cappuccino', quantity: 2, unitPrice: 8500 },
      { productId: 'p-3', productName: 'Espresso doble', quantity: 1, unitPrice: 6000 },
    ],
    total: 23000,
    status: 'pedido',
    paymentMethod: 'efectivo',
    createdAt: hoursAgo(0.2),
  },
  {
    id: 'ord-4',
    code: 'A-104',
    customerName: 'María Torres',
    items: [{ productId: 'p-5', productName: 'Café de origen · Huila (bolsa 500g)', quantity: 1, unitPrice: 32000 }],
    total: 32000,
    status: 'entregado',
    paymentMethod: 'billetera_digital',
    createdAt: hoursAgo(20),
  },
  {
    id: 'ord-5',
    code: 'A-105',
    customerName: 'Mesa 1',
    tableOrReference: 'Mesa 1',
    items: [{ productId: 'p-1', productName: 'Latte vainilla', quantity: 1, unitPrice: 9500 }],
    total: 9500,
    status: 'listo',
    paymentMethod: 'tarjeta',
    createdAt: hoursAgo(0.5),
  },
  {
    id: 'ord-6',
    code: 'A-106',
    customerName: 'Carlos Ibáñez',
    items: [{ productId: 'p-6', productName: 'Café Nariño (bolsa 340g)', quantity: 2, unitPrice: 26000 }],
    total: 52000,
    status: 'pedido',
    paymentMethod: 'efectivo',
    createdAt: hoursAgo(0.1),
  },
  {
    id: 'ord-7',
    code: 'A-107',
    customerName: 'Mesa 2',
    tableOrReference: 'Mesa 2',
    items: [{ productId: 'p-3', productName: 'Espresso doble', quantity: 2, unitPrice: 6000 }],
    total: 12000,
    status: 'entregado',
    paymentMethod: 'tarjeta',
    createdAt: hoursAgo(3),
  },
  {
    id: 'ord-8',
    code: 'A-108',
    customerName: 'Sofía Ramírez',
    tableOrReference: 'Para llevar',
    items: [{ productId: 'p-4', productName: 'Cappuccino', quantity: 1, unitPrice: 8500 }],
    total: 8500,
    status: 'en_preparacion',
    paymentMethod: 'transferencia',
    createdAt: hoursAgo(0.3),
  },
]

export const suppliers: Supplier[] = [
  { id: 'sup-1', nit: '900123456-1', name: 'Distribuidora Café del Sur', location: 'Neiva, Huila', branches: ['Neiva', 'Pitalito'] },
  { id: 'sup-2', nit: '901987654-2', name: 'Lácteos La Sabana', location: 'Bogotá, Cundinamarca' },
  { id: 'sup-3', nit: '900555222-3', name: 'Empaques y Desechables JR', location: 'Medellín, Antioquia' },
  { id: 'sup-4', nit: '901222333-4', name: 'Finca El Mirador (venta directa)', location: 'Nariño' },
]

export const purchaseOrders: PurchaseOrder[] = [
  {
    id: 'po-1',
    code: 'OC-2026-014',
    supplierId: 'sup-2',
    supplierName: 'Lácteos La Sabana',
    origin: 'sugerida_sistema',
    reason: 'La leche entera está por debajo del umbral mínimo (3 l de 8 l).',
    status: 'propuesta',
    lines: [{ inventoryItemId: 'inv-1', inventoryItemName: 'Leche entera', quantity: 20, unit: 'l' }],
    createdAt: hoursAgo(2),
  },
  {
    id: 'po-2',
    code: 'OC-2026-013',
    supplierId: 'sup-1',
    supplierName: 'Distribuidora Café del Sur',
    origin: 'sugerida_sistema',
    reason: 'Café Huila molido por debajo del umbral mínimo (2 kg de 5 kg).',
    status: 'propuesta',
    lines: [{ inventoryItemId: 'inv-2', inventoryItemName: 'Café Huila (molido)', quantity: 10, unit: 'kg' }],
    createdAt: hoursAgo(6),
  },
  {
    id: 'po-3',
    code: 'OC-2026-012',
    supplierId: 'sup-3',
    supplierName: 'Empaques y Desechables JR',
    origin: 'manual',
    status: 'confirmada',
    lines: [{ inventoryItemId: 'inv-3', inventoryItemName: 'Vasos 12oz', quantity: 300, unit: 'uds' }],
    createdAt: hoursAgo(48),
  },
]

export const reportDefinitions: ReportDefinition[] = [
  { id: 'rep-1', name: 'Bebidas y productos más vendidos', description: 'Por día, semana o mes.', custom: false },
  { id: 'rep-2', name: 'Total de ventas en dinero', description: 'Durante un período determinado.', custom: false },
  { id: 'rep-3', name: 'Ingredientes que se agotan más rápido', description: 'Basado en consumo histórico.', custom: false },
  { id: 'rep-4', name: 'Movimiento y disponibilidad de lotes', description: 'Para café en grano o molido.', custom: false },
]
