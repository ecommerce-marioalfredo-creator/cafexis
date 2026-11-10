-- =============================================================================
-- Cafexis · Panel del super usuario: negocios, usuarios, suscripciones y
-- códigos de promoción
--
-- "Super usuario" es el rol supervisor_tecnico. Soporte no ve nada de esto.
--
--   1. Códigos de promoción (promo_codes_cafexis). Los crea el supervisor
--      técnico, con fecha de vencimiento y, si quiere, un tope de usos.
--      Hay dos tipos:
--        - dias_gratis: N días de un plan pago. Se aplica al instante.
--        - descuento: N % sobre el precio de un plan (o de cualquier plan
--          pago) durante N meses. Mientras el cobro sea manual, el
--          supervisor lo descuenta al cobrar. Queda a la vista en su panel
--          y en Suscripción.
--      Lo canjea quien administra el negocio (desde Suscripción) o el
--      supervisor, para cualquier negocio. Cada negocio usa un código una
--      sola vez, y cada canje queda registrado.
--   2. Descuento en la suscripción: porcentaje, hasta cuándo y con qué código.
--   3. platform_subscriptions_overview_cafexis(): todos los negocios con su
--      suscripción, uso, usuarios (con su último ingreso), invitaciones y
--      códigos usados.
--   4. El supervisor técnico edita los planes: nombre, descripción, precios,
--      días de prueba, límites, funciones y si están a la venta. La Básica
--      sigue gratis y activa, porque es el plan al que baja todo negocio
--      cuando se le vence el plan.
--
-- El resto de la suscripción (plan, estado, fechas, forma de pago,
-- complementos, descuento) ya lo puede cambiar el supervisor con la política
-- business_subscriptions_cafexis_update de la 0012.
--
-- Requiere 0001-0020 aplicadas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Códigos de promoción y canjes
-- -----------------------------------------------------------------------------

create table if not exists promo_codes_cafexis (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'),
  description text check (char_length(description) <= 300),
  benefit text not null check (benefit in ('dias_gratis', 'descuento')),
  -- dias_gratis: el plan que se regala. descuento: el plan al que aplica
  -- (null = cualquier plan pago).
  plan_id uuid references subscription_plans_cafexis (id) on delete restrict,
  free_days integer check (free_days between 1 and 366),
  discount_percent integer check (discount_percent between 1 and 100),
  discount_months integer check (discount_months between 1 and 36),
  expires_at timestamptz not null,
  max_redemptions integer check (max_redemptions > 0),
  active boolean not null default true,
  created_by uuid default auth.uid() references app_users_cafexis (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Cada tipo con sus campos (el nombre no puede ser *_benefit_check: Postgres
  -- ya se lo da al check de la columna benefit).
  constraint promo_codes_cafexis_benefit_fields_check check (
    (benefit = 'dias_gratis' and plan_id is not null and free_days is not null
      and discount_percent is null and discount_months is null)
    or (benefit = 'descuento' and discount_percent is not null and discount_months is not null
      and free_days is null)
  )
);

comment on table promo_codes_cafexis is 'Códigos de promoción de la plataforma (días gratis de un plan o descuento). Solo los ve y administra el supervisor técnico.';
comment on column promo_codes_cafexis.expires_at is 'Último momento en que se puede canjear. Lo que ya se canjeó no se pierde al vencer.';
comment on column promo_codes_cafexis.max_redemptions is 'Cuántos negocios lo pueden usar en total; null = sin tope. Cada negocio, una sola vez.';

drop trigger if exists promo_codes_cafexis_set_updated_at on promo_codes_cafexis;
create trigger promo_codes_cafexis_set_updated_at before update on promo_codes_cafexis
  for each row execute function set_updated_at_cafexis();

create table if not exists promo_code_redemptions_cafexis (
  id uuid primary key default gen_random_uuid(),
  -- restrict: un código que ya se usó no se borra, se desactiva.
  promo_code_id uuid not null references promo_codes_cafexis (id) on delete restrict,
  business_id uuid not null references businesses_cafexis (id) on delete cascade,
  -- Copia del código: el administrador ve sus canjes sin poder leer la tabla de códigos.
  code text not null,
  summary text not null,
  redeemed_by uuid default auth.uid() references app_users_cafexis (id) on delete set null,
  by_platform boolean not null default false,
  created_at timestamptz not null default now(),
  unique (promo_code_id, business_id)
);

create index if not exists promo_code_redemptions_cafexis_business_idx on promo_code_redemptions_cafexis (business_id);

comment on table promo_code_redemptions_cafexis is 'Cada vez que un negocio usa un código de promoción: qué le dio, quién lo aplicó y cuándo.';

-- Normaliza el código (mayúsculas, sin espacios) y protege lo que ya se dio:
-- un código usado solo cambia su descripción, vencimiento, tope y estado.
create or replace function guard_promo_code_cafexis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_price integer;
begin
  new.code := upper(btrim(new.code));
  new.description := nullif(btrim(coalesce(new.description, '')), '');

  if new.plan_id is not null then
    select price_cents into v_price from subscription_plans_cafexis where id = new.plan_id;
    if coalesce(v_price, 0) = 0 then
      raise exception 'El código debe ser de un plan pago (Profesional o Premium).';
    end if;
  end if;

  if tg_op = 'UPDATE'
     and (new.code, new.benefit, new.plan_id, new.free_days, new.discount_percent, new.discount_months)
       is distinct from (old.code, old.benefit, old.plan_id, old.free_days, old.discount_percent, old.discount_months)
     and exists (select 1 from promo_code_redemptions_cafexis r where r.promo_code_id = old.id) then
    raise exception 'El código % ya se usó: solo puedes cambiar su descripción, vencimiento, tope de usos o desactivarlo.', old.code;
  end if;

  return new;
end;
$$;

drop trigger if exists promo_codes_cafexis_guard on promo_codes_cafexis;
create trigger promo_codes_cafexis_guard
  before insert or update on promo_codes_cafexis
  for each row execute function guard_promo_code_cafexis();

alter table promo_codes_cafexis enable row level security;
alter table promo_code_redemptions_cafexis enable row level security;

drop policy if exists promo_codes_cafexis_supervisor on promo_codes_cafexis;
create policy promo_codes_cafexis_supervisor on promo_codes_cafexis
  for all using (auth_is_supervisor_cafexis()) with check (auth_is_supervisor_cafexis());

-- Los canjes se escriben solo con redeem_promo_code_cafexis (security definer).
drop policy if exists promo_code_redemptions_cafexis_select on promo_code_redemptions_cafexis;
create policy promo_code_redemptions_cafexis_select on promo_code_redemptions_cafexis
  for select using (auth_is_supervisor_cafexis() or business_id = auth_business_id_cafexis());

-- -----------------------------------------------------------------------------
-- 2. Descuento en la suscripción
-- -----------------------------------------------------------------------------

alter table business_subscriptions_cafexis
  add column if not exists discount_percent integer check (discount_percent between 1 and 100),
  add column if not exists discount_ends_at timestamptz,
  add column if not exists discount_promo_code_id uuid references promo_codes_cafexis (id) on delete set null;

alter table business_subscriptions_cafexis drop constraint if exists business_subscriptions_cafexis_discount_check;
alter table business_subscriptions_cafexis add constraint business_subscriptions_cafexis_discount_check
  check (discount_percent is not null or (discount_ends_at is null and discount_promo_code_id is null));

comment on column business_subscriptions_cafexis.discount_percent is 'Descuento sobre el precio del plan, en %. Mientras el cobro sea manual, el supervisor lo descuenta al cobrar.';
comment on column business_subscriptions_cafexis.discount_ends_at is 'Hasta cuándo aplica el descuento; null = sin fecha.';

-- -----------------------------------------------------------------------------
-- 3. Canjear un código
-- -----------------------------------------------------------------------------

-- p_business_id: solo lo usa el supervisor técnico para otro negocio; el
-- administrador canjea para el suyo.
-- Devuelve {"code", "benefit", "summary", "plan_name", "ends_at"}.
create or replace function redeem_promo_code_cafexis(p_code text, p_business_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid := coalesce(p_business_id, auth_business_id_cafexis());
  v_is_supervisor boolean := auth_is_supervisor_cafexis();
  v_promo promo_codes_cafexis%rowtype;
  v_sub business_subscriptions_cafexis%rowtype;
  v_target subscription_plans_cafexis%rowtype;
  v_current subscription_plans_cafexis%rowtype;
  v_used integer;
  v_base timestamptz;
  v_ends_at timestamptz;
  v_summary text;
begin
  if v_business_id is null then
    raise exception 'No hay un negocio asociado a la sesión activa.';
  end if;
  if not auth_can_manage_business_cafexis(v_business_id) then
    raise exception 'Solo quien administra el negocio puede usar un código de promoción.';
  end if;

  -- for update: dos canjes al tiempo no se pasan del tope de usos.
  select * into v_promo from promo_codes_cafexis
  where code = upper(btrim(coalesce(p_code, '')))
  for update;
  if not found or not v_promo.active then
    raise exception 'Ese código no existe o ya no está activo. Revisa cómo lo escribiste.';
  end if;
  if v_promo.expires_at <= now() then
    raise exception 'El código % venció el %.', v_promo.code,
      to_char(v_promo.expires_at at time zone 'America/Bogota', 'DD/MM/YYYY');
  end if;
  if exists (select 1 from promo_code_redemptions_cafexis where promo_code_id = v_promo.id and business_id = v_business_id) then
    raise exception 'Este negocio ya usó el código %.', v_promo.code;
  end if;
  select count(*) into v_used from promo_code_redemptions_cafexis where promo_code_id = v_promo.id;
  if v_promo.max_redemptions is not null and v_used >= v_promo.max_redemptions then
    raise exception 'El código % ya se usó todas las veces permitidas.', v_promo.code;
  end if;

  select * into v_sub from business_subscriptions_cafexis where business_id = v_business_id for update;
  if not found then
    raise exception 'El negocio no tiene una suscripción registrada. Escríbenos a soporte.';
  end if;
  if v_sub.status = 'cancelada' and not v_is_supervisor then
    raise exception 'La cuenta está cancelada. Escríbenos a soporte para reactivarla.';
  end if;

  select * into v_target from subscription_plans_cafexis where id = v_promo.plan_id;
  select * into v_current from subscription_plans_cafexis where code = business_plan_code_cafexis(v_business_id);

  if v_promo.benefit = 'dias_gratis' then
    if v_current.sort_order > v_target.sort_order then
      if v_sub.status = 'trial' then
        raise exception '%', format(
          'Estás probando %s, que ya incluye más que este código (%s). Úsalo cuando termine tu prueba, el %s.',
          v_current.name, v_target.name, to_char(v_sub.trial_ends_at at time zone 'America/Bogota', 'DD/MM/YYYY'));
      end if;
      raise exception '%', format('Tu plan actual (%s) ya incluye más que este código (%s).', v_current.name, v_target.name);
    end if;

    if v_sub.plan_id = v_target.id and v_current.id = v_target.id then
      -- Mismo plan y vigente: los días se suman al final de lo que ya tiene.
      v_base := case when v_sub.status = 'trial' then v_sub.trial_ends_at else v_sub.current_period_ends_at end;
      if v_base is null then
        raise exception 'El negocio ya tiene % sin fecha de vencimiento.', v_target.name;
      end if;
      v_base := greatest(v_base, now());
    else
      -- Un plan pago distinto que sigue vigente se perdería al cambiarlo: el
      -- administrador escribe a soporte; el supervisor sabe lo que hace.
      if not v_is_supervisor and v_current.price_cents > 0 and v_sub.status = 'activa' then
        raise exception '%', format(
          'Tu plan %s está pago%s y este código es de %s. Escríbenos a soporte para aplicarlo sin perder lo que pagaste.',
          v_current.name,
          case when v_sub.current_period_ends_at is null then ''
            else ' hasta el ' || to_char(v_sub.current_period_ends_at at time zone 'America/Bogota', 'DD/MM/YYYY') end,
          v_target.name);
      end if;
      v_base := now();
    end if;
    v_ends_at := v_base + make_interval(days => v_promo.free_days);

    update business_subscriptions_cafexis set
      plan_id = v_target.id,
      status = 'activa',
      trial_ends_at = null,
      current_period_ends_at = v_ends_at
    where business_id = v_business_id;

    v_summary := format('%s días de %s, hasta el %s', v_promo.free_days, v_target.name,
      to_char(v_ends_at at time zone 'America/Bogota', 'DD/MM/YYYY'));
  else
    if v_sub.discount_percent is not null
       and (v_sub.discount_ends_at is null or v_sub.discount_ends_at > now())
       and not v_is_supervisor then
      raise exception '%', format(
        'El negocio ya tiene un descuento del %s%% vigente. Escríbenos a soporte si quieres cambiarlo.', v_sub.discount_percent);
    end if;

    v_ends_at := now() + make_interval(months => v_promo.discount_months);

    update business_subscriptions_cafexis set
      discount_percent = v_promo.discount_percent,
      discount_ends_at = v_ends_at,
      discount_promo_code_id = v_promo.id
    where business_id = v_business_id;

    v_summary := format('%s%% de descuento en %s durante %s, hasta el %s',
      v_promo.discount_percent,
      coalesce('el plan ' || v_target.name, 'cualquier plan pago'),
      case when v_promo.discount_months = 1 then '1 mes' else v_promo.discount_months || ' meses' end,
      to_char(v_ends_at at time zone 'America/Bogota', 'DD/MM/YYYY'));
  end if;

  insert into promo_code_redemptions_cafexis (promo_code_id, business_id, code, summary, by_platform)
  values (v_promo.id, v_business_id, v_promo.code, v_summary, v_is_supervisor);

  return jsonb_build_object(
    'code', v_promo.code,
    'benefit', v_promo.benefit,
    'summary', v_summary,
    'plan_name', v_target.name,
    'ends_at', v_ends_at
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Todos los negocios con su suscripción y sus usuarios
-- -----------------------------------------------------------------------------

create or replace function platform_subscriptions_overview_cafexis()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not auth_is_supervisor_cafexis() then
    raise exception 'Solo el supervisor técnico puede ver este panel.';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'type', b.type,
      'slug', b.slug,
      'primary_color', b.primary_color,
      'created_at', b.created_at,
      'subscription', case when s.business_id is null then null else jsonb_build_object(
        'plan_id', s.plan_id,
        'plan_code', p.code,
        'plan_name', p.name,
        'effective_plan_code', business_plan_code_cafexis(b.id),
        'status', s.status,
        'billing_period', s.billing_period,
        'trial_ends_at', s.trial_ends_at,
        'current_period_ends_at', s.current_period_ends_at,
        'addons', to_jsonb(s.addons),
        'discount_percent', s.discount_percent,
        'discount_ends_at', s.discount_ends_at,
        'discount_code', pc.code,
        'pending_plan_id', s.pending_plan_id,
        'pending_billing_period', s.pending_billing_period,
        'pending_requested_at', s.pending_requested_at,
        'pending_case_id', s.pending_case_id,
        'updated_at', s.updated_at
      ) end,
      'usage', jsonb_build_object(
        'usuarios', business_team_size_cafexis(b.id),
        'productos', (select count(*) from products_cafexis x where x.business_id = b.id),
        'insumos', (select count(*) from inventory_items_cafexis x where x.business_id = b.id),
        'clientes', (select count(*) from customer_businesses_cafexis x where x.business_id = b.id)
      ),
      'users', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', u.id, 'name', u.name, 'email', u.email, 'role', u.role, 'active', u.active,
          'created_at', u.created_at, 'last_sign_in_at', au.last_sign_in_at
        ) order by u.active desc, u.name)
        from app_users_cafexis u
        left join auth.users au on au.id = u.id
        where u.business_id = b.id
      ), '[]'::jsonb),
      'invitations', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', i.id, 'name', i.name, 'email', i.email, 'role', i.role, 'created_at', i.created_at
        ) order by i.created_at desc)
        from user_invitations_cafexis i
        where i.business_id = b.id and i.status = 'pendiente'
      ), '[]'::jsonb),
      'redemptions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'code', r.code, 'summary', r.summary, 'by_platform', r.by_platform, 'created_at', r.created_at
        ) order by r.created_at desc)
        from promo_code_redemptions_cafexis r
        where r.business_id = b.id
      ), '[]'::jsonb)
    ) order by b.name)
    from businesses_cafexis b
    left join business_subscriptions_cafexis s on s.business_id = b.id
    left join subscription_plans_cafexis p on p.id = s.plan_id
    left join promo_codes_cafexis pc on pc.id = s.discount_promo_code_id
  ), '[]'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Editar los planes
-- -----------------------------------------------------------------------------

drop policy if exists subscription_plans_cafexis_update on subscription_plans_cafexis;
create policy subscription_plans_cafexis_update on subscription_plans_cafexis
  for update using (auth_is_supervisor_cafexis()) with check (auth_is_supervisor_cafexis());

-- Las funciones y los límites tienen que ser claves que el sistema conoce
-- (las que revisan plan_permite_cafexis y plan_limite_cafexis).
create or replace function guard_subscription_plan_cafexis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_known text[] := array[
    'pedidos_cliente', 'compras', 'lotes', 'reportes', 'dashboard_mas_vendidos', 'guias_equipo', 'color_marca',
    'trazabilidad_publica', 'guias_cliente', 'reportes_personalizados', 'pagos_en_linea', 'factura_dian'
  ];
  v_key text;
  v_value jsonb;
begin
  if new.code is distinct from old.code then
    raise exception 'El código del plan no se puede cambiar: lo usan las reglas del sistema.';
  end if;

  new.name := btrim(new.name);
  if char_length(new.name) < 2 or char_length(new.name) > 40 then
    raise exception 'El nombre del plan debe tener entre 2 y 40 caracteres.';
  end if;
  new.description := nullif(btrim(coalesce(new.description, '')), '');
  if new.trial_days > 365 then
    raise exception 'La prueba puede durar hasta 365 días.';
  end if;

  if not (new.features <@ v_known) then
    raise exception 'Hay funciones que el sistema no conoce: %.',
      array_to_string(array(select unnest(new.features) except select unnest(v_known)), ', ');
  end if;
  new.features := array(select distinct f from unnest(new.features) f order by f);

  if jsonb_typeof(new.limits) <> 'object' then
    raise exception 'Los límites del plan no tienen el formato esperado.';
  end if;
  for v_key, v_value in select * from jsonb_each(new.limits) loop
    if v_key not in ('usuarios', 'productos', 'insumos', 'historial_dias') then
      raise exception 'Límite desconocido: %.', v_key;
    end if;
    if jsonb_typeof(v_value) <> 'number' or (v_value #>> '{}')::numeric < 1
       or (v_value #>> '{}')::numeric <> trunc((v_value #>> '{}')::numeric) then
      raise exception 'El límite % debe ser un número entero mayor que 0.', v_key;
    end if;
  end loop;

  if new.code = 'basica' then
    if new.price_cents <> 0 or new.price_annual_cents <> 0 then
      raise exception 'La Básica es el plan gratis al que baja todo negocio cuando vence: su precio debe seguir en $ 0.';
    end if;
    if not new.active then
      raise exception 'La Básica no se puede quitar de la venta: es el plan al que baja todo negocio cuando vence.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists subscription_plans_cafexis_guard on subscription_plans_cafexis;
create trigger subscription_plans_cafexis_guard
  before update on subscription_plans_cafexis
  for each row execute function guard_subscription_plan_cafexis();

-- -----------------------------------------------------------------------------
-- 6. Permisos de ejecución
-- -----------------------------------------------------------------------------

revoke execute on function guard_promo_code_cafexis() from public, anon, authenticated;
revoke execute on function guard_subscription_plan_cafexis() from public, anon, authenticated;
revoke execute on function redeem_promo_code_cafexis(text, uuid) from public, anon;
revoke execute on function platform_subscriptions_overview_cafexis() from public, anon;

grant execute on function redeem_promo_code_cafexis(text, uuid) to authenticated;
grant execute on function platform_subscriptions_overview_cafexis() to authenticated;

notify pgrst, 'reload schema';
