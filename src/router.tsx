import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { RequireAuth } from '@/components/layout/RequireAuth'
import { RequireRole } from '@/components/layout/RequireRole'
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
])
