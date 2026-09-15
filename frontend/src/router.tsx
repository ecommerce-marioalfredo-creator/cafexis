import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/pages/DashboardPage'
import { SalesPage } from '@/pages/SalesPage'
import { InventoryPage } from '@/pages/InventoryPage'
import { ProductsPage } from '@/pages/ProductsPage'
import { PurchasesPage } from '@/pages/PurchasesPage'
import { SuppliersPage } from '@/pages/SuppliersPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { TraceabilityPage } from '@/pages/TraceabilityPage'
import { SettingsPage } from '@/pages/SettingsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'ventas', element: <SalesPage /> },
      { path: 'inventario', element: <InventoryPage /> },
      { path: 'productos', element: <ProductsPage /> },
      { path: 'compras', element: <PurchasesPage /> },
      { path: 'proveedores', element: <SuppliersPage /> },
      { path: 'reportes', element: <ReportsPage /> },
      { path: 'trazabilidad', element: <TraceabilityPage /> },
      { path: 'configuracion', element: <SettingsPage /> },
    ],
  },
])
