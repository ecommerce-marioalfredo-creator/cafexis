import { createBrowserRouter } from 'react-router-dom'
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

// Roles que pueden ver el panel administrativo completo (todo salvo
// Ventas). El barista solo tiene acceso a /ventas, su tablero de pedidos —
// ver también Sidebar.tsx, que oculta estos mismos enlaces del menú.
const ADMIN_ROLES = ['administrador', 'supervisor_tecnico'] as const

export const router = createBrowserRouter([
  { path: '/ingreso', element: <LoginPage /> },
  { path: '/registro', element: <RegisterPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <AppShell />,
        children: [
          {
            element: <RequireRole roles={[...ADMIN_ROLES]} />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: 'inventario', element: <InventoryPage /> },
              { path: 'productos', element: <ProductsPage /> },
              { path: 'compras', element: <PurchasesPage /> },
              { path: 'proveedores', element: <SuppliersPage /> },
              { path: 'reportes', element: <ReportsPage /> },
              { path: 'trazabilidad', element: <TraceabilityPage /> },
              { path: 'configuracion', element: <SettingsPage /> },
            ],
          },
          // Ventas: accesible para todos los roles internos (administrador,
          // supervisor_tecnico y barista).
          { path: 'ventas', element: <SalesPage /> },
        ],
      },
    ],
  },
  // --- Cliente final (Fase 5): rutas públicas, nunca bajo RequireAuth (ese
  // guard es solo para empleados internos). Montan su propio
  // CustomerAuthProvider, separado de AuthProvider — ver la nota de
  // arquitectura en CustomerAuthContext.tsx.
  {
    element: <CustomerAuthRoot />,
    children: [
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
])
