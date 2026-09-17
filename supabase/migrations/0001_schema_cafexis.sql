-- =============================================================================
-- Cafexis · Esquema inicial de base de datos (Supabase / PostgreSQL)
-- Todas las tablas usan el sufijo "_cafexis" para convivir en un proyecto
-- Supabase compartido sin chocar con otros esquemas.
--
-- Basado en el modelo de dominio del frontend (src/types/domain.ts) y en
-- documento_alcance_proyecto.pdf. Multi-tenant: cada fila de negocio cuelga
-- de business_id_cafexis y está protegida con Row Level Security (ver
-- migración 0002_rls_cafexis.sql).
-- =============================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- -----------------------------------------------------------------------------
-- Tipos enumerados (reflejan los union types de src/types/domain.ts)
-- -----------------------------------------------------------------------------

create type business_type_cafexis as enum ('cafeteria', 'grano_molido', 'mixto');
create type user_role_cafexis as enum ('supervisor_tecnico', 'administrador', 'barista', 'cliente');
create type stock_status_cafexis as enum ('ok', 'bajo', 'agotado');
create type coffee_process_cafexis as enum ('lavado', 'honey', 'natural', 'otro');
create type order_status_cafexis as enum ('pedido', 'en_preparacion', 'listo', 'entregado');
create type payment_method_cafexis as enum ('efectivo', 'tarjeta', 'transferencia', 'billetera_digital', 'cripto');
create type purchase_order_origin_cafexis as enum ('sugerida_sistema', 'manual');
create type purchase_order_status_cafexis as enum ('propuesta', 'confirmada', 'recibida', 'cancelada');

-- -----------------------------------------------------------------------------
-- Negocios (tenants) — Business en domain.ts
-- -----------------------------------------------------------------------------

create table businesses_cafexis (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type business_type_cafexis not null,
  country text not null default 'Colombia',
  primary_color text not null default '#D85A30', -- branding.primaryColor
  logo_url text,                                    -- branding.logoUrl
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table businesses_cafexis is 'Cada negocio (tenant) que se registra en Cafexis: cafetería, venta de café en grano/molido, o ambos.';

-- -----------------------------------------------------------------------------
-- Usuarios internos del negocio — AppUser en domain.ts
-- 1 a 1 con auth.users de Supabase (Supabase Auth maneja las contraseñas).
-- -----------------------------------------------------------------------------

create table app_users_cafexis (
  id uuid primary key references auth.users (id) on delete cascade,
  business_id uuid not null references businesses_cafexis (id) on delete cascade,
  name text not null,
  email text not null,
  role user_role_cafexis not null default 'administrador',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index app_users_cafexis_business_id_idx on app_users_cafexis (business_id);
comment on table app_users_cafexis is 'Perfil de negocio de cada usuario autenticado (supervisor técnico, administrador, barista o cliente).';

-- -----------------------------------------------------------------------------
-- Inventario — InventoryItem en domain.ts
-- -----------------------------------------------------------------------------

create table inventory_items_cafexis (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses_cafexis (id) on delete cascade,
  name text not null,
  unit text not null,                 -- 'kg', 'l', 'uds', etc.
  quantity numeric(12, 3) not null default 0,
  low_stock_threshold numeric(12, 3) not null default 0,
  status stock_status_cafexis not null default 'ok',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inventory_items_cafexis_business_id_idx on inventory_items_cafexis (business_id);
comment on table inventory_items_cafexis is 'Ingredientes e insumos en existencia (leche, café molido, vasos, etc.), con umbral de alerta de bajo stock.';

-- -----------------------------------------------------------------------------
-- Productos — Product en domain.ts
-- -----------------------------------------------------------------------------

create table products_cafexis (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses_cafexis (id) on delete cascade,
  name text not null,
  category text not null default 'Bebidas',
  price numeric(12, 2) not null,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_cafexis_business_id_idx on products_cafexis (business_id);
comment on table products_cafexis is 'Productos que vende el negocio: bebidas preparadas o café empacado.';

-- Receta de un producto — RecipeIngredient en domain.ts (tabla puente N:M
-- entre productos e inventario, con la cantidad usada de cada ingrediente).
create table product_recipe_items_cafexis (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products_cafexis (id) on delete cascade,
  inventory_item_id uuid not null references inventory_items_cafexis (id) on delete restrict,
  quantity numeric(12, 4) not null,
  unit text not null,
  created_at timestamptz not null default now(),
  unique (product_id, inventory_item_id)
);

create index product_recipe_items_cafexis_product_id_idx on product_recipe_items_cafexis (product_id);
comment on table product_recipe_items_cafexis is 'Ingredientes y cantidades que componen la receta de un producto (solo aplica a bebidas preparadas).';

-- -----------------------------------------------------------------------------
-- Trazabilidad del café — CoffeeLot en domain.ts
-- -----------------------------------------------------------------------------

create table coffee_lots_cafexis (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses_cafexis (id) on delete cascade,
  code text not null,
  variety text not null,
  process coffee_process_cafexis not null,
  origin_country text not null default 'Colombia',
  origin_region text not null,
  origin_farm text,
  story text,
  qr_url text,
  quantity_kg numeric(12, 2) not null default 0,
  harvest_year integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, code)
);

create index coffee_lots_cafexis_business_id_idx on coffee_lots_cafexis (business_id);
comment on table coffee_lots_cafexis is 'Lotes de café en grano/molido, con su origen (hasta la finca) y disponibilidad, compartibles con el cliente vía QR.';

-- -----------------------------------------------------------------------------
-- Proveedores — Supplier en domain.ts
-- Base compartida entre negocios (identificada por NIT), como pide el
-- documento de alcance: si un proveedor ya existe, se reutiliza.
-- -----------------------------------------------------------------------------

create table suppliers_cafexis (
  id uuid primary key default gen_random_uuid(),
  nit text not null unique,
  name text not null,
  location text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table suppliers_cafexis is 'Directorio de proveedores compartido entre todos los negocios de la plataforma, identificado por NIT.';

create table supplier_branches_cafexis (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers_cafexis (id) on delete cascade,
  branch_name text not null
);

create index supplier_branches_cafexis_supplier_id_idx on supplier_branches_cafexis (supplier_id);
comment on table supplier_branches_cafexis is 'Sucursales de un proveedor (para sugerir la más cercana al negocio en el futuro).';

-- Relación de qué proveedores usa cada negocio (un proveedor del directorio
-- compartido puede ser usado por varios negocios distintos).
create table business_suppliers_cafexis (
  business_id uuid not null references businesses_cafexis (id) on delete cascade,
  supplier_id uuid not null references suppliers_cafexis (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (business_id, supplier_id)
);

comment on table business_suppliers_cafexis is 'Qué proveedores del directorio compartido usa cada negocio.';

-- -----------------------------------------------------------------------------
-- Pedidos / ventas — Order en domain.ts
-- -----------------------------------------------------------------------------

create table orders_cafexis (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses_cafexis (id) on delete cascade,
  code text not null,
  customer_name text not null,
  table_or_reference text,
  total numeric(12, 2) not null default 0,
  status order_status_cafexis not null default 'pedido',
  payment_method payment_method_cafexis not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, code)
);

create index orders_cafexis_business_id_idx on orders_cafexis (business_id);
create index orders_cafexis_status_idx on orders_cafexis (business_id, status);
comment on table orders_cafexis is 'Pedidos/ventas de un negocio, con su estado (pedido, en preparación, listo, entregado).';

create table order_items_cafexis (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders_cafexis (id) on delete cascade,
  product_id uuid references products_cafexis (id) on delete set null,
  product_name text not null, -- snapshot: el nombre no cambia si el producto se edita/borra después
  quantity numeric(12, 2) not null,
  unit_price numeric(12, 2) not null
);

create index order_items_cafexis_order_id_idx on order_items_cafexis (order_id);
comment on table order_items_cafexis is 'Líneas de un pedido (producto, cantidad, precio unitario al momento de la venta).';

-- -----------------------------------------------------------------------------
-- Compras — PurchaseOrder en domain.ts
-- -----------------------------------------------------------------------------

create table purchase_orders_cafexis (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses_cafexis (id) on delete cascade,
  code text not null,
  supplier_id uuid not null references suppliers_cafexis (id) on delete restrict,
  origin purchase_order_origin_cafexis not null default 'manual',
  reason text,
  status purchase_order_status_cafexis not null default 'propuesta',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, code)
);

create index purchase_orders_cafexis_business_id_idx on purchase_orders_cafexis (business_id);
comment on table purchase_orders_cafexis is 'Órdenes de compra, incluyendo las propuestas automáticamente por bajo inventario.';

create table purchase_order_lines_cafexis (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders_cafexis (id) on delete cascade,
  inventory_item_id uuid not null references inventory_items_cafexis (id) on delete restrict,
  quantity numeric(12, 3) not null,
  unit text not null
);

create index purchase_order_lines_cafexis_po_id_idx on purchase_order_lines_cafexis (purchase_order_id);
comment on table purchase_order_lines_cafexis is 'Líneas de una orden de compra (insumo y cantidad a reponer).';

-- -----------------------------------------------------------------------------
-- Reportes personalizados — ReportDefinition en domain.ts
-- (Los reportes predefinidos del panel se calculan con consultas, no se
-- guardan como filas; esta tabla es para los reportes que el usuario arma.)
-- -----------------------------------------------------------------------------

create table custom_reports_cafexis (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses_cafexis (id) on delete cascade,
  created_by uuid references app_users_cafexis (id) on delete set null,
  name text not null,
  description text,
  config jsonb not null default '{}'::jsonb, -- filtros/columnas elegidas por el usuario
  created_at timestamptz not null default now()
);

create index custom_reports_cafexis_business_id_idx on custom_reports_cafexis (business_id);
comment on table custom_reports_cafexis is 'Reportes personalizados que un administrador arma seleccionando qué información consultar.';

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------

create or replace function set_updated_at_cafexis()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger businesses_cafexis_set_updated_at before update on businesses_cafexis
  for each row execute function set_updated_at_cafexis();
create trigger inventory_items_cafexis_set_updated_at before update on inventory_items_cafexis
  for each row execute function set_updated_at_cafexis();
create trigger products_cafexis_set_updated_at before update on products_cafexis
  for each row execute function set_updated_at_cafexis();
create trigger coffee_lots_cafexis_set_updated_at before update on coffee_lots_cafexis
  for each row execute function set_updated_at_cafexis();
create trigger suppliers_cafexis_set_updated_at before update on suppliers_cafexis
  for each row execute function set_updated_at_cafexis();
create trigger orders_cafexis_set_updated_at before update on orders_cafexis
  for each row execute function set_updated_at_cafexis();
create trigger purchase_orders_cafexis_set_updated_at before update on purchase_orders_cafexis
  for each row execute function set_updated_at_cafexis();

-- -----------------------------------------------------------------------------
-- Mantener sincronizado inventory_items_cafexis.status con quantity/threshold
-- (evita que el frontend tenga que calcularlo y que quede desincronizado).
-- -----------------------------------------------------------------------------

create or replace function sync_inventory_status_cafexis()
returns trigger
language plpgsql
as $$
begin
  if new.quantity <= 0 then
    new.status := 'agotado';
  elsif new.quantity <= new.low_stock_threshold then
    new.status := 'bajo';
  else
    new.status := 'ok';
  end if;
  return new;
end;
$$;

create trigger inventory_items_cafexis_sync_status
  before insert or update of quantity, low_stock_threshold on inventory_items_cafexis
  for each row execute function sync_inventory_status_cafexis();
