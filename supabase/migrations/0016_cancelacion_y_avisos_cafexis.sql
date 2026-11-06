-- =============================================================================
-- Cafexis · Cancelación de pedidos por ambos lados, con avisos
--
--   1. El cliente final puede cancelar sus propios pedidos mientras no hayan
--      empezado a prepararse, y todo el personal activo del negocio (también
--      el barista) puede cancelar cualquier pedido no entregado. Antes solo
--      podían el administrador y el supervisor técnico (0014).
--   2. Cada cancelación deja un aviso para el negocio y otro para el cliente,
--      si el pedido salió del catálogo (order_notifications_cafexis).
--   3. El pedido nunca se borra: queda en estado 'cancelado', con quién, cuándo
--      y por qué se canceló, y se repone el inventario igual que en la 0014.
--
-- El frontend muestra los cancelados solo en el historial del cliente y en
-- Reportes; las cifras de ventas ya los excluían desde la 0014.
--
-- Requiere 0001-0015 aplicadas. No requiere redesplegar Edge Functions.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Quién canceló
-- -----------------------------------------------------------------------------

alter table orders_cafexis
  add column if not exists cancelled_by_side text check (cancelled_by_side in ('cliente', 'negocio'));

comment on column orders_cafexis.cancelled_by_side is 'Quién canceló el pedido. cancelled_by guarda a la persona del negocio y queda vacío si canceló el cliente: su id no está en app_users_cafexis.';

-- Las cancelaciones anteriores a esta migración solo podían venir del negocio.
update orders_cafexis
set cancelled_by_side = 'negocio'
where status::text = 'cancelado' and cancelled_by_side is null;

-- Igual que en la 0014, agregando cancelled_by_side a los datos que solo puede
-- cambiar quien administra: el barista no debe poder reatribuir una cancelación.
create or replace function guard_order_changes_cafexis()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status::text = 'pendiente_pago' and new.status::text in ('pedido', 'cancelado'))
      or (old.status::text = 'pedido' and new.status::text in ('en_preparacion', 'cancelado'))
      or (old.status::text = 'en_preparacion' and new.status::text in ('listo', 'cancelado'))
      or (old.status::text = 'listo' and new.status::text in ('entregado', 'cancelado'))
    ) then
      raise exception 'Un pedido no puede pasar de "%" a "%".', old.status, new.status;
    end if;

    if new.status::text = 'cancelado'
       and coalesce(current_setting('cafexis.cancelling_order_id', true), '') <> new.id::text then
      raise exception 'Para cancelar un pedido usa "Cancelar pedido": así se repone el inventario.';
    end if;
  end if;

  -- Quien no administra el negocio (el barista) solo avanza el estado.
  if current_user = 'authenticated' and not auth_can_manage_business_cafexis(old.business_id) then
    if (new.business_id, new.code, new.customer_id, new.customer_name, new.table_or_reference,
        new.total, new.payment_method, new.created_at, new.cancelled_at, new.cancelled_by,
        new.cancelled_by_side, new.cancellation_reason)
       is distinct from
       (old.business_id, old.code, old.customer_id, old.customer_name, old.table_or_reference,
        old.total, old.payment_method, old.created_at, old.cancelled_at, old.cancelled_by,
        old.cancelled_by_side, old.cancellation_reason) then
      raise exception 'Solo el administrador puede modificar los datos de un pedido; tú puedes avanzar su estado.';
    end if;
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Avisos
-- -----------------------------------------------------------------------------

-- customer_id dice para quién es: un cliente, o todo el personal del negocio si
-- está vacío. Hoy solo existen avisos de cancelación.
create table if not exists order_notifications_cafexis (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders_cafexis (id) on delete cascade,
  business_id uuid not null references businesses_cafexis (id) on delete cascade,
  customer_id uuid references customers_cafexis (id) on delete cascade,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists order_notifications_cafexis_business_idx
  on order_notifications_cafexis (business_id, created_at desc) where customer_id is null;
create index if not exists order_notifications_cafexis_customer_idx
  on order_notifications_cafexis (customer_id, created_at desc) where customer_id is not null;

comment on table order_notifications_cafexis is 'Avisos de cancelación de pedidos. Sin customer_id, el aviso es para todo el personal del negocio y su estado de leído se comparte. Solo los crea cancel_order_cafexis.';

-- Solo lectura desde el cliente: los crea la cancelación y los marca como
-- leídos mark_order_notifications_read_cafexis.
alter table order_notifications_cafexis enable row level security;

drop policy if exists order_notifications_cafexis_select on order_notifications_cafexis;
create policy order_notifications_cafexis_select on order_notifications_cafexis
  for select using (
    customer_id = auth.uid()
    or (customer_id is null and (business_id = auth_business_id_cafexis() or auth_is_supervisor_cafexis()))
  );

create or replace function mark_order_notifications_read_cafexis(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update order_notifications_cafexis
  set read_at = now()
  where id = any (p_ids)
    and read_at is null
    and (
      customer_id = auth.uid()
      or (customer_id is null and (business_id = auth_business_id_cafexis() or auth_is_supervisor_cafexis()))
    );
end;
$$;

revoke execute on function mark_order_notifications_read_cafexis(uuid[]) from public, anon;
grant execute on function mark_order_notifications_read_cafexis(uuid[]) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Cancelación
-- -----------------------------------------------------------------------------

-- La reposición de inventario y el cobro en línea son iguales a la 0014. Si la
-- misma persona es empleada del negocio y cliente, actúa como empleada.
create or replace function cancel_order_cafexis(p_order_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders_cafexis%rowtype;
  v_status text;
  v_staff_name text;
  v_by_customer boolean;
  v_business_name text;
  v_reason text := nullif(trim(p_reason), '');
  v_reason_suffix text;
  v_mv record;
begin
  select * into v_order from orders_cafexis where id = p_order_id for update;
  if not found then
    raise exception 'Pedido no encontrado.';
  end if;
  v_status := v_order.status::text;

  -- Soporte no aparece aquí: es de solo lectura sobre los negocios.
  select u.name into v_staff_name
  from app_users_cafexis u
  where u.id = auth.uid()
    and u.active
    and u.role::text in ('administrador', 'barista', 'supervisor_tecnico')
    and (u.business_id = v_order.business_id or u.role::text = 'supervisor_tecnico');

  v_by_customer := v_staff_name is null;

  if v_by_customer and v_order.customer_id is distinct from auth.uid() then
    raise exception 'No tienes permiso para cancelar este pedido.';
  end if;
  if v_status = 'entregado' then
    raise exception 'El pedido % ya fue entregado; no se puede cancelar.', v_order.code;
  end if;
  if v_status = 'cancelado' then
    raise exception 'El pedido % ya está cancelado.', v_order.code;
  end if;
  if v_by_customer and v_status not in ('pendiente_pago', 'pedido') then
    raise exception 'Tu pedido % ya se está preparando. Habla con el negocio para cancelarlo.', v_order.code;
  end if;
  if char_length(coalesce(p_reason, '')) > 500 then
    raise exception 'El motivo de la cancelación admite máximo 500 caracteres.';
  end if;

  -- Repone lo que descontó la venta según el historial de movimientos (0009).
  perform set_config('cafexis.movement_kind', 'venta', true);
  perform set_config('cafexis.movement_order_id', p_order_id::text, true);

  for v_mv in
    select inventory_item_id, coffee_lot_id, -sum(quantity) as quantity
    from stock_movements_cafexis
    where order_id = p_order_id and kind = 'venta'
    group by inventory_item_id, coffee_lot_id
    having sum(quantity) < 0
  loop
    if v_mv.inventory_item_id is not null then
      update inventory_items_cafexis set quantity = quantity + v_mv.quantity where id = v_mv.inventory_item_id;
    else
      update coffee_lots_cafexis set quantity_kg = quantity_kg + v_mv.quantity where id = v_mv.coffee_lot_id;
    end if;
  end loop;

  perform set_config('cafexis.movement_kind', '', true);
  perform set_config('cafexis.movement_order_id', '', true);

  perform set_config('cafexis.cancelling_order_id', p_order_id::text, true);
  update orders_cafexis
  set status = 'cancelado',
      cancelled_at = now(),
      cancelled_by = case when v_by_customer then null else auth.uid() end,
      cancelled_by_side = case when v_by_customer then 'cliente' else 'negocio' end,
      cancellation_reason = v_reason
  where id = p_order_id;
  perform set_config('cafexis.cancelling_order_id', '', true);

  update payment_transactions_cafexis
  set status = 'declinada'
  where order_id = p_order_id and status = 'pendiente';

  -- Avisos para las dos partes, en la misma transacción que la cancelación.
  v_reason_suffix := case when v_reason is null then '' else ' Motivo: ' || v_reason end;

  insert into order_notifications_cafexis (order_id, business_id, message)
  values (
    p_order_id,
    v_order.business_id,
    case
      when v_by_customer then format('%s canceló el pedido %s.', v_order.customer_name, v_order.code)
      else format('%s canceló el pedido %s de %s.', v_staff_name, v_order.code, v_order.customer_name)
    end || v_reason_suffix
  );

  if v_order.customer_id is not null then
    select name into v_business_name from businesses_cafexis where id = v_order.business_id;

    insert into order_notifications_cafexis (order_id, business_id, customer_id, message)
    values (
      p_order_id,
      v_order.business_id,
      v_order.customer_id,
      case
        when v_by_customer then format('Cancelaste tu pedido %s en %s.', v_order.code, v_business_name)
        else format('%s canceló tu pedido %s.', v_business_name, v_order.code)
      end || v_reason_suffix
    );
  end if;
end;
$$;

revoke execute on function cancel_order_cafexis(uuid, text) from public, anon;
grant execute on function cancel_order_cafexis(uuid, text) to authenticated;

notify pgrst, 'reload schema';
