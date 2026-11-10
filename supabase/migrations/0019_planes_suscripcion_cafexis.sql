-- =============================================================================
-- Cafexis · Planes de suscripción: Básica, Profesional y Premium
--
--   1. Catálogo de planes: cada plan guarda sus funciones (features) y sus
--      límites (limits). El plan único "Básico" de la 0012 pasa a ser
--      "Básica" (mismo id) y se agregan Profesional y Premium.
--   2. Plan efectivo: si la prueba o el período pagado siguen vigentes,
--      manda el plan contratado; si no, el negocio baja a Básica. Ya no se
--      bloquea el acceso al vencer: solo una cuenta "cancelada" queda fuera.
--   3. Verificación en el servidor (no solo en pantalla, que se puede
--      saltar): plan_permite_cafexis() y plan_limite_cafexis() se revisan en
--      triggers y en las RPC públicas del catálogo.
--   4. Negocios existentes: los que estaban en prueba o activos pasan a
--      Premium para no perder nada de lo que ya usan; el negocio demo queda
--      en Premium activo sin vencimiento.
--
-- Funciones por plan (claves de `features`):
--   Profesional y Premium: pedidos_cliente, compras, lotes, reportes,
--     dashboard_mas_vendidos, guias_equipo, color_marca
--   Solo Premium: trazabilidad_publica, guias_cliente,
--     reportes_personalizados, pagos_en_linea, factura_dian
--   factura_dian también se vende como complemento de Profesional:
--     business_subscriptions_cafexis.addons = '{factura_dian}'.
--
-- Límites (claves de `limits`; si la clave no está, no hay límite):
--   Básica: usuarios 2, productos 20, insumos 30, historial_dias 30
--   Profesional: usuarios 6
--
-- Lo que pasa del límite al bajar de plan no se borra: sigue visible y se
-- sigue vendiendo, pero no se pueden crear más registros hasta subir.
--
-- Requiere 0001-0018 aplicadas (recrea la RPC pública de guías de la 0018).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Catálogo de planes
-- -----------------------------------------------------------------------------

alter table subscription_plans_cafexis
  add column if not exists code text,
  add column if not exists description text,
  add column if not exists price_annual_cents integer not null default 0 check (price_annual_cents >= 0),
  add column if not exists features text[] not null default '{}',
  add column if not exists limits jsonb not null default '{}'::jsonb,
  add column if not exists recommended boolean not null default false,
  add column if not exists sort_order integer not null default 0;

create unique index if not exists subscription_plans_cafexis_code_idx on subscription_plans_cafexis (code);

comment on column subscription_plans_cafexis.code is 'Identificador estable del plan (basica, profesional, premium). El nombre se puede cambiar; el código no.';
comment on column subscription_plans_cafexis.price_cents is 'Precio mensual en centavos de peso (7990000 = $ 79.900).';
comment on column subscription_plans_cafexis.price_annual_cents is 'Precio anual en centavos de peso.';
comment on column subscription_plans_cafexis.features is 'Funciones que activa el plan. Ver plan_permite_cafexis().';
comment on column subscription_plans_cafexis.limits is 'Topes del plan, ej. {"usuarios": 2, "productos": 20}. Sin la clave, no hay límite. Ver plan_limite_cafexis().';

-- El "Básico" de la 0012 se convierte en "Básica" sin cambiar su id, así que
-- las suscripciones que apuntan a él no se tocan.
update subscription_plans_cafexis
set code = 'basica', name = 'Básica'
where name = 'Básico' and code is null;

insert into subscription_plans_cafexis
  (code, name, description, price_cents, price_annual_cents, billing_period, trial_days, features, limits, recommended, sort_order, active)
values
  (
    'basica', 'Básica', 'Para empezar a vender',
    0, 0, 'mensual', 0,
    '{}',
    '{"usuarios": 2, "productos": 20, "insumos": 30, "historial_dias": 30}',
    false, 1, true
  ),
  (
    'profesional', 'Profesional', 'Para operar todo el día a día',
    7990000, 79900000, 'mensual', 14,
    array['pedidos_cliente', 'compras', 'lotes', 'reportes', 'dashboard_mas_vendidos', 'guias_equipo', 'color_marca'],
    '{"usuarios": 6}',
    true, 2, true
  ),
  (
    'premium', 'Premium', 'Para crecer y diferenciarte',
    14990000, 149900000, 'mensual', 14,
    array[
      'pedidos_cliente', 'compras', 'lotes', 'reportes', 'dashboard_mas_vendidos', 'guias_equipo', 'color_marca',
      'trazabilidad_publica', 'guias_cliente', 'reportes_personalizados', 'pagos_en_linea', 'factura_dian'
    ],
    '{}',
    false, 3, true
  )
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  price_cents = excluded.price_cents,
  price_annual_cents = excluded.price_annual_cents,
  trial_days = excluded.trial_days,
  features = excluded.features,
  limits = excluded.limits,
  recommended = excluded.recommended,
  sort_order = excluded.sort_order,
  active = excluded.active;

-- Complementos contratados aparte del plan (por ahora solo factura_dian en
-- Profesional). Solo cuentan mientras la suscripción esté vigente.
alter table business_subscriptions_cafexis
  add column if not exists addons text[] not null default '{}';

comment on column business_subscriptions_cafexis.addons is 'Funciones contratadas aparte del plan, ej. {factura_dian}. Solo aplican con la suscripción vigente.';

-- -----------------------------------------------------------------------------
-- 2. Negocios existentes y negocios nuevos
-- -----------------------------------------------------------------------------

-- Quien ya operaba (prueba o activa) tenía todo el sistema: pasa a Premium
-- para no perder nada. El supervisor técnico le asigna después su plan real.
update business_subscriptions_cafexis
set plan_id = (select id from subscription_plans_cafexis where code = 'premium')
where status in ('trial', 'activa');

-- Negocio demo ("Mi Cafetería"): Premium activo, sin vencimiento, para
-- mostrar el sistema completo.
insert into business_subscriptions_cafexis (business_id, plan_id, status, trial_ends_at, current_period_ends_at)
select b.id, p.id, 'activa', null, null
from businesses_cafexis b
cross join subscription_plans_cafexis p
where b.id = '11111111-1111-1111-1111-111111111111' and p.code = 'premium'
on conflict (business_id) do update set
  plan_id = excluded.plan_id,
  status = 'activa',
  trial_ends_at = null,
  current_period_ends_at = null;

-- Todo negocio nuevo prueba Premium (el plan completo) durante sus días de
-- prueba; al terminar, baja solo a Básica (ver business_plan_code_cafexis).
create or replace function start_business_trial_cafexis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan subscription_plans_cafexis;
begin
  select * into v_plan from subscription_plans_cafexis where code = 'premium' and active;
  if not found then
    select * into v_plan from subscription_plans_cafexis where active order by sort_order, created_at limit 1;
  end if;
  if v_plan.id is null then
    return new;
  end if;

  insert into business_subscriptions_cafexis (business_id, plan_id, status, trial_ends_at)
  values (new.id, v_plan.id, 'trial', now() + make_interval(days => v_plan.trial_days))
  on conflict (business_id) do nothing;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Plan efectivo, funciones y límites
-- -----------------------------------------------------------------------------

-- ¿La prueba o el período pagado siguen vigentes?
create or replace function subscription_is_current_cafexis(
  p_status subscription_status_cafexis,
  p_trial_ends_at timestamptz,
  p_period_ends_at timestamptz
)
returns boolean
language sql
stable
set search_path = public
as $$
  select (p_status = 'trial' and (p_trial_ends_at is null or p_trial_ends_at > now()))
    or (p_status = 'activa' and (p_period_ends_at is null or p_period_ends_at > now()));
$$;

-- Código del plan con el que opera el negocio ahora mismo: el contratado si
-- está vigente; si no (prueba terminada, período vencido, cancelado o sin
-- suscripción), Básica.
create or replace function business_plan_code_cafexis(p_business_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  select p.code into v_code
  from business_subscriptions_cafexis s
  join subscription_plans_cafexis p on p.id = s.plan_id
  where s.business_id = p_business_id
    and subscription_is_current_cafexis(s.status, s.trial_ends_at, s.current_period_ends_at);

  return coalesce(v_code, 'basica');
end;
$$;

-- Funciones activas del negocio: las de su plan efectivo más los
-- complementos, si la suscripción está vigente.
create or replace function business_plan_features_cafexis(p_business_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.features from subscription_plans_cafexis p where p.code = business_plan_code_cafexis(p_business_id)),
    '{}'::text[]
  ) || coalesce(
    (
      select s.addons from business_subscriptions_cafexis s
      where s.business_id = p_business_id
        and subscription_is_current_cafexis(s.status, s.trial_ends_at, s.current_period_ends_at)
    ),
    '{}'::text[]
  );
$$;

-- true si el plan del negocio incluye la función (ver claves arriba).
create or replace function plan_permite_cafexis(p_business_id uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_feature = any (business_plan_features_cafexis(p_business_id));
$$;

-- Tope del plan efectivo para un recurso, o null si no tiene límite.
create or replace function plan_limite_cafexis(p_business_id uuid, p_limit text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select (p.limits ->> p_limit)::integer
  from subscription_plans_cafexis p
  where p.code = business_plan_code_cafexis(p_business_id);
$$;

-- Usuarios del equipo que cuentan para el límite: administradores y
-- baristas activos más las invitaciones pendientes. El equipo de plataforma
-- (supervisor técnico, soporte) no cuenta.
create or replace function business_team_size_cafexis(p_business_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select (
    (select count(*) from app_users_cafexis
      where business_id = p_business_id and active and role in ('administrador', 'barista'))
    + (select count(*) from user_invitations_cafexis
      where business_id = p_business_id and status = 'pendiente' and role in ('administrador', 'barista'))
  )::integer;
$$;

-- Antes: "¿la suscripción está vigente?" (y si no, se bloqueaba todo). Desde
-- esta migración un negocio sin pagar sigue operando en Básica, así que solo
-- una cuenta cancelada (decisión del supervisor técnico) queda bloqueada.
-- Se conserva el nombre porque lo usan RLS y RPC de 0012, 0013, 0014 y 0018.
create or replace function is_business_subscription_active_cafexis(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from business_subscriptions_cafexis s
    where s.business_id = p_business_id and s.status <> 'cancelada'
  );
$$;

-- Plan del negocio para el panel: contratado, efectivo, funciones, límites
-- y uso actual. El personal ve el de su negocio; el equipo de plataforma,
-- el de cualquiera (el supervisor lo usa al operar otro negocio).
create or replace function get_business_plan_cafexis(p_business_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_own uuid := auth_business_id_cafexis();
  v_business_id uuid := coalesce(p_business_id, v_own);
  v_sub business_subscriptions_cafexis%rowtype;
  v_plan subscription_plans_cafexis%rowtype;
  v_effective subscription_plans_cafexis%rowtype;
begin
  if v_business_id is null then
    raise exception 'No hay un negocio asociado a la sesión activa.';
  end if;
  if v_business_id is distinct from v_own and not auth_is_platform_staff_cafexis() then
    raise exception 'No tienes permiso para ver el plan de ese negocio.';
  end if;

  select * into v_sub from business_subscriptions_cafexis where business_id = v_business_id;
  select * into v_plan from subscription_plans_cafexis where id = v_sub.plan_id;
  select * into v_effective from subscription_plans_cafexis where code = business_plan_code_cafexis(v_business_id);

  return jsonb_build_object(
    'business_id', v_business_id,
    'status', v_sub.status,
    'trial_ends_at', v_sub.trial_ends_at,
    'current_period_ends_at', v_sub.current_period_ends_at,
    'plan_code', coalesce(v_plan.code, 'basica'),
    'plan_name', coalesce(v_plan.name, 'Básica'),
    'effective_plan_code', coalesce(v_effective.code, 'basica'),
    'effective_plan_name', coalesce(v_effective.name, 'Básica'),
    'features', to_jsonb(business_plan_features_cafexis(v_business_id)),
    'limits', coalesce(v_effective.limits, '{}'::jsonb),
    'addons', to_jsonb(coalesce(v_sub.addons, '{}'::text[])),
    'usage', jsonb_build_object(
      'usuarios', business_team_size_cafexis(v_business_id),
      'productos', (select count(*) from products_cafexis where business_id = v_business_id),
      'insumos', (select count(*) from inventory_items_cafexis where business_id = v_business_id)
    )
  );
end;
$$;

-- Funciones activas de un negocio para el catálogo público (/c/:slug): solo
-- la lista de claves, nada sensible. La usa el catálogo para mostrarse como
-- menú o con carrito.
create or replace function get_public_plan_features_cafexis(p_business_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from businesses_cafexis where id = p_business_id)
      then business_plan_features_cafexis(p_business_id)
    else '{}'::text[]
  end;
$$;

revoke execute on function subscription_is_current_cafexis(subscription_status_cafexis, timestamptz, timestamptz) from public, anon;
revoke execute on function business_plan_code_cafexis(uuid) from public, anon;
revoke execute on function business_plan_features_cafexis(uuid) from public, anon;
revoke execute on function plan_permite_cafexis(uuid, text) from public, anon;
revoke execute on function plan_limite_cafexis(uuid, text) from public, anon;
revoke execute on function business_team_size_cafexis(uuid) from public, anon, authenticated;
revoke execute on function get_business_plan_cafexis(uuid) from public, anon;
revoke execute on function get_public_plan_features_cafexis(uuid) from public;

grant execute on function subscription_is_current_cafexis(subscription_status_cafexis, timestamptz, timestamptz) to authenticated;
grant execute on function business_plan_code_cafexis(uuid) to authenticated;
grant execute on function business_plan_features_cafexis(uuid) to authenticated;
grant execute on function plan_permite_cafexis(uuid, text) to authenticated;
grant execute on function plan_limite_cafexis(uuid, text) to authenticated;
grant execute on function get_business_plan_cafexis(uuid) to authenticated;
grant execute on function get_public_plan_features_cafexis(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Verificación en el servidor
-- -----------------------------------------------------------------------------

-- Función de pago: el registro se inserta solo si el plan del negocio la
-- incluye. tg_argv[0] = clave de la función, tg_argv[1] = mensaje.
create or replace function guard_plan_feature_cafexis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not plan_permite_cafexis(new.business_id, tg_argv[0]) then
    raise exception '%', tg_argv[1];
  end if;
  return new;
end;
$$;

drop trigger if exists purchase_orders_cafexis_guard_plan on purchase_orders_cafexis;
create trigger purchase_orders_cafexis_guard_plan
  before insert on purchase_orders_cafexis
  for each row execute function guard_plan_feature_cafexis(
    'compras', 'Las compras y los proveedores están disponibles desde el plan Profesional.');

drop trigger if exists business_suppliers_cafexis_guard_plan on business_suppliers_cafexis;
create trigger business_suppliers_cafexis_guard_plan
  before insert on business_suppliers_cafexis
  for each row execute function guard_plan_feature_cafexis(
    'compras', 'Las compras y los proveedores están disponibles desde el plan Profesional.');

drop trigger if exists coffee_lots_cafexis_guard_plan on coffee_lots_cafexis;
create trigger coffee_lots_cafexis_guard_plan
  before insert on coffee_lots_cafexis
  for each row execute function guard_plan_feature_cafexis(
    'lotes', 'Los lotes de café están disponibles desde el plan Profesional.');

drop trigger if exists product_guides_cafexis_guard_plan on product_guides_cafexis;
create trigger product_guides_cafexis_guard_plan
  before insert on product_guides_cafexis
  for each row execute function guard_plan_feature_cafexis(
    'guias_equipo', 'Las guías de preparación están disponibles desde el plan Profesional.');

drop trigger if exists custom_reports_cafexis_guard_plan on custom_reports_cafexis;
create trigger custom_reports_cafexis_guard_plan
  before insert on custom_reports_cafexis
  for each row execute function guard_plan_feature_cafexis(
    'reportes_personalizados', 'Los reportes personalizados están disponibles en el plan Premium.');

drop trigger if exists invoices_cafexis_guard_plan on invoices_cafexis;
create trigger invoices_cafexis_guard_plan
  before insert on invoices_cafexis
  for each row execute function guard_plan_feature_cafexis(
    'factura_dian', 'La factura electrónica está disponible en Premium o como complemento de Profesional.');

-- Pedido desde el celular del cliente (los del punto de venta no llevan
-- customer_id): solo si el plan lo incluye.
create or replace function guard_plan_customer_order_cafexis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.customer_id is not null and not plan_permite_cafexis(new.business_id, 'pedidos_cliente') then
    raise exception 'Este negocio todavía no recibe pedidos desde el celular. Haz tu pedido en la barra.';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_cafexis_guard_plan on orders_cafexis;
create trigger orders_cafexis_guard_plan
  before insert on orders_cafexis
  for each row execute function guard_plan_customer_order_cafexis();

-- Topes de productos e insumos. tg_argv[0] = clave del límite,
-- tg_argv[1] = nombre en plural para el mensaje.
create or replace function guard_plan_limit_cafexis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_count integer;
begin
  v_limit := plan_limite_cafexis(new.business_id, tg_argv[0]);
  if v_limit is null then
    return new;
  end if;

  -- Dos altas simultáneas no deben pasarse juntas del tope.
  perform pg_advisory_xact_lock(hashtext(tg_table_name || ':' || new.business_id::text));
  execute format('select count(*) from %I where business_id = $1', tg_table_name)
    into v_count using new.business_id;

  if v_count >= v_limit then
    raise exception 'Tu plan % permite hasta % %. Sube de plan en Suscripción para agregar más.',
      (select name from subscription_plans_cafexis where code = business_plan_code_cafexis(new.business_id)),
      v_limit, tg_argv[1];
  end if;
  return new;
end;
$$;

drop trigger if exists products_cafexis_guard_plan_limit on products_cafexis;
create trigger products_cafexis_guard_plan_limit
  before insert on products_cafexis
  for each row execute function guard_plan_limit_cafexis('productos', 'productos');

drop trigger if exists inventory_items_cafexis_guard_plan_limit on inventory_items_cafexis;
create trigger inventory_items_cafexis_guard_plan_limit
  before insert on inventory_items_cafexis
  for each row execute function guard_plan_limit_cafexis('insumos', 'insumos');

-- Tope de usuarios del equipo: al invitar a alguien y al reactivar (o pasar
-- a administrador/barista) a un usuario que no contaba.
create or replace function guard_plan_team_size_cafexis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
begin
  if new.role not in ('administrador', 'barista') then
    return new;
  end if;

  if tg_table_name = 'app_users_cafexis' then
    if not new.active or (old.active and old.role in ('administrador', 'barista')) then
      return new;
    end if;
  end if;

  v_limit := plan_limite_cafexis(new.business_id, 'usuarios');
  if v_limit is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('team:' || new.business_id::text));
  if business_team_size_cafexis(new.business_id) >= v_limit then
    raise exception 'Tu plan % permite hasta % usuarios del equipo. Sube de plan en Suscripción o desactiva a alguien.',
      (select name from subscription_plans_cafexis where code = business_plan_code_cafexis(new.business_id)),
      v_limit;
  end if;
  return new;
end;
$$;

drop trigger if exists user_invitations_cafexis_guard_plan on user_invitations_cafexis;
create trigger user_invitations_cafexis_guard_plan
  before insert on user_invitations_cafexis
  for each row execute function guard_plan_team_size_cafexis();

drop trigger if exists app_users_cafexis_guard_plan on app_users_cafexis;
create trigger app_users_cafexis_guard_plan
  before update of active, role on app_users_cafexis
  for each row execute function guard_plan_team_size_cafexis();

-- Color de marca propio: desde Profesional. Al bajar de plan el color
-- guardado no se borra; el panel y el catálogo vuelven al de Cafexis.
create or replace function guard_plan_brand_color_cafexis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.primary_color is distinct from old.primary_color and not plan_permite_cafexis(new.id, 'color_marca') then
    raise exception 'El color de marca propio está disponible desde el plan Profesional.';
  end if;
  return new;
end;
$$;

drop trigger if exists businesses_cafexis_guard_plan_color on businesses_cafexis;
create trigger businesses_cafexis_guard_plan_color
  before update of primary_color on businesses_cafexis
  for each row execute function guard_plan_brand_color_cafexis();

-- Las propuestas de compra automáticas (0006) nacen cuando una venta deja un
-- insumo bajo. Sin "compras" en el plan no se generan: el trigger de arriba
-- haría fallar la venta entera.
create or replace function propose_purchase_on_low_stock_cafexis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'ok' and new.quantity < old.quantity and plan_permite_cafexis(new.business_id, 'compras') then
    perform propose_purchase_for_item_cafexis(new.id);
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. RPC públicas según el plan (mismas firmas que 0010 y 0018)
-- -----------------------------------------------------------------------------

-- Sin color_marca, el catálogo muestra el color de Cafexis.
create or replace function get_public_business_cafexis(p_slug text)
returns table (id uuid, name text, type business_type_cafexis, primary_color text, logo_url text, slug text)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.name, b.type,
    case when plan_permite_cafexis(b.id, 'color_marca') then b.primary_color else '#D85A30' end,
    b.logo_url, b.slug
  from businesses_cafexis b
  where b.slug = p_slug;
$$;

-- La página pública del lote (QR del empaque) es de Premium.
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
  where l.id = p_lot_id
    and plan_permite_cafexis(l.business_id, 'trazabilidad_publica');
$$;

-- "Cómo se prepara" en el catálogo es de Premium.
create or replace function get_public_product_guides_cafexis(p_business_id uuid)
returns table (
  id uuid, product_id uuid, title text, description text, kind text, storage_path text, external_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, g.product_id, g.title, g.description, g.kind, g.storage_path, g.external_url
  from product_guides_cafexis g
  where g.business_id = p_business_id
    and g.visible_to_customers
    and plan_permite_cafexis(p_business_id, 'guias_cliente')
  order by g.created_at;
$$;

create or replace function is_public_product_guide_object_cafexis(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from product_guides_cafexis g
    where g.storage_path = p_name
      and g.visible_to_customers
      and plan_permite_cafexis(g.business_id, 'guias_cliente')
  );
$$;

notify pgrst, 'reload schema';
