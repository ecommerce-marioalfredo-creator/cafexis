import type { PlanCode, PlanFeature, SubscriptionPlan } from '@/types/domain'

/**
 * Lo que la página de Suscripción muestra de cada plan. Las funciones y los
 * límites que de verdad se aplican viven en la base de datos
 * (subscription_plans_cafexis, 0019_planes_suscripcion_cafexis.sql); este
 * archivo solo los explica. Si cambias un plan allá, revisa este cuadro.
 */

export const PLAN_ORDER: PlanCode[] = ['basica', 'profesional', 'premium']

/** Copia de los planes de la 0019, para mostrar la página si la consulta falla o la migración aún no está aplicada. */
export const FALLBACK_PLANS: SubscriptionPlan[] = [
  {
    id: 'basica',
    code: 'basica',
    name: 'Básica',
    description: 'Para empezar a vender',
    monthlyPrice: 0,
    annualPrice: 0,
    trialDays: 0,
    features: [],
    limits: { usuarios: 2, productos: 20, insumos: 30, historial_dias: 30 },
    recommended: false,
  },
  {
    id: 'profesional',
    code: 'profesional',
    name: 'Profesional',
    description: 'Para operar todo el día a día',
    monthlyPrice: 79_900,
    annualPrice: 799_000,
    trialDays: 14,
    features: ['pedidos_cliente', 'compras', 'lotes', 'reportes', 'dashboard_mas_vendidos', 'guias_equipo', 'color_marca'],
    limits: { usuarios: 6 },
    recommended: true,
  },
  {
    id: 'premium',
    code: 'premium',
    name: 'Premium',
    description: 'Para crecer y diferenciarte',
    monthlyPrice: 149_900,
    annualPrice: 1_499_000,
    trialDays: 14,
    features: [
      'pedidos_cliente',
      'compras',
      'lotes',
      'reportes',
      'dashboard_mas_vendidos',
      'guias_equipo',
      'color_marca',
      'trazabilidad_publica',
      'guias_cliente',
      'reportes_personalizados',
      'pagos_en_linea',
      'factura_dian',
    ],
    limits: {},
    recommended: false,
  },
]

/** Plan más económico que incluye cada función: el texto de los candados ("Disponible en Profesional"). */
export const FEATURE_MIN_PLAN: Record<PlanFeature, PlanCode> = {
  pedidos_cliente: 'profesional',
  compras: 'profesional',
  lotes: 'profesional',
  reportes: 'profesional',
  dashboard_mas_vendidos: 'profesional',
  guias_equipo: 'profesional',
  color_marca: 'profesional',
  trazabilidad_publica: 'premium',
  guias_cliente: 'premium',
  reportes_personalizados: 'premium',
  pagos_en_linea: 'premium',
  factura_dian: 'premium',
}

export const PLAN_NAME: Record<PlanCode, string> = {
  basica: 'Básica',
  profesional: 'Profesional',
  premium: 'Premium',
}

/** "Disponible en Profesional", según el plan más económico que incluye la función. */
export const availableInLabel = (feature: PlanFeature) => `Disponible en ${PLAN_NAME[FEATURE_MIN_PLAN[feature]]}`

/** Qué gana el negocio con cada función: el texto de los avisos de "sube de plan". */
export const FEATURE_PITCH: Record<PlanFeature, { title: string; description: string }> = {
  pedidos_cliente: {
    title: 'Pedidos desde el celular',
    description: 'Tus clientes piden desde la mesa con carrito, eligen cómo pagar y siguen su pedido en “Mis pedidos”.',
  },
  compras: {
    title: 'Compras y proveedores',
    description:
      'Propuestas de compra automáticas cuando un insumo baja, órdenes a tus proveedores y recepción que suma al inventario.',
  },
  lotes: {
    title: 'Trazabilidad del café',
    description: 'Registra cada lote con su variedad, proceso y origen, y lígalo a tus productos empacados.',
  },
  reportes: {
    title: 'Reportes del negocio',
    description: 'Más vendidos, ventas por método de pago, insumos que se agotan y lotes, por día, semana o mes.',
  },
  dashboard_mas_vendidos: {
    title: 'Más vendidos',
    description: 'Las bebidas y productos que más salen hoy, en el dashboard.',
  },
  guias_equipo: {
    title: 'Guías de preparación',
    description: 'Videos y PDF de cada producto para que todo tu equipo prepare igual.',
  },
  color_marca: {
    title: 'Color de marca',
    description: 'Tu color en el panel y en el catálogo que ven tus clientes.',
  },
  trazabilidad_publica: {
    title: 'Origen del café con QR',
    description: 'Un código QR en el empaque que le cuenta a tu cliente la historia del lote, hasta la finca.',
  },
  guias_cliente: {
    title: '“Cómo se prepara” para tus clientes',
    description: 'Tus videos y PDF de preparación, visibles en el catálogo.',
  },
  reportes_personalizados: {
    title: 'Reportes personalizados',
    description: 'Elige qué datos ver, cómo agruparlos y con qué gráfica, y guárdalos para volver a usarlos.',
  },
  pagos_en_linea: {
    title: 'Pagos en línea',
    description: 'Tus clientes pagan desde el catálogo con Wompi.',
  },
  factura_dian: {
    title: 'Factura electrónica DIAN',
    description: 'Genera la factura electrónica de cada venta entregada.',
  },
}

/** Lo que muestra cada tarjeta de plan. */
export const PLAN_CARD: Record<PlanCode, { bullets: string[]; ideal: string }> = {
  basica: {
    bullets: [
      'Punto de venta y tablero de comandas',
      'Hasta 20 productos y 30 insumos',
      'Descuento automático de inventario en cada venta',
      'Menú digital con QR para tus clientes',
      '2 usuarios: tú y un barista',
    ],
    ideal: 'un punto de café pequeño o para conocer Cafexis sin pagar.',
  },
  profesional: {
    bullets: [
      'Todo lo de Básica, sin límite de productos ni insumos',
      'Pedidos desde la mesa con carrito y revisión',
      'Compras automáticas y proveedores',
      'Los 4 reportes e histórico completo',
      'Guías de preparación y lotes de café',
      'Hasta 6 usuarios y tu color de marca',
    ],
    ideal: 'una cafetería con equipo que quiere recibir pedidos en la mesa y no quedarse sin insumos.',
  },
  premium: {
    bullets: [
      'Todo lo de Profesional',
      'Origen del café con QR en el empaque',
      '“Cómo se prepara” visible para tus clientes',
      'Reportes personalizados con gráficas',
      'Pagos en línea y factura electrónica DIAN',
      'Usuarios ilimitados y soporte prioritario',
    ],
    ideal:
      'tostadores y tiendas de café de origen que venden la historia del grano, y negocios que facturan electrónicamente.',
  },
}

/** Valor de una celda: incluido, no incluido o un texto (ej. "Hasta 20"). */
export type CompareValue = boolean | string

/** 'soon': aún no está construido. 'setup': el código está listo, falta la cuenta con el proveedor. */
export type CompareTag = 'soon' | 'setup'

export interface CompareRow {
  label: string
  values: [CompareValue, CompareValue, CompareValue]
  tag?: CompareTag
}

/** Cuadro comparativo, en el orden de PLAN_ORDER (Básica, Profesional, Premium). */
export const COMPARE_GROUPS: Array<{ title: string; rows: CompareRow[] }> = [
  {
    title: 'Equipo y negocio',
    rows: [
      { label: 'Usuarios del equipo (administrador y baristas)', values: ['2', 'Hasta 6', 'Ilimitados'] },
      { label: 'App Cafexis Equipo (Android y iOS)', values: [true, true, true] },
      { label: 'Logo del negocio en el panel y el catálogo', values: [true, true, true] },
      { label: 'Color de marca propio en el panel y el catálogo', values: [false, true, true] },
      { label: 'Varias sedes en una misma cuenta', values: [false, false, true], tag: 'soon' },
    ],
  },
  {
    title: 'Ventas',
    rows: [
      { label: 'Punto de venta: efectivo, tarjeta, transferencia y Nequi', values: [true, true, true] },
      { label: 'Tablero de comandas por estado, con la receta para el barista', values: [true, true, true] },
      { label: 'Cobro en caja y cancelación con devolución al inventario', values: [true, true, true] },
      { label: 'Guías de preparación en video y PDF para el equipo', values: [false, true, true] },
    ],
  },
  {
    title: 'Productos e inventario',
    rows: [
      { label: 'Productos con foto y receta', values: ['Hasta 20', 'Ilimitados', 'Ilimitados'] },
      { label: 'Insumos en inventario', values: ['Hasta 30', 'Ilimitados', 'Ilimitados'] },
      { label: 'Descuento automático de insumos en cada venta', values: [true, true, true] },
      { label: 'Alertas de existencia baja y ajustes manuales', values: [true, true, true] },
    ],
  },
  {
    title: 'Compras y proveedores',
    rows: [
      { label: 'Proveedores con NIT y sucursales', values: [false, true, true] },
      { label: 'Propuestas de compra automáticas según existencias', values: [false, true, true] },
      { label: 'Órdenes de compra y recepción que suma al inventario', values: [false, true, true] },
      { label: 'Proyección de reposición: días que alcanza cada insumo', values: [false, true, true] },
    ],
  },
  {
    title: 'Trazabilidad del café',
    rows: [
      {
        label: 'Lotes de café (variedad, proceso, origen) ligados a productos empacados',
        values: [false, true, true],
      },
      { label: 'Página pública del lote con código QR para el empaque', values: [false, false, true] },
    ],
  },
  {
    title: 'Dashboard',
    rows: [
      { label: 'Ventas de hoy', values: [true, true, true] },
      { label: 'Pedidos activos y comandas en curso', values: [true, true, true] },
      { label: 'Alertas de inventario', values: [true, true, true] },
      { label: 'Bebidas y productos más vendidos', values: [false, true, true] },
    ],
  },
  {
    title: 'Reportes',
    rows: [
      { label: 'Histórico de pedidos', values: ['Últimos 30 días', 'Completo', 'Completo'] },
      {
        label: 'Reportes predefinidos: más vendidos, ventas por método de pago, insumos que se agotan y lotes',
        values: [false, true, true],
      },
      { label: 'Reportes personalizados con gráficas', values: [false, false, true] },
      { label: 'Exportar reportes a Excel', values: [false, false, true], tag: 'soon' },
    ],
  },
  {
    title: 'Lo que ve el cliente',
    rows: [
      { label: 'Menú digital con QR: fotos, precios y categorías', values: [true, true, true] },
      { label: 'App Cafexis para clientes', values: [true, true, true] },
      { label: 'Pedido desde el celular con carrito y revisión antes de enviar', values: [false, true, true] },
      { label: 'Mesa o “para llevar” y forma de pago al pedir', values: [false, true, true] },
      { label: 'Entrar con Google o como invitado', values: [false, true, true] },
      { label: 'Mis pedidos: estado, historial y cancelación', values: [false, true, true] },
      { label: 'Avisos de pedidos cancelados, al cliente y al equipo', values: [false, true, true] },
      { label: '“Cómo se prepara”: videos y PDF en el catálogo', values: [false, false, true] },
      { label: 'Origen del café al escanear el QR del empaque', values: [false, false, true] },
      { label: 'Sello “Hecho con Cafexis” en el catálogo', values: ['Visible', 'Sin sello', 'Sin sello'], tag: 'soon' },
    ],
  },
  {
    title: 'Pagos y facturación',
    rows: [
      { label: 'Pagos en línea desde el catálogo (Wompi)', values: [false, false, true], tag: 'setup' },
      { label: 'Factura electrónica DIAN (Factus)', values: [false, 'Complemento', 'Incluida'], tag: 'setup' },
    ],
  },
  {
    title: 'Soporte',
    rows: [
      { label: 'Casos de soporte desde “Ayuda y soporte”', values: [true, true, true] },
      { label: 'Tiempo de respuesta', values: ['3 días hábiles', '1 día hábil', 'Mismo día'] },
      { label: 'Acompañamiento para configurar el negocio', values: [false, false, true] },
    ],
  },
]

/** Cómo funciona el ciclo de la suscripción, tal como lo aplica la 0019. */
export const LIFECYCLE_STEPS: Array<{ title: string; description: string }> = [
  {
    title: 'Prueba de 14 días en Premium',
    description: 'Todo negocio nuevo prueba el plan completo, así conoce lo que puede ganar.',
  },
  {
    title: 'Si no paga, baja a Básica',
    description: 'Sigue vendiendo con el punto de venta y el menú digital; no pierde el negocio.',
  },
  {
    title: 'Lo que excede el límite no se borra',
    description:
      'Productos, insumos, usuarios y reportes de más se conservan y se siguen usando; solo no se pueden agregar nuevos hasta subir de plan.',
  },
  {
    title: 'Cambia de plan cuando quieras',
    description:
      'Usa “Cambiar de plan” en esta página: bajar a Básica es inmediato y un plan pago se activa apenas se confirma el pago.',
  },
]
