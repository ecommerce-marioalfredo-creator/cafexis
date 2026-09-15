# Cafexis · Frontend (Panel del negocio)

Primera etapa del sistema de gestión y ventas para negocios de café, descrito en
`../documento_alcance_proyecto.pdf`. Esta entrega cubre el **panel web para el
administrador/dueño del negocio**: dashboard, ventas, inventario, productos y
recetas, compras, proveedores, reportes, trazabilidad y configuración.

El backend y la base de datos todavía no existen. Este frontend funciona hoy
con datos de ejemplo (`src/services/mock/data.ts`) servidos a través de una
capa de servicios (`src/services/api/*Service.ts`) que ya tiene la forma que
tendrá la futura API. Cuando el backend esté listo, solo hay que:

1. Definir `VITE_API_BASE_URL` en un archivo `.env` (ver `.env.example`).
2. Reemplazar el cuerpo de cada función en `src/services/api/*Service.ts` por
   una llamada a `apiFetch` (`src/services/api/client.ts`), en lugar de leer
   `src/services/mock/data.ts`.

Las páginas, hooks y componentes no necesitan cambiar.

## Stack

- React 18 + TypeScript + Vite
- React Router
- CSS plano con tokens de marca en `src/styles/tokens.css` (colores,
  tipografía Poppins/Manrope, espaciado), según el Manual de Marca y el
  Design System de Cafexis.

## Cómo correrlo

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`.

## Estructura

```
src/
  types/domain.ts       Modelo de dominio (Order, InventoryItem, CoffeeLot, etc.)
  services/mock/        Datos de ejemplo
  services/api/         Capa de servicios (hoy resuelve contra el mock)
  hooks/                Un hook por dominio, consume los *Service
  components/layout/    Sidebar, Topbar, AppShell
  components/ui/        Button, Badge, Card, MetricCard, PageState, EmptyState
  components/domain/    OrderCard, InventoryRow, RecipeCard, PurchaseOrderCard, TraceabilityCard
  pages/                Una página por sección del sidebar
  router.tsx            Rutas de la app
```

## Pendiente para siguientes etapas

- Vistas para los roles Barista/Vendedor y Cliente final (catálogo, carrito,
  estado de pedido), ya contempladas en el modelo de dominio pero no
  maquetadas en esta entrega.
- Conexión real al backend y autenticación por rol.
- Generación real de código QR de trazabilidad (hoy es un placeholder visual).
- Vector maestro definitivo del logo (hoy se usan los PNG provistos).
