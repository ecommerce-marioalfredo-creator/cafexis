-- =============================================================================
-- Cafexis · Cambio de plan desde Suscripción
--
--   1. Quien administra el negocio cambia de plan desde el panel:
--      - Bajar a un plan gratis (Básica) se aplica al instante.
--      - Un plan pago queda como SOLICITUD PENDIENTE (plan y forma de pago)
--        y abre un caso de soporte para coordinar el cobro. Mientras no haya
--        cobro en línea (Wompi), el supervisor técnico la aprueba.
--   2. El supervisor técnico cambia el plan de cualquier negocio al instante;
--      con un plan pago, queda pago por un mes o un año desde hoy.
--   3. get_business_plan_cafexis también devuelve la forma de pago y la
--      solicitud pendiente, para mostrarlas en Suscripción.
--
-- Cuando esté la cuenta de Wompi, el webhook del cobro hará lo mismo que
-- "Aprobar": llamar a change_business_plan_cafexis con el plan pendiente.
--
-- Requiere 0001-0019 aplicadas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Forma de pago y solicitud pendiente
-- -----------------------------------------------------------------------------

alter table business_subscriptions_cafexis
  add column if not exists billing_period billing_period_cafexis not null default 'mensual',
  add column if not exists pending_plan_id uuid references subscription_plans_cafexis (id) on delete set null,
  add column if not exists pending_billing_period billing_period_cafexis,
  add column if not exists pending_requested_at timestamptz,
  add column if not exists pending_requested_by uuid references app_users_cafexis (id) on delete set null,
  add column if not exists pending_case_id uuid references support_cases_cafexis (id) on delete set null;

comment on column business_subscriptions_cafexis.billing_period is 'Forma de pago del plan vigente: mensual o anual.';
comment on column business_subscriptions_cafexis.pending_plan_id is 'Plan pago que el negocio pidió y aún no se ha cobrado. Lo aprueba el supervisor técnico (o, más adelante, el cobro en línea).';
comment on column business_subscriptions_cafexis.pending_case_id is 'Caso de soporte abierto con la solicitud, para coordinar el pago.';

-- Precio en pesos con puntos de miles: 7990000 centavos -> '79.900'.
create or replace function format_cop_cafexis(p_cents bigint)
returns text
language sql
immutable
as $$
  select replace(to_char(p_cents / 100, 'FM999,999,999,990'), ',', '.');
$$;

-- -----------------------------------------------------------------------------
-- 2. Cambiar de plan
-- -----------------------------------------------------------------------------

-- p_business_id: solo lo usa el supervisor técnico para otro negocio; el
-- administrador cambia el de su propio negocio.
-- Devuelve {"applied": true|false, "plan_name": ..., "case_id": ..., "period_ends_at": ...}.
create or replace function change_business_plan_cafexis(
  p_plan_code text,
  p_billing_period billing_period_cafexis default 'mensual',
  p_business_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid := coalesce(p_business_id, auth_business_id_cafexis());
  v_is_supervisor boolean := auth_is_supervisor_cafexis();
  v_target subscription_plans_cafexis%rowtype;
  v_current subscription_plans_cafexis%rowtype;
  v_sub business_subscriptions_cafexis%rowtype;
  v_business_name text;
  v_price bigint;
  v_period_ends_at timestamptz;
  v_case_id uuid;
begin
  if v_business_id is null then
    raise exception 'No hay un negocio asociado a la sesión activa.';
  end if;
  if not auth_can_manage_business_cafexis(v_business_id) then
    raise exception 'Solo quien administra el negocio puede cambiar el plan.';
  end if;

  select * into v_target from subscription_plans_cafexis where code = p_plan_code and active;
  if not found then
    raise exception 'Ese plan no está disponible.';
  end if;

  select * into v_sub from business_subscriptions_cafexis where business_id = v_business_id for update;
  if not found then
    raise exception 'El negocio no tiene una suscripción registrada. Escríbenos a soporte.';
  end if;
  if v_sub.status = 'cancelada' and not v_is_supervisor then
    raise exception 'La cuenta está cancelada. Escríbenos a soporte para reactivarla.';
  end if;

  select * into v_current from subscription_plans_cafexis where code = business_plan_code_cafexis(v_business_id);
  v_price := case when p_billing_period = 'anual' then v_target.price_annual_cents else v_target.price_cents end;

  -- El supervisor aplica al instante, y bajar a un plan gratis no espera cobro.
  if v_is_supervisor or v_target.price_cents = 0 then
    if not v_is_supervisor and v_sub.plan_id = v_target.id and v_current.code = v_target.code then
      raise exception 'Ya estás en el plan %.', v_target.name;
    end if;

    v_period_ends_at := case
      when v_target.price_cents = 0 then null
      when p_billing_period = 'anual' then now() + interval '1 year'
      else now() + interval '1 month'
    end;

    update business_subscriptions_cafexis set
      plan_id = v_target.id,
      status = 'activa',
      billing_period = p_billing_period,
      trial_ends_at = null,
      current_period_ends_at = v_period_ends_at,
      pending_plan_id = null,
      pending_billing_period = null,
      pending_requested_at = null,
      pending_requested_by = null,
      pending_case_id = null
    where business_id = v_business_id;

    -- Si venía de una solicitud, se deja constancia en su caso.
    if v_sub.pending_case_id is not null then
      begin
        perform add_support_case_message_cafexis(
          v_sub.pending_case_id,
          format('Plan %s activado%s.', v_target.name,
            case when v_period_ends_at is null then ''
              else ' hasta el ' || to_char(v_period_ends_at at time zone 'America/Bogota', 'DD/MM/YYYY') end),
          false
        );
      exception when others then
        null; -- un caso cerrado no impide el cambio de plan
      end;
    end if;

    return jsonb_build_object(
      'applied', true,
      'plan_name', v_target.name,
      'period_ends_at', v_period_ends_at
    );
  end if;

  -- Plan pago pedido por el administrador: queda pendiente de cobro.
  if v_sub.status = 'activa' and v_sub.plan_id = v_target.id and v_current.code = v_target.code
     and v_sub.current_period_ends_at is null then
    raise exception 'Ya estás en el plan %.', v_target.name;
  end if;

  -- La misma solicitud dos veces no abre otro caso.
  if v_sub.pending_plan_id = v_target.id and v_sub.pending_billing_period = p_billing_period then
    return jsonb_build_object('applied', false, 'plan_name', v_target.name, 'case_id', v_sub.pending_case_id);
  end if;

  select name into v_business_name from businesses_cafexis where id = v_business_id;

  v_case_id := open_support_case_cafexis(
    'Cambio de plan a ' || v_target.name,
    format(
      '%s pide pasar del plan %s al plan %s, con pago %s: $ %s %s.',
      v_business_name, coalesce(v_current.name, 'Básica'), v_target.name, p_billing_period,
      format_cop_cafexis(v_price), case when p_billing_period = 'anual' then 'al año' else 'al mes' end
    ) || E'\n' || 'Al confirmar el pago, apruébalo en Suscripción → Todos los negocios.',
    'cuenta',
    'media',
    v_business_id
  );

  update business_subscriptions_cafexis set
    pending_plan_id = v_target.id,
    pending_billing_period = p_billing_period,
    pending_requested_at = now(),
    pending_requested_by = auth.uid(),
    pending_case_id = v_case_id
  where business_id = v_business_id;

  return jsonb_build_object('applied', false, 'plan_name', v_target.name, 'case_id', v_case_id);
end;
$$;

-- Retira la solicitud pendiente: el administrador la cancela o el supervisor
-- técnico la rechaza. Se deja constancia en el caso.
create or replace function cancel_plan_change_cafexis(p_business_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid := coalesce(p_business_id, auth_business_id_cafexis());
  v_case_id uuid;
begin
  if v_business_id is null or not auth_can_manage_business_cafexis(v_business_id) then
    raise exception 'Solo quien administra el negocio puede cancelar la solicitud.';
  end if;

  select pending_case_id into v_case_id
  from business_subscriptions_cafexis
  where business_id = v_business_id and pending_plan_id is not null
  for update;
  if not found then
    return; -- no había solicitud pendiente
  end if;

  update business_subscriptions_cafexis set
    pending_plan_id = null,
    pending_billing_period = null,
    pending_requested_at = null,
    pending_requested_by = null,
    pending_case_id = null
  where business_id = v_business_id;

  if v_case_id is not null then
    begin
      perform add_support_case_message_cafexis(
        v_case_id,
        case when auth_is_supervisor_cafexis()
          then 'El equipo de Cafexis cerró esta solicitud de cambio de plan sin aplicarla.'
          else 'El negocio canceló esta solicitud de cambio de plan.' end,
        false
      );
    exception when others then
      null;
    end;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Plan del negocio con la forma de pago y la solicitud pendiente
-- -----------------------------------------------------------------------------

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
  v_pending subscription_plans_cafexis%rowtype;
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
  select * into v_pending from subscription_plans_cafexis where id = v_sub.pending_plan_id;

  return jsonb_build_object(
    'business_id', v_business_id,
    'status', v_sub.status,
    'trial_ends_at', v_sub.trial_ends_at,
    'current_period_ends_at', v_sub.current_period_ends_at,
    'billing_period', coalesce(v_sub.billing_period, 'mensual'),
    'plan_code', coalesce(v_plan.code, 'basica'),
    'plan_name', coalesce(v_plan.name, 'Básica'),
    'effective_plan_code', coalesce(v_effective.code, 'basica'),
    'effective_plan_name', coalesce(v_effective.name, 'Básica'),
    'features', to_jsonb(business_plan_features_cafexis(v_business_id)),
    'limits', coalesce(v_effective.limits, '{}'::jsonb),
    'addons', to_jsonb(coalesce(v_sub.addons, '{}'::text[])),
    'pending', case when v_pending.id is null then null else jsonb_build_object(
      'plan_code', v_pending.code,
      'plan_name', v_pending.name,
      'billing_period', v_sub.pending_billing_period,
      'requested_at', v_sub.pending_requested_at,
      'case_id', v_sub.pending_case_id
    ) end,
    'usage', jsonb_build_object(
      'usuarios', business_team_size_cafexis(v_business_id),
      'productos', (select count(*) from products_cafexis where business_id = v_business_id),
      'insumos', (select count(*) from inventory_items_cafexis where business_id = v_business_id)
    )
  );
end;
$$;

revoke execute on function format_cop_cafexis(bigint) from public, anon;
revoke execute on function change_business_plan_cafexis(text, billing_period_cafexis, uuid) from public, anon;
revoke execute on function cancel_plan_change_cafexis(uuid) from public, anon;
revoke execute on function get_business_plan_cafexis(uuid) from public, anon;

grant execute on function format_cop_cafexis(bigint) to authenticated;
grant execute on function change_business_plan_cafexis(text, billing_period_cafexis, uuid) to authenticated;
grant execute on function cancel_plan_change_cafexis(uuid) to authenticated;
grant execute on function get_business_plan_cafexis(uuid) to authenticated;

notify pgrst, 'reload schema';
