-- =============================================================================
-- Cafexis · Fase 6 — Integraciones externas
--
--   1. Suscripciones: la única pieza sin dependencia de terceros. Todo
--      negocio nuevo nace en período de prueba (trial); el supervisor
--      técnico administra el estado de cada uno; el administrador del
--      negocio solo ve el suyo.
--   2. Pasarela de pagos (Wompi, referencia): el pedido PÚBLICO del cliente
--      final (/c/:slug) nace en 'pendiente_pago', no directo en 'pedido',
--      hasta que un webhook confirme el cobro. El punto de venta interno
--      del empleado NO cambia (sigue cobrando en efectivo/datáfono físico
--      y solo registrando el método, como desde la Fase 2).
--   3. Facturación electrónica DIAN (Factus, referencia): se genera a
--      pedido sobre una venta ya entregada, nunca automática.
--
-- Las credenciales de Wompi/Factus viven SOLO como secretos de las Edge
-- Functions correspondientes (supabase/functions/), nunca en esta
-- migración ni en el frontend — mismo patrón que invite-user (0004).
--
-- Requiere 0001-0010 aplicadas. Compatible con 0011 (Fase 7, en curso en
-- paralelo): usa auth_is_platform_staff_cafexis() si ya existe, con un
-- respaldo a auth_is_supervisor_cafexis() si esta migración se aplica
-- antes que la 0011.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Helper de compatibilidad con la Fase 7 (puede no estar aplicada aún)
-- -----------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_proc where proname = 'auth_is_platform_staff_cafexis'
  ) then
    execute $def$
      create function auth_is_platform_staff_cafexis()
      returns boolean
      language sql
      stable
      security definer
      set search_path = public
      as $body$
        select auth_is_supervisor_cafexis();
      $body$;
    $def$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. Suscripciones
-- -----------------------------------------------------------------------------

create type subscription_status_cafexis as enum ('trial', 'activa', 'vencida', 'cancelada');
create type billing_period_cafexis as enum ('mensual', 'anual');

create table subscription_plans_cafexis (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price_cents integer not null default 0 check (price_cents >= 0),
  billing_period billing_period_cafexis not null default 'mensual',
  trial_days integer not null default 14 check (trial_days >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table subscription_plans_cafexis is 'Planes de suscripción de la plataforma Cafexis (no de los negocios a sus propios clientes).';

insert into subscription_plans_cafexis (name, price_cents, billing_period, trial_days)
values ('Básico', 0, 'mensual', 14)
on conflict (name) do nothing;

create table business_subscriptions_cafexis (
  business_id uuid primary key references businesses_cafexis (id) on delete cascade,
  plan_id uuid not null references subscription_plans_cafexis (id) on delete restrict,
  status subscription_status_cafexis not null default 'trial',
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table business_subscriptions_cafexis is 'Estado de suscripción de cada negocio a la plataforma: trial, activa, vencida o cancelada.';

create trigger business_subscriptions_cafexis_set_updated_at before update on business_subscriptions_cafexis
  for each row execute function set_updated_at_cafexis();

-- Asigna trial automáticamente a todo negocio nuevo (mismo patrón que
-- businesses_cafexis_set_slug en 0010).
create or replace function start_business_trial_cafexis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan subscription_plans_cafexis;
begin
  select * into v_plan from subscription_plans_cafexis where active order by created_at limit 1;
  if not found then
    return new;
  end if;

  insert into business_subscriptions_cafexis (business_id, plan_id, status, trial_ends_at)
  values (new.id, v_plan.id, 'trial', now() + make_interval(days => v_plan.trial_days))
  on conflict (business_id) do nothing;

  return new;
end;
$$;

create trigger businesses_cafexis_start_trial
  after insert on businesses_cafexis
  for each row execute function start_business_trial_cafexis();

-- Backfill: negocios ya existentes (antes de esta migración) quedan con
-- suscripción 'activa' sin fecha de vencimiento, para no bloquear cuentas
-- demo o reales que ya estaban operando.
insert into business_subscriptions_cafexis (business_id, plan_id, status)
select b.id, (select id from subscription_plans_cafexis order by created_at limit 1), 'activa'
from businesses_cafexis b
where not exists (select 1 from business_subscriptions_cafexis s where s.business_id = b.id);

-- true si el negocio puede operar (trial vigente o suscripción activa).
create or replace function is_business_subscription_active_cafexis(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from business_subscriptions_cafexis s
    where s.business_id = p_business_id
      and (
        (s.status = 'trial' and (s.trial_ends_at is null or s.trial_ends_at > now()))
        or (s.status = 'activa' and (s.current_period_ends_at is null or s.current_period_ends_at > now()))
      )
  );
$$;

alter table subscription_plans_cafexis enable row level security;
alter table business_subscriptions_cafexis enable row level security;

create policy subscription_plans_cafexis_select on subscription_plans_cafexis
  for select using (auth.uid() is not null);

create policy business_subscriptions_cafexis_select on business_subscriptions_cafexis
  for select using (business_id = auth_business_id_cafexis() or auth_is_platform_staff_cafexis());

create policy business_subscriptions_cafexis_update on business_subscriptions_cafexis
  for update using (auth_is_supervisor_cafexis());

-- Bloqueo también reforzado en el servidor (no solo en la UI) para las dos
-- acciones de escritura más sensibles de cada negocio: vender y publicar
-- productos. El resto de tablas se deja igual para no ser invasivo; el
-- frontend (RequireAuth) es la primera línea de bloqueo visible.
drop policy if exists orders_cafexis_customer_insert on orders_cafexis;
create policy orders_cafexis_customer_insert on orders_cafexis
  for insert with check (
    customer_id = auth.uid()
    and exists (
      select 1 from customer_businesses_cafexis cb
      where cb.customer_id = auth.uid() and cb.business_id = orders_cafexis.business_id
    )
    and is_business_subscription_active_cafexis(business_id)
  );

drop policy if exists products_cafexis_insert on products_cafexis;
create policy products_cafexis_insert on products_cafexis
  for insert with check (
    business_id = auth_business_id_cafexis()
    and is_business_subscription_active_cafexis(business_id)
  );

-- -----------------------------------------------------------------------------
-- 2. Pasarela de pagos (pedido público del cliente final)
-- -----------------------------------------------------------------------------

alter type order_status_cafexis add value if not exists 'pendiente_pago';

create type payment_transaction_status_cafexis as enum ('pendiente', 'aprobada', 'declinada', 'error');

create table payment_transactions_cafexis (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders_cafexis (id) on delete cascade,
  provider text not null default 'wompi',
  provider_reference text,
  status payment_transaction_status_cafexis not null default 'pendiente',
  amount_cents bigint not null check (amount_cents >= 0),
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_transactions_cafexis_order_idx on payment_transactions_cafexis (order_id);
create unique index payment_transactions_cafexis_provider_ref_idx on payment_transactions_cafexis (provider, provider_reference)
  where provider_reference is not null;

comment on table payment_transactions_cafexis is 'Intentos de cobro en línea de un pedido público (Wompi por ahora). El punto de venta interno no genera filas aquí.';

create trigger payment_transactions_cafexis_set_updated_at before update on payment_transactions_cafexis
  for each row execute function set_updated_at_cafexis();

alter table payment_transactions_cafexis enable row level security;

create policy payment_transactions_cafexis_select on payment_transactions_cafexis
  for select using (
    exists (
      select 1 from orders_cafexis o
      where o.id = order_id
        and (o.business_id = auth_business_id_cafexis() or auth_is_platform_staff_cafexis() or o.customer_id = auth.uid())
    )
  );

-- register_public_order_cafexis (0010) se recrea: el pedido público nace en
-- 'pendiente_pago' (no 'pedido') y se abre su transacción de pago. El resto
-- del cuerpo es igual a 0010 — mismas validaciones de cliente/vínculo.
drop function if exists register_public_order_cafexis(uuid, jsonb, payment_method_cafexis, text);

create function register_public_order_cafexis(
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

  if not is_business_subscription_active_cafexis(p_business_id) then
    raise exception 'Este negocio no tiene una suscripción activa en este momento.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido debe incluir al menos un producto.';
  end if;

  perform pg_advisory_xact_lock(hashtext('orders_cafexis:' || p_business_id::text));
  select coalesce(max(substring(code from '^V-(\d+)$')::integer), 0) + 1
  into v_next
  from orders_cafexis
  where business_id = p_business_id and code ~ '^V-\d+$';

  insert into orders_cafexis (business_id, code, customer_id, customer_name, table_or_reference, payment_method, status)
  values (
    p_business_id,
    'V-' || lpad(v_next::text, 4, '0'),
    v_customer.id,
    v_customer.name,
    nullif(trim(p_table_or_reference), ''),
    p_payment_method,
    'pendiente_pago'
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

    -- El trigger order_items_cafexis_discount_inventory (0006) descuenta el
    -- stock al insertar la línea, independientemente del estado del pedido:
    -- se reserva en el momento del pedido, no al confirmarse el pago.
    insert into order_items_cafexis (order_id, product_id, product_name, quantity, unit_price)
    values (v_order_id, v_product.id, v_product.name, v_quantity, v_product.price);

    v_total := v_total + v_quantity * v_product.price;
  end loop;

  update orders_cafexis set total = v_total where id = v_order_id;

  insert into payment_transactions_cafexis (order_id, provider, status, amount_cents)
  values (v_order_id, 'wompi', 'pendiente', round(v_total * 100)::bigint);

  return v_order_id;
end;
$$;

revoke execute on function register_public_order_cafexis(uuid, jsonb, payment_method_cafexis, text) from public, anon;
grant execute on function register_public_order_cafexis(uuid, jsonb, payment_method_cafexis, text) to authenticated;

-- Confirma (o rechaza) el cobro de una transacción. La llama SOLO la Edge
-- Function del webhook, con la service_role key (nunca el frontend): por
-- eso no se otorga a anon ni a authenticated más abajo.
create or replace function confirm_payment_cafexis(
  p_provider text,
  p_provider_reference text,
  p_status payment_transaction_status_cafexis,
  p_raw_payload jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx payment_transactions_cafexis%rowtype;
begin
  select * into v_tx from payment_transactions_cafexis
  where provider = p_provider and provider_reference = p_provider_reference
  for update;

  if not found then
    raise exception 'Transacción no encontrada para % / %.', p_provider, p_provider_reference;
  end if;

  update payment_transactions_cafexis
  set status = p_status, raw_payload = coalesce(p_raw_payload, raw_payload)
  where id = v_tx.id;

  if p_status = 'aprobada' then
    update orders_cafexis set status = 'pedido' where id = v_tx.order_id and status = 'pendiente_pago';
  elsif p_status in ('declinada', 'error') then
    -- El pedido queda visible como 'pendiente_pago' para que el negocio lo
    -- vea estancado; no se cancela automáticamente ni se repone inventario
    -- aquí — decisión manual del negocio si el cliente no vuelve a pagar.
    null;
  end if;
end;
$$;

revoke execute on function confirm_payment_cafexis(text, text, payment_transaction_status_cafexis, jsonb) from public, anon, authenticated;

-- Vincula el provider_reference de Wompi a la transacción recién creada
-- (lo hace la Edge Function create-payment-link, con el usuario autenticado,
-- antes de redirigir al cliente al checkout).
-- Security definer: payment_transactions_cafexis solo tiene policy de
-- select. La llama create-payment-link con la sesión del CLIENTE (no con la
-- service_role, donde auth.uid() sería null), y el filtro por customer_id
-- limita el cambio a su propio pedido.
create or replace function attach_payment_reference_cafexis(p_order_id uuid, p_provider text, p_provider_reference text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update payment_transactions_cafexis
  set provider = p_provider, provider_reference = p_provider_reference
  where order_id = p_order_id
    and exists (select 1 from orders_cafexis o where o.id = p_order_id and o.customer_id = auth.uid());

  if not found then
    raise exception 'No se pudo asociar la referencia de pago a este pedido.';
  end if;
end;
$$;

revoke execute on function attach_payment_reference_cafexis(uuid, text, text) from public, anon;
grant execute on function attach_payment_reference_cafexis(uuid, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Facturación electrónica DIAN (a pedido, sobre ventas ya entregadas)
-- -----------------------------------------------------------------------------

create type invoice_status_cafexis as enum ('pendiente', 'emitida', 'error');

create table invoices_cafexis (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders_cafexis (id) on delete cascade,
  business_id uuid not null references businesses_cafexis (id) on delete cascade,
  provider text not null default 'factus',
  status invoice_status_cafexis not null default 'pendiente',
  cufe text,
  pdf_url text,
  xml_url text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invoices_cafexis_business_idx on invoices_cafexis (business_id);

comment on table invoices_cafexis is 'Facturas electrónicas DIAN generadas a pedido sobre un pedido entregado (Factus por ahora). Solo la Edge Function generate-invoice escribe aquí.';

create trigger invoices_cafexis_set_updated_at before update on invoices_cafexis
  for each row execute function set_updated_at_cafexis();

alter table invoices_cafexis enable row level security;

create policy invoices_cafexis_select on invoices_cafexis
  for select using (business_id = auth_business_id_cafexis() or auth_is_platform_staff_cafexis());

-- Solicita la generación: crea (o reutiliza) la fila 'pendiente' que la
-- Edge Function generate-invoice completará con el service_role. Solo
-- sobre pedidos ya entregados, del propio negocio (o el que opera el
-- supervisor técnico). Solo administrador y supervisor técnico activos
-- (nunca barista ni soporte, que es de solo lectura).
--
-- Security definer: invoices_cafexis solo tiene policy de select (ningún
-- usuario escribe directo), así que esta función es la única vía para abrir
-- la solicitud y hace ella misma la validación de permisos.
create or replace function request_invoice_cafexis(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders_cafexis%rowtype;
  v_id uuid;
begin
  select * into v_order from orders_cafexis where id = p_order_id;
  if not found then
    raise exception 'Pedido no encontrado.';
  end if;
  if v_order.status <> 'entregado' then
    raise exception 'Solo se puede facturar un pedido ya entregado.';
  end if;
  if not auth_can_view_reports_cafexis()
     or not (v_order.business_id = auth_business_id_cafexis() or auth_is_supervisor_cafexis()) then
    raise exception 'No tienes permiso sobre este pedido.';
  end if;

  insert into invoices_cafexis (order_id, business_id, status)
  values (p_order_id, v_order.business_id, 'pendiente')
  on conflict (order_id) do update set status = 'pendiente', error_message = null
  where invoices_cafexis.status = 'error'
  returning id into v_id;

  if v_id is null then
    select id into v_id from invoices_cafexis where order_id = p_order_id;
  end if;

  return v_id;
end;
$$;

revoke execute on function request_invoice_cafexis(uuid) from public, anon;
grant execute on function request_invoice_cafexis(uuid) to authenticated;

notify pgrst, 'reload schema';
