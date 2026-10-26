import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { RequireAuth } from '@/components/layout/RequireAuth'
import { RequireRole } from '@/components/layout/RequireRole'
import { CustomerAuthRoot } from '@/components/layout/CustomerAuthRoot'
import { RequireCustomerAuth } from '@/components/layout/RequireCustomerAuth'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { SalesPage } from '@/pages/SalesPage'
import { InventoryPage } from '@/pages/InventoryPage'
import { ProductsPage } from '@/pages/ProductsPage'
import { PurchasesPage } from '@/pages/PurchasesPage'
import { SuppliersPage } from '@/pages/SuppliersPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { TraceabilityPage } from '@/pages/TraceabilityPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { PublicCatalogPage } from '@/pages/PublicCatalogPage'
import { PublicLotPage } from '@/pages/PublicLotPage'
import { CustomerBusinessesPage } from '@/pages/CustomerBusinessesPage'
import { CustomerOrdersPage } from '@/pages/CustomerOrdersPage'
import { HelpPage } from '@/pages/HelpPage'
import { SupportConsolePage } from '@/pages/SupportConsolePage'
import { SupportBusinessPage, SupportCasePage } from '@/pages/SupportBusinessPage'
import { SubscriptionExpiredPage } from '@/pages/SubscriptionExpiredPage'
import { SubscriptionsPage } from '@/pages/SubscriptionsPage'
import { APP_TARGET, type AppTarget } from '@/platform/appTarget'
import { ADMIN_ROLES, BUSINESS_STAFF_ROLES, HELP_ROLES, PLATFORM_ROLES } from '@/components/layout/roles'

// Grupos de roles en components/layout/roles.ts (los mismos que usa el
// menú en Sidebar.tsx). El barista solo tiene /ventas y /ayuda; soporte
// solo la consola (/soporte), que es de solo lectura sobre los negocios.

/** Panel del personal (empleados internos y equipo de plataforma). */
const staffRoutes: RouteObject[] = [
  { path: '/ingreso', element: <LoginPage /> },
  { path: '/registro', element: <RegisterPage /> },
  {
    element: <RequireAuth />,
    children: [
      // Fase 6: bloqueo de acceso cuando la suscripción del negocio venció.
      // Fuera de AppShell (no necesita Sidebar/Topbar) pero dentro de
      // RequireAuth (exige sesión de empleado) — ver la excepción de
      // pathname en RequireAuth.tsx para no generar un bucle.
      { path: '/suscripcion-vencida', element: <SubscriptionExpiredPage /> },
      {
        path: '/',
        element: <AppShell />,
        children: [
          {
            element: <RequireRole roles={ADMIN_ROLES} />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: 'inventario', element: <InventoryPage /> },
              { path: 'productos', element: <ProductsPage /> },
              { path: 'compras', element: <PurchasesPage /> },
              { path: 'proveedores', element: <SuppliersPage /> },
              { path: 'reportes', element: <ReportsPage /> },
              { path: 'trazabilidad', element: <TraceabilityPage /> },
              { path: 'suscripcion', element: <SubscriptionsPage /> },
              { path: 'configuracion', element: <SettingsPage /> },
            ],
          },
          {
            element: <RequireRole roles={BUSINESS_STAFF_ROLES} />,
            children: [{ path: 'ventas', element: <SalesPage /> }],
          },
          {
            element: <RequireRole roles={HELP_ROLES} />,
            children: [
              { path: 'ayuda', element: <HelpPage /> },
              { path: 'ayuda/:caseId', element: <HelpPage /> },
            ],
          },
          {
            element: <RequireRole roles={PLATFORM_ROLES} />,
            children: [
              { path: 'soporte', element: <SupportConsolePage /> },
              { path: 'soporte/negocios/:businessId', element: <SupportBusinessPage /> },
              { path: 'soporte/casos/:caseId', element: <SupportCasePage /> },
            ],
          },
        ],
      },
    ],
  },
]

// --- Cliente final (Fase 5): rutas públicas, nunca bajo RequireAuth (ese
// guard es solo para empleados internos). Montan su propio
// CustomerAuthProvider, separado de AuthProvider — ver la nota de
// arquitectura en CustomerAuthContext.tsx.
const customerRoutes: RouteObject[] = [
  {
    element: <CustomerAuthRoot />,
    children: [
      // Alias corto para compartir directamente el catálogo del negocio demo.
      { path: '/mi-cafeteria', element: <Navigate to="/c/mi-cafeteria" replace /> },
      { path: '/trazabilidad/:lotId', element: <PublicLotPage /> },
      { path: '/c/:slug', element: <PublicCatalogPage /> },
      // "Mis negocios" ya resuelve el caso sin sesión mostrando el botón de
      // login (no usa RequireCustomerAuth, que redirigiría antes de eso).
      { path: '/mis-negocios', element: <CustomerBusinessesPage /> },
      {
        element: <RequireCustomerAuth />,
        children: [{ path: '/c/:slug/pedidos', element: <CustomerOrdersPage /> }],
      },
    ],
  },
]

/**
 * Fase 7: la web lleva todo; cada app de las tiendas solo su parte (ver
 * platform/appTarget.ts). Cualquier ruta ajena a la app vuelve a su inicio.
 */
const ROUTES_BY_TARGET: Record<AppTarget, RouteObject[]> = {
  web: [...staffRoutes, ...customerRoutes],
  equipo: [...staffRoutes, { path: '*', element: <Navigate to="/" replace /> }],
  clientes: [
    { path: '/', element: <Navigate to="/mis-negocios" replace /> },
    ...customerRoutes,
    { path: '*', element: <Navigate to="/mis-negocios" replace /> },
  ],
}

export const router = createBrowserRouter(ROUTES_BY_TARGET[APP_TARGET])
