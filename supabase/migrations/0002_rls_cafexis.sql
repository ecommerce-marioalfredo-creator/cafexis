-- =============================================================================
-- Cafexis · Row Level Security (multi-tenant por negocio)
--
-- Regla general: un usuario autenticado (auth.uid()) solo puede leer/escribir
-- filas cuyo business_id coincida con el business_id de su propio perfil en
-- app_users_cafexis. El rol 'supervisor_tecnico' puede ver todos los negocios
-- (soporte de plataforma), según la sección 4 del documento de alcance.
-- =============================================================================

-- Helper: negocio del usuario autenticado actual.
create or replace function auth_business_id_cafexis()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select business_id from app_users_cafexis where id = auth.uid();
$$;

-- Helper: ¿el usuario autenticado es supervisor técnico (acceso total)?
create or replace function auth_is_supervisor_cafexis()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from app_users_cafexis
    where id = auth.uid() and role = 'supervisor_tecnico'
  );
$$;

-- -----------------------------------------------------------------------------
-- businesses_cafexis: el usuario ve solo su propio negocio (o todos si es
-- supervisor técnico). Cualquier usuario autenticado puede crear un negocio
-- nuevo (flujo de registro); no se permite editar el negocio de alguien más.
-- -----------------------------------------------------------------------------

alter table businesses_cafexis enable row level security;

create policy businesses_cafexis_select on businesses_cafexis
  for select using (id = auth_business_id_cafexis() or auth_is_supervisor_cafexis());

create policy businesses_cafexis_insert on businesses_cafexis
  for insert with check (auth.uid() is not null);

create policy businesses_cafexis_update on businesses_cafexis
  for update using (id = auth_business_id_cafexis() or auth_is_supervisor_cafexis());

-- -----------------------------------------------------------------------------
-- app_users_cafexis: un usuario ve a los compañeros de su mismo negocio.
-- -----------------------------------------------------------------------------

alter table app_users_cafexis enable row level security;

create policy app_users_cafexis_select on app_users_cafexis
  for select using (business_id = auth_business_id_cafexis() or auth_is_supervisor_cafexis());

-- Nota de seguridad: esta política solo exige que el usuario se registre a
-- sí mismo (id = auth.uid()); no valida que business_id corresponda a un
-- negocio recién creado por él. Es una simplificación deliberada para no
-- complicar el flujo de registro en esta etapa. Si más adelante se necesita
-- cerrarlo del todo, conviene mover la creación de negocio + usuario a una
-- función RPC (security definer) que haga ambas inserciones de forma atómica.
create policy app_users_cafexis_insert on app_users_cafexis
  for insert with check (id = auth.uid());

create policy app_users_cafexis_update on app_users_cafexis
  for update using (business_id = auth_business_id_cafexis() or auth_is_supervisor_cafexis());

-- -----------------------------------------------------------------------------
-- Tablas simples con business_id directo: mismo patrón para todas.
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
  tables text[] := array[
    'inventory_items_cafexis',
    'products_cafexis',
    'coffee_lots_cafexis',
    'orders_cafexis',
    'purchase_orders_cafexis',
    'custom_reports_cafexis',
    'business_suppliers_cafexis'
  ];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security;', t);
    execute format(
      'create policy %I_select on %I for select using (business_id = auth_business_id_cafexis() or auth_is_supervisor_cafexis());',
      t, t
    );
    execute format(
      'create policy %I_insert on %I for insert with check (business_id = auth_business_id_cafexis());',
      t, t
    );
    execute format(
      'create policy %I_update on %I for update using (business_id = auth_business_id_cafexis());',
      t, t
    );
    execute format(
      'create policy %I_delete on %I for delete using (business_id = auth_business_id_cafexis());',
      t, t
    );
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Tablas hijas (sin business_id propio): se filtran a través de su padre.
-- -----------------------------------------------------------------------------

alter table product_recipe_items_cafexis enable row level security;

create policy product_recipe_items_cafexis_all on product_recipe_items_cafexis
  for all using (
    exists (
      select 1 from products_cafexis p
      where p.id = product_recipe_items_cafexis.product_id
        and (p.business_id = auth_business_id_cafexis() or auth_is_supervisor_cafexis())
    )
  );

alter table order_items_cafexis enable row level security;

create policy order_items_cafexis_all on order_items_cafexis
  for all using (
    exists (
      select 1 from orders_cafexis o
      where o.id = order_items_cafexis.order_id
        and (o.business_id = auth_business_id_cafexis() or auth_is_supervisor_cafexis())
    )
  );

alter table purchase_order_lines_cafexis enable row level security;

create policy purchase_order_lines_cafexis_all on purchase_order_lines_cafexis
  for all using (
    exists (
      select 1 from purchase_orders_cafexis po
      where po.id = purchase_order_lines_cafexis.purchase_order_id
        and (po.business_id = auth_business_id_cafexis() or auth_is_supervisor_cafexis())
    )
  );

-- -----------------------------------------------------------------------------
-- suppliers_cafexis / supplier_branches_cafexis: directorio COMPARTIDO entre
-- negocios (por diseño, según el documento de alcance). Cualquier usuario
-- autenticado puede leer y crear proveedores; no se permite editar/borrar
-- proveedores para no afectar a otros negocios que ya los usan.
-- -----------------------------------------------------------------------------

alter table suppliers_cafexis enable row level security;

create policy suppliers_cafexis_select on suppliers_cafexis
  for select using (auth.uid() is not null);

create policy suppliers_cafexis_insert on suppliers_cafexis
  for insert with check (auth.uid() is not null);

alter table supplier_branches_cafexis enable row level security;

create policy supplier_branches_cafexis_select on supplier_branches_cafexis
  for select using (auth.uid() is not null);

create policy supplier_branches_cafexis_insert on supplier_branches_cafexis
  for insert with check (auth.uid() is not null);
