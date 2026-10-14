-- =============================================================================
-- Cafexis · Fase 5 — Cliente final (web)
--
--   1. businesses_cafexis.slug: URL pública fija por negocio (/c/:slug),
--      imprimible como QR desde Configuración, que nunca expira.
--   2. customers_cafexis: perfil del cliente final, 1:1 con auth.users igual
--      que app_users_cafexis pero SIN business_id fijo — un cliente puede
--      estar vinculado a varios negocios (relación N:M), a diferencia de un
--      empleado interno que pertenece a uno solo.
--   3. customer_businesses_cafexis: el vínculo N:M en sí. Se crea al
--      visitar /c/:slug ya logueado (o justo después de loguearse).
--   4. orders_cafexis.customer_id: liga un pedido público al cliente que lo
--      hizo, para poder mostrarle su propio historial.
--   5. Acceso público/de cliente vía funciones security definer (no se abre
--      RLS directo de anon sobre las tablas de negocio: evitaría filtrar
--      columnas internas y complicaría las políticas ya existentes).
--   6. RPC register_public_order_cafexis / list_my_orders_cafexis: el
--      pedido y el historial del cliente autenticado.
--
-- Requiere 0001-0008 aplicadas. No depende de 0009 (Fase 4, en curso en
-- paralelo) ni la modifica.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Slug público del negocio
-- -----------------------------------------------------------------------------

alter table businesses_cafexis add column slug text unique;

comment on column businesses_cafexis.slug is 'Identificador en la URL pública del negocio (/c/:slug). Se genera del nombre al crear el negocio; único en toda la plataforma.';

-- unaccent requiere la extensión del mismo nombre (quita tildes/diéresis);
-- se crea antes de la función que la usa.
create extension if not exists unaccent;

create or replace function slugify_cafexis(p_text text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(unaccent(p_text)), '[^a-z0-9]+', '-', 'g'));
$$;

-- Backfill: slug único para los negocios ya existentes (añade sufijo numérico en colisión).
do $$
declare
  r record;
  v_base text;
  v_slug text;
  v_n integer;
begin
  for r in select id, name from businesses_cafexis where slug is null order by created_at loop
    v_base := coalesce(nullif(slugify_cafexis(r.name), ''), 'negocio');
    v_slug := v_base;
    v_n := 1;
    while exists (select 1 from businesses_cafexis where slug = v_slug) loop
      v_n := v_n + 1;
      v_slug := v_base || '-' || v_n;
    end loop;
    update businesses_cafexis set slug = v_slug where id = r.id;
  end loop;
end $$;

alter table businesses_cafexis alter column slug set not null;

-- Autogenera el slug para negocios creados después de esta migración (el
-- frontend de registro no lo envía explícitamente, igual que no envía id).
create or replace function set_business_slug_cafexis()
returns trigger
language plpgsql
as $$
declare
  v_base text;
  v_slug text;
  v_n integer := 1;
begin
  if new.slug is not null and new.slug <> '' then
    return new;
  end if;

  v_base := coalesce(nullif(slugify_cafexis(new.name), ''), 'negocio');
  v_slug := v_base;
  while exists (select 1 from businesses_cafexis where slug = v_slug and id <> new.id) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  new.slug := v_slug;
  return new;
end;
$$;

create trigger businesses_cafexis_set_slug
  before insert on businesses_cafexis
  for each row execute function set_business_slug_cafexis();

-- -----------------------------------------------------------------------------
-- 2. Clientes finales (separados de app_users_cafexis a propósito: mezclar
-- clientes con empleados complicaría cada policy existente, y el rol
-- 'cliente' del enum ya estaba pensado como algo distinto de los 3 roles
-- internos).
-- -----------------------------------------------------------------------------

create table customers_cafexis (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  created_at timestamptz not null default now()
);

comment on table customers_cafexis is 'Perfil del cliente final (login con Google), sin negocio fijo: puede estar vinculado a varios negocios, ver customer_businesses_cafexis.';

alter table customers_cafexis enable row level security;

create policy customers_cafexis_select on customers_cafexis
  for select using (id = auth.uid());

create policy customers_cafexis_insert on customers_cafexis
  for insert with check (id = auth.uid());

create policy customers_cafexis_update on customers_cafexis
  for update using (id = auth.uid());

-- -----------------------------------------------------------------------------
-- 3. Vínculo cliente ↔ negocio (N:M)
-- -----------------------------------------------------------------------------

create table customer_businesses_cafexis (
  customer_id uuid not null references customers_cafexis (id) on delete cascade,
  business_id uuid not null references businesses_cafexis (id) on delete cascade,
  linked_at timestamptz not null default now(),
  primary key (customer_id, business_id)
);

comment on table customer_businesses_cafexis is 'Qué negocios ha visitado/vinculado cada cliente final, para la pantalla "Mis negocios" y para autorizar sus pedidos.';

alter table customer_businesses_cafexis enable row level security;

create policy customer_businesses_cafexis_select on customer_businesses_cafexis
  for select using (customer_id = auth.uid());

create policy customer_businesses_cafexis_insert on customer_businesses_cafexis
  for insert with check (customer_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 4. Pedido ligado al cliente que lo hizo (los del punto de venta interno
-- siguen sin customer_id: lo crea el POS del empleado, no el cliente).
-- -----------------------------------------------------------------------------

alter table orders_cafexis add column customer_id uuid references customers_cafexis (id) on delete set null;

comment on column orders_cafexis.customer_id is 'Cliente final que hizo el pedido desde /c/:slug (vacío en ventas registradas por un empleado desde el punto de venta interno).';

create index orders_cafexis_customer_id_idx on orders_cafexis (customer_id);

-- -----------------------------------------------------------------------------
-- 5. Lectura pública (sin sesión): negocio por slug, catálogo, lote.
-- No se abre RLS de anon sobre las tablas completas (filtraría columnas
-- internas sin querer); cada función security definer expone solo lo que
-- un visitante sin cuenta debe ver.
-- -----------------------------------------------------------------------------

create or replace function get_public_business_cafexis(p_slug text)
returns table (id uuid, name text, type business_type_cafexis, primary_color text, logo_url text, slug text)
language sql
stable
security definer
set search_path = public
as $$
  select id, name, type, primary_color, logo_url, slug
  from businesses_cafexis
  where slug = p_slug;
$$;

create or replace function get_public_catalog_cafexis(p_business_id uuid)
returns table (id uuid, name text, category text, price numeric, image_url text)
language sql
stable
security definer
set search_path = public
as $$
  select id, name, category, price, image_url
  from products_cafexis
  where business_id = p_business_id
  order by category, name;
$$;

create or replace function get_public_coffee_lot_cafexis(p_lot_id uuid)
returns table (
  id uuid, business_id uuid, business_name text, code text, variety text, process coffee_process_cafexis,
  origin_country text, origin_region text, origin_farm text, story text, quantity_kg numeric, harvest_year integer
)
language sql
stable
security definer
set search_path = public
as $$
  select l.id, l.business_id, b.name, l.code, l.variety, l.process,
    l.origin_country, l.origin_region, l.origin_farm, l.story, l.quantity_kg, l.harvest_year
  from coffee_lots_cafexis l
  join businesses_cafexis b on b.id = l.business_id
  where l.id = p_lot_id;
$$;

revoke execute on function get_public_business_cafexis(text) from public;
revoke execute on function get_public_catalog_cafexis(uuid) from public;
revoke execute on function get_public_coffee_lot_cafexis(uuid) from public;
grant execute on function get_public_business_cafexis(text) to anon, authenticated;
grant execute on function get_public_catalog_cafexis(uuid) to anon, authenticated;
grant execute on function get_public_coffee_lot_cafexis(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. Pedido del cliente final e historial (exige login: anon puro no puede
-- llamarlas, coherente con "ver el catálogo es público, pedir no").
-- -----------------------------------------------------------------------------

-- Vincula al cliente autenticado con un negocio (upsert idempotente: se
-- llama cada vez que visita /c/:slug, sin duplicar el vínculo).
--
-- security definer: la policy de select de businesses_cafexis (0002) exige
-- ser empleado de ese negocio o supervisor, que un cliente final nunca es;
-- sin esto, "not exists" sería siempre true para cualquier cliente y la
-- función rechazaría negocios que sí existen.
create or replace function link_customer_to_business_cafexis(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  if not exists (select 1 from businesses_cafexis where id = p_business_id) then
    raise exception 'Negocio no encontrado.';
  end if;

  insert into customer_businesses_cafexis (customer_id, business_id)
  values (auth.uid(), p_business_id)
  on conflict (customer_id, business_id) do nothing;
end;
$$;

-- p_items: [{"product_id": "<uuid>", "quantity": 2}, ...]. Mismo patrón que
-- register_sale_cafexis (0006/0008): precios de products_cafexis, nunca del
-- cliente; descuenta inventario con el mismo trigger ya existente. Exige
-- que el cliente ya esté vinculado al negocio (link_customer_to_business_cafexis).
--
-- security definer (a diferencia de register_sale_cafexis, que es invoker):
-- un cliente final no tiene fila en app_users_cafexis, así que RLS normal de
-- products_cafexis/orders_cafexis no lo dejaría ni leer el producto que
-- quiere comprar. La función valida la autorización ella misma (login +
-- vínculo cliente-negocio) en vez de depender de las policies del invocador.
create or replace function register_public_order_cafexis(
  p_business_id uuid,
  p_items jsonb,
  p_payment_method payment_method_cafexis,
  p_table_or_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer customers_cafexis%rowtype;
  v_order_id uuid;
  v_next integer;
  v_item jsonb;
  v_product products_cafexis%rowtype;
  v_quantity numeric;
  v_total numeric := 0;
begin
  select * into v_customer from customers_cafexis where id = auth.uid();
  if not found then
    raise exception 'Debes iniciar sesión para hacer un pedido.';
  end if;

  if not exists (
    select 1 from customer_businesses_cafexis
    where customer_id = auth.uid() and business_id = p_business_id
  ) then
    raise exception 'Primero debes vincularte a este negocio (escanea su código QR o visita su link).';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido debe incluir al menos un producto.';
  end if;

  perform pg_advisory_xact_lock(hashtext('orders_cafexis:' || p_business_id::text));
  select coalesce(max(substring(code from '^V-(\d+)$')::integer), 0) + 1
  into v_next
  from orders_cafexis
  where business_id = p_business_id and code ~ '^V-\d+$';

  insert into orders_cafexis (business_id, code, customer_id, customer_name, table_or_reference, payment_method)
  values (
    p_business_id,
    'V-' || lpad(v_next::text, 4, '0'),
    v_customer.id,
    v_customer.name,
    nullif(trim(p_table_or_reference), ''),
    p_payment_method
  )
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity := (v_item ->> 'quantity')::numeric;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Cada producto del pedido debe tener una cantidad mayor a cero.';
    end if;

    select * into v_product
    from products_cafexis
    where id = (v_item ->> 'product_id')::uuid and business_id = p_business_id;
    if not found then
      raise exception 'Uno de los productos del pedido ya no existe.';
    end if;

    -- El trigger order_items_cafexis_discount_inventory (0006) descuenta el stock aquí.
    insert into order_items_cafexis (order_id, product_id, product_name, quantity, unit_price)
    values (v_order_id, v_product.id, v_product.name, v_quantity, v_product.price);

    v_total := v_total + v_quantity * v_product.price;
  end loop;

  update orders_cafexis set total = v_total where id = v_order_id;
  return v_order_id;
end;
$$;

-- Pedidos del cliente autenticado en un negocio dado (para su historial).
create or replace function list_my_orders_cafexis(p_business_id uuid)
returns setof orders_cafexis
language sql
stable
security invoker
set search_path = public
as $$
  select * from orders_cafexis
  where business_id = p_business_id and customer_id = auth.uid()
  order by created_at desc;
$$;

revoke execute on function link_customer_to_business_cafexis(uuid) from public, anon;
revoke execute on function register_public_order_cafexis(uuid, jsonb, payment_method_cafexis, text) from public, anon;
revoke execute on function list_my_orders_cafexis(uuid) from public, anon;
grant execute on function link_customer_to_business_cafexis(uuid) to authenticated;
grant execute on function register_public_order_cafexis(uuid, jsonb, payment_method_cafexis, text) to authenticated;
grant execute on function list_my_orders_cafexis(uuid) to authenticated;

-- orders_cafexis/order_items_cafexis ya tienen sus policies (0002_rls_cafexis.sql)
-- basadas en auth_business_id_cafexis()/auth_is_supervisor_cafexis(), que un
-- cliente final no cumple (no tiene fila en app_users_cafexis). Estas
-- policies cubren su select de list_my_orders_cafexis (security invoker) y
-- quedan como defensa en profundidad por si algo distinto de
-- register_public_order_cafexis (security definer) intenta insertar.

create policy orders_cafexis_customer_select on orders_cafexis
  for select using (customer_id = auth.uid());

create policy orders_cafexis_customer_insert on orders_cafexis
  for insert with check (
    customer_id = auth.uid()
    and exists (
      select 1 from customer_businesses_cafexis cb
      where cb.customer_id = auth.uid() and cb.business_id = orders_cafexis.business_id
    )
  );

create policy order_items_cafexis_customer_select on order_items_cafexis
  for select using (
    exists (
      select 1 from orders_cafexis o
      where o.id = order_items_cafexis.order_id and o.customer_id = auth.uid()
    )
  );

create policy order_items_cafexis_customer_insert on order_items_cafexis
  for insert with check (
    exists (
      select 1 from orders_cafexis o
      where o.id = order_items_cafexis.order_id and o.customer_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
