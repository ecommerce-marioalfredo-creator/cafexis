# Cafexis · Frontend (Panel del negocio)

Primera etapa del sistema de gestión y ventas para negocios de café, descrito en
[`Documentos/documento_alcance_proyecto.pdf`](Documentos/documento_alcance_proyecto.pdf).
Esta entrega cubre el **panel web para el administrador/dueño del negocio**:
dashboard, ventas, inventario, productos y recetas, compras, proveedores,
reportes, trazabilidad y configuración.

El backend es **Supabase** (Postgres + autenticación + Row Level Security),
con el esquema definido en [`supabase/`](supabase/). El frontend ya está
conectado: `src/services/api/*Service.ts` consulta las tablas reales (sufijo
`_cafexis`) a través de `src/services/api/supabaseClient.ts`, y
`authService.ts` usa Supabase Auth para login/registro. Las páginas y hooks
no saben nada de Supabase — solo consumen esa capa de servicios.

### Configurar las credenciales

Copia `.env.example` a `.env` y coloca la Project URL y la anon key de tu
proyecto de Supabase (Project Settings → API en el panel de Supabase):

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

`.env` no se versiona (ver `.gitignore`). Sin estas variables, la app lanza un
error explícito al arrancar.

## Stack

- React 18 + TypeScript + Vite
- React Router
- Supabase (`@supabase/supabase-js`) para datos y autenticación
- CSS plano con tokens de marca en `src/styles/tokens.css` (colores,
  tipografía Poppins/Manrope, espaciado), según el Manual de Marca y el
  Design System de Cafexis.

## Cómo correrlo

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`. Sin sesión activa, la app redirige a `/ingreso`.
Para iniciar sesión con la cuenta demo (`laura@micafeteria.co`), primero hay
que crearla en Supabase Auth — ver el paso 4 de [`supabase/README.md`](supabase/README.md).
Registrar un negocio nuevo desde `/registro` funciona sin pasos manuales.

## Estructura

```
src/
  types/domain.ts       Modelo de dominio (Order, InventoryItem, CoffeeLot, etc.)
  types/database.ts     Tipos de fila de Supabase (snake_case, espejo del esquema SQL)
  services/mock/        Datos de ejemplo (ya no los usa ningún *Service; solo referencia)
  services/api/
    supabaseClient.ts     Cliente único de Supabase + resolución del negocio activo
    mappers.ts            Traduce filas de Supabase (snake_case) a tipos de dominio
    authService.ts        Login/registro/logout vía Supabase Auth
    *Service.ts            Un servicio por dominio, todos consultan Supabase
  hooks/                Un hook por dominio, consume los *Service
  context/AuthContext.tsx  Sesión activa (negocio + usuario), reactiva a Supabase Auth
  components/layout/    Sidebar, Topbar, AppShell, RequireAuth, AuthLayout
  components/ui/        Button, Badge, Card, MetricCard, PageState, EmptyState, Modal, FormField
  components/domain/    OrderCard, InventoryRow, RecipeCard, ProductFormModal, PurchaseOrderCard, TraceabilityCard
  pages/                Una página por sección del sidebar + LoginPage/RegisterPage
  router.tsx            Rutas de la app (públicas + protegidas por RequireAuth)
```

## Pendiente para siguientes etapas

- Vistas para los roles Barista/Vendedor y Cliente final (catálogo, carrito,
  estado de pedido), ya contempladas en el modelo de dominio pero no
  maquetadas en esta entrega.
- Generación real de código QR de trazabilidad (hoy es un placeholder visual).
- Vector maestro definitivo del logo (hoy se usan los PNG provistos).
- Subida de logos de negocio a Supabase Storage (hoy el registro guarda el
  logo como data URL en `logo_url`, útil para probar pero pesado a escala).
