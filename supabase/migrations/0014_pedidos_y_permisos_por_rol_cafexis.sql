-- =============================================================================
-- Cafexis · Pedidos: cobro en caja, cancelación y permisos por rol
--
--   1. Pedidos públicos que no se pagan en línea: el personal puede
--      confirmar el cobro en caja (confirm_order_payment_cafexis), y el
--      administrador puede cancelar un pedido no entregado
--      (cancel_order_cafexis), que repone exactamente el inventario que
--      descontó. Nuevo estado 'cancelado'.
--   2. Máquina de estados de pedidos en la base de datos (como ya existía
--      para las órdenes de compra): pendiente de pago -> pedido -> en
--      preparación -> listo -> entregado, y 'cancelado' desde cualquiera no
--      entregado, solo a través de la RPC (para que nunca se cancele sin
--      reponer inventario).
--   3. Permisos por rol en el servidor, no solo en el menú: el barista vende
--      (con la RPC, a precios del catálogo) y avanza el estado de los
--      pedidos, pero ya no puede editar inventario, productos, recetas,
--      lotes, compras, proveedores ni los datos del negocio, ni modificar el
--      total o las líneas de un pedido. El directorio compartido de
--      proveedores deja de estar abierto a los clientes finales.
--   4. Vender con la suscripción vencida también se bloquea en el servidor
--      (0012 lo hacía solo en la pantalla).
--   5. Reportes y consola de plataforma sin pedidos pendientes de pago ni
--      cancelados en las cifras de ventas.
--
-- El valor de enum 'cancelado' se agrega aquí y, como Postgres no permite
-- usar un valor nuevo en la misma transacción, en este archivo siempre se
-- compara como texto (status::text) y solo dentro de funciones plpgsql.
--
-- Requiere 0001-0013 aplicadas. No requiere redesplegar Edge Functions.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Esquema
-- -----------------------------------------------------------------------------

alter type order_status_cafexis add value if not exists 'cancelado';

alter table orders_cafexis
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references app_users_cafexis (id) on delete set null,
  add column if not exists cancellation_reason text
    check (cancellation_reason is null or char_length(cancellation_reason) <= 500);

comment on column orders_cafexis.cancellation_reason is 'Motivo de la cancelación (opcional), visible para el negocio y para el cliente final.';

-- Administra el negocio: supervisor técnico activo, o administrador activo de ese negocio.
create or replace function auth_can_manage_business_cafexis(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth_is_supervisor_cafexis()
    or exists (
      select 1 from app_users_cafexis
      where id = auth.uid() and active and role = 'administrador' and business_id = p_business_id
    );
$$;

-- -----------------------------------------------------------------------------
-- 2. Máquina de estados y edición de pedidos
-- -----------------------------------------------------------------------------

-- No es security definer a propósito: current_user distingue una escritura
-- directa desde la app ('authenticated') de una hecha dentro de una RPC
-- security definer (el dueño de la función), que ya valida por su cuenta.
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
        new.total, new.payment_method, new.created_at, new.cancelled_at, new.cancelled_by, new.cancellation_reason)
       is distinct from
       (old.business_id, old.code, old.customer_id, old.customer_name, old.table_or_reference,
        old.total, old.payment_method, old.created_at, old.cancelled_at, old.cancelled_by, old.cancellation_reason) then
      raise exception 'Solo el administrador puede modificar los datos de un pedido; tú puedes avanzar su estado.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_cafexis_guard_changes on orders_cafexis;
create trigger orders_cafexis_guard_changes
  before update on orders_cafexis
  for each row execute function guard_order_changes_cafexis();

-- -----------------------------------------------------------------------------
-- 3. Punto de venta: security definer (el barista ya no inserta pedidos ni
-- líneas directamente) y bloqueo por suscripción vencida. El resto del
-- cuerpo es igual a 0008.
-- -----------------------------------------------------------------------------

create or replace function register_sale_cafexis(
  p_items jsonb,
  p_payment_method payment_method_cafexis,
  p_table_or_reference text default null,
  p_customer_name text default null,
  p_business_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Valida que quien llama sea personal activo del negocio (o supervisor
  -- técnico) y bloquea al rol soporte; ver 0011.
  v_business_id uuid := resolve_business_id_cafexis(p_business_id);
  v_order_id uuid;
  v_next integer;
  v_item jsonb;
  v_product products_cafexis%rowtype;
  v_quantity numeric;
  v_total numeric := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe incluir al menos un producto.';
  end if;
  if not auth_is_supervisor_cafexis() and not is_business_subscription_active_cafexis(v_business_id) then
    raise exception 'La suscripción de este negocio está vencida: renuévala para seguir vendiendo.';
  end if;
  if p_payment_method::text not in ('efectivo', 'tarjeta', 'transferencia', 'nequi') then
    raise exception 'Método de pago no válido para el punto de venta.';
  end if;

  -- Consecutivo por negocio: V-0001, V-0002…
  perform pg_advisory_xact_lock(hashtext('orders_cafexis:' || v_business_id::text));
  select coalesce(max(substring(code from '^V-(\d+)$')::integer), 0) + 1
  into v_next
  from orders_cafexis
  where business_id = v_business_id and code ~ '^V-\d+$';

  insert into orders_cafexis (business_id, code, customer_name, table_or_reference, payment_method)
  values (
    v_business_id,
    'V-' || lpad(v_next::text, 4, '0'),
    coalesce(nullif(trim(p_customer_name), ''), 'Cliente de mostrador'),
    nullif(trim(p_table_or_reference), ''),
    p_payment_method
  )
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity := (v_item ->> 'quantity')::numeric;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Cada producto de la venta debe tener una cantidad mayor a cero.';
    end if;

    select * into v_product
    from products_cafexis
    where id = (v_item ->> 'product_id')::uuid and business_id = v_business_id;
    if not found then
      raise exception 'Uno de los productos de la venta ya no existe.';
    end if;

    -- El trigger order_items_cafexis_discount_inventory descuenta el stock aquí.
    insert into order_items_cafexis (order_id, product_id, product_name, quantity, unit_price)
    values (v_order_id, v_product.id, v_product.name, v_quantity, v_product.price);

    v_total := v_total + v_quantity * v_product.price;
  end loop;

  update orders_cafexis set total = v_total where id = v_order_id;
  return v_order_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Cobro en caja de un pedido público
-- -----------------------------------------------------------------------------

-- Cualquier persona activa del negocio (también el barista) confirma que el
-- cliente pagó en caja; puede corregir el método con el que pagó.
create or replace function confirm_order_payment_cafexis(
  p_order_id uuid,
  p_payment_method payment_method_cafexis default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders_cafexis%rowtype;
begin
  select * into v_order from orders_cafexis where id = p_order_id for update;
  if not found then
    raise exception 'Pedido no encontrado.';
  end if;

  -- Personal activo del negocio del pedido o supervisor técnico; soporte no.
  perform resolve_business_id_cafexis(v_order.business_id);

  if v_order.status::text <> 'pendiente_pago' then
    raise exception 'El pedido % no está pendiente de pago.', v_order.code;
  end if;
  if p_payment_method is not null and p_payment_method::text not in ('efectivo', 'tarjeta', 'transferencia', 'nequi') then
    raise exception 'Método de pago no válido.';
  end if;

  update orders_cafexis
  set status = 'pedido', payment_method = coalesce(p_payment_method, payment_method)
  where id = p_order_id;
end;
$$;

revoke execute on function confirm_order_payment_cafexis(uuid, payment_method_cafexis) from public, anon;
grant execute on function confirm_order_payment_cafexis(uuid, payment_method_cafexis) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Cancelación con reposición de inventario
-- -----------------------------------------------------------------------------

-- Repone lo que descontó la venta según el historial de movimientos (0009),
-- no lo que diría la receta actual. La reposición queda como movimiento
-- 'venta' positivo del mismo pedido, así los reportes de consumo y la
-- proyección de reposición lo descuentan solos.
create or replace function cancel_order_cafexis(p_order_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders_cafexis%rowtype;
  v_mv record;
begin
  select * into v_order from orders_cafexis where id = p_order_id for update;
  if not found then
    raise exception 'Pedido no encontrado.';
  end if;

  perform resolve_business_id_cafexis(v_order.business_id);
  if not auth_can_manage_business_cafexis(v_order.business_id) then
    raise exception 'Solo el administrador del negocio puede cancelar pedidos.';
  end if;
  if v_order.status::text = 'entregado' then
    raise exception 'El pedido % ya fue entregado; no se puede cancelar.', v_order.code;
  end if;
  if v_order.status::text = 'cancelado' then
    raise exception 'El pedido % ya está cancelado.', v_order.code;
  end if;
  if char_length(coalesce(p_reason, '')) > 500 then
    raise exception 'El motivo de la cancelación admite máximo 500 caracteres.';
  end if;

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
      cancelled_by = auth.uid(),
      cancellation_reason = nullif(trim(p_reason), '')
  where id = p_order_id;
  perform set_config('cafexis.cancelling_order_id', '', true);

  -- Un cobro en línea aún sin aprobar queda anulado. Si Wompi lo aprobara
  -- después, confirm_payment_cafexis lo registra en la transacción pero el
  -- pedido sigue cancelado: el negocio debe devolver ese dinero.
  update payment_transactions_cafexis
  set status = 'declinada'
  where order_id = p_order_id and status = 'pendiente';
end;
$$;

revoke execute on function cancel_order_cafexis(uuid, text) from public, anon;
grant execute on function cancel_order_cafexis(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Permisos de escritura por rol
-- -----------------------------------------------------------------------------

-- Datos del negocio: solo quien lo administra.
drop policy if exists businesses_cafexis_update on businesses_cafexis;
create policy businesses_cafexis_update on businesses_cafexis
  for update using (auth_can_manage_business_cafexis(id));

-- Tablas operativas con business_id: insert/update/delete solo para quien
-- administra el negocio (la lectura no cambia). Los triggers y RPC security
-- definer (descuento al vender, propuestas de compra, recepción) no pasan
-- por estas políticas.
do $$
declare
  t text;
  tables text[] := array[
    'inventory_items_cafexis',
    'coffee_lots_cafexis',
    'purchase_orders_cafexis',
    'business_suppliers_cafexis'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I on %I;', t || '_insert', t);
    execute format(
      'create policy %I on %I for insert with check (auth_can_manage_business_cafexis(business_id));',
      t || '_insert', t
    );
    execute format('drop policy if exists %I on %I;', t || '_update', t);
    execute format(
      'create policy %I on %I for update using (auth_can_manage_business_cafexis(business_id));',
      t || '_update', t
    );
    execute format('drop policy if exists %I on %I;', t || '_delete', t);
    execute format(
      'create policy %I on %I for delete using (auth_can_manage_business_cafexis(business_id));',
      t || '_delete', t
    );
  end loop;
end $$;

-- Productos: igual, conservando el bloqueo por suscripción vencida (0012/0013).
drop policy if exists products_cafexis_insert on products_cafexis;
create policy products_cafexis_insert on products_cafexis
  for insert with check (
    auth_is_supervisor_cafexis()
    or (auth_can_manage_business_cafexis(business_id) and is_business_subscription_active_cafexis(business_id))
  );
drop policy if exists products_cafexis_update on products_cafexis;
create policy products_cafexis_update on products_cafexis
  for update using (auth_can_manage_business_cafexis(business_id));
drop policy if exists products_cafexis_delete on products_cafexis;
create policy products_cafexis_delete on products_cafexis
  for delete using (auth_can_manage_business_cafexis(business_id));

-- Pedidos: se crean con las RPC (security definer); directo, solo quien
-- administra y con suscripción vigente. El personal los actualiza para
-- avanzar el estado (el trigger de arriba limita qué puede cambiar); borrar
-- solo quien administra.
drop policy if exists orders_cafexis_insert on orders_cafexis;
create policy orders_cafexis_insert on orders_cafexis
  for insert with check (
    auth_is_supervisor_cafexis()
    or (auth_can_manage_business_cafexis(business_id) and is_business_subscription_active_cafexis(business_id))
  );
drop policy if exists orders_cafexis_delete on orders_cafexis;
create policy orders_cafexis_delete on orders_cafexis
  for delete using (auth_can_manage_business_cafexis(business_id));

-- Tablas hijas: la política "for all" de 0002 se separa en lectura (todo el
-- personal del negocio) y escritura (solo quien lo administra).
do $$
declare
  r record;
  v_owner text;
begin
  for r in
    select * from (values
      ('product_recipe_items_cafexis', 'products_cafexis', 'product_id'),
      ('order_items_cafexis', 'orders_cafexis', 'order_id'),
      ('purchase_order_lines_cafexis', 'purchase_orders_cafexis', 'purchase_order_id')
    ) as t(child, parent, fk)
  loop
    v_owner := format('select 1 from %I p where p.id = %I.%I', r.parent, r.child, r.fk);

    execute format('drop policy if exists %I on %I;', r.child || '_all', r.child);

    execute format('drop policy if exists %I on %I;', r.child || '_select', r.child);
    execute format(
      'create policy %I on %I for select using (exists (%s and (p.business_id = auth_business_id_cafexis() or auth_is_supervisor_cafexis())));',
      r.child || '_select', r.child, v_owner
    );

    execute format('drop policy if exists %I on %I;', r.child || '_insert', r.child);
    execute format(
      'create policy %I on %I for insert with check (exists (%s and auth_can_manage_business_cafexis(p.business_id)));',
      r.child || '_insert', r.child, v_owner
    );

    execute format('drop policy if exists %I on %I;', r.child || '_update', r.child);
    execute format(
      'create policy %I on %I for update using (exists (%s and auth_can_manage_business_cafexis(p.business_id)));',
      r.child || '_update', r.child, v_owner
    );

    execute format('drop policy if exists %I on %I;', r.child || '_delete', r.child);
    execute format(
      'create policy %I on %I for delete using (exists (%s and auth_can_manage_business_cafexis(p.business_id)));',
      r.child || '_delete', r.child, v_owner
    );
  end loop;
end $$;

-- Directorio compartido de proveedores: lo leen las personas de los
-- negocios (no los clientes finales) y lo amplían quienes administran uno.
-- Antes cualquier cuenta de Google podía leerlo completo y registrar NIT
-- (únicos en toda la plataforma) a nombre de cualquiera.
drop policy if exists suppliers_cafexis_select on suppliers_cafexis;
create policy suppliers_cafexis_select on suppliers_cafexis
  for select using (auth_business_id_cafexis() is not null);
drop policy if exists suppliers_cafexis_insert on suppliers_cafexis;
create policy suppliers_cafexis_insert on suppliers_cafexis
  for insert with check (auth_can_manage_business_cafexis(auth_business_id_cafexis()));

drop policy if exists supplier_branches_cafexis_select on supplier_branches_cafexis;
create policy supplier_branches_cafexis_select on supplier_branches_cafexis
  for select using (auth_business_id_cafexis() is not null);
drop policy if exists supplier_branches_cafexis_insert on supplier_branches_cafexis;
create policy supplier_branches_cafexis_insert on supplier_branches_cafexis
  for insert with check (auth_can_manage_business_cafexis(auth_business_id_cafexis()));

-- Logo del negocio: solo quien lo administra (0013 lo dejaba a todo el personal).
drop policy if exists business_logos_insert on storage.objects;
create policy business_logos_insert on storage.objects
  for insert with check (
    bucket_id = 'business-logos'
    and not auth_is_support_cafexis()
    and (
      auth_is_supervisor_cafexis()
      or ((storage.foldername(name))[1] = auth_business_id_cafexis()::text
          and auth_can_manage_business_cafexis(auth_business_id_cafexis()))
    )
  );

drop policy if exists business_logos_update on storage.objects;
create policy business_logos_update on storage.objects
  for update using (
    bucket_id = 'business-logos'
    and not auth_is_support_cafexis()
    and (
      auth_is_supervisor_cafexis()
      or ((storage.foldername(name))[1] = auth_business_id_cafexis()::text
          and auth_can_manage_business_cafexis(auth_business_id_cafexis()))
    )
  );

drop policy if exists business_logos_delete on storage.objects;
create policy business_logos_delete on storage.objects
  for delete using (
    bucket_id = 'business-logos'
    and not auth_is_support_cafexis()
    and (
      auth_is_supervisor_cafexis()
      or ((storage.foldername(name))[1] = auth_business_id_cafexis()::text
          and auth_can_manage_business_cafexis(auth_business_id_cafexis()))
    )
  );

-- -----------------------------------------------------------------------------
-- 7. Reporte de ventas sin pedidos pendientes de pago ni cancelados (cuerpo
-- igual a 0013, con el filtro ampliado).
-- -----------------------------------------------------------------------------

create or replace function report_sales_cafexis(
  p_from timestamptz,
  p_to timestamptz,
  p_group_by text default 'producto',
  p_tz text default 'America/Bogota',
  p_business_id uuid default null,
  p_product_ids uuid[] default null,
  p_categories text[] default null,
  p_payment_methods payment_method_cafexis[] default null
)
returns table (key text, label text, units numeric, revenue numeric, orders bigint)
language plpgsql
stable
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
  v_business_id uuid := resolve_report_business_id_cafexis(p_business_id);
  v_trunc text;
  v_format text;
begin
  perform validate_report_period_cafexis(p_from, p_to, p_tz);

  if p_group_by in ('hora', 'dia', 'semana', 'mes') then
    v_trunc := case p_group_by when 'hora' then 'hour' when 'dia' then 'day' when 'semana' then 'week' else 'month' end;
    v_format := case p_group_by when 'hora' then 'YYYY-MM-DD"T"HH24:00' else 'YYYY-MM-DD' end;
    if p_group_by = 'hora' and p_to - p_from > interval '31 days' then
      raise exception 'La agrupación por hora admite como máximo un mes.';
    end if;

    return query
    with lines as (
      select oi.order_id, oi.quantity, oi.unit_price, o.created_at
      from order_items_cafexis oi
      join orders_cafexis o on o.id = oi.order_id
      left join products_cafexis p on p.id = oi.product_id
      where o.business_id = v_business_id
        and o.status::text not in ('pendiente_pago', 'cancelado')
        and o.created_at >= p_from and o.created_at < p_to
        and (p_product_ids is null or oi.product_id = any (p_product_ids))
        and (p_categories is null or coalesce(p.category, 'Sin categoría') = any (p_categories))
        and (p_payment_methods is null or o.payment_method = any (p_payment_methods))
    ),
    buckets as (
      select generate_series(
        date_trunc(v_trunc, p_from at time zone p_tz),
        date_trunc(v_trunc, (p_to - interval '1 microsecond') at time zone p_tz),
        ('1 ' || v_trunc)::interval
      ) as b
    )
    select to_char(bk.b, v_format), to_char(bk.b, v_format),
      coalesce(sum(l.quantity), 0)::numeric,
      coalesce(sum(l.quantity * l.unit_price), 0)::numeric,
      count(distinct l.order_id)
    from buckets bk
    left join lines l on date_trunc(v_trunc, l.created_at at time zone p_tz) = bk.b
    group by bk.b
    order by bk.b;
    return;
  end if;

  if p_group_by not in ('producto', 'categoria', 'metodo_pago', 'total') then
    raise exception 'Agrupación de ventas no válida: %.', p_group_by;
  end if;

  return query
  with lines as (
    select oi.order_id, oi.product_id, oi.product_name, oi.quantity, oi.unit_price,
      o.payment_method, coalesce(p.category, 'Sin categoría') as category, o.created_at
    from order_items_cafexis oi
    join orders_cafexis o on o.id = oi.order_id
    left join products_cafexis p on p.id = oi.product_id
    where o.business_id = v_business_id
      and o.status::text not in ('pendiente_pago', 'cancelado')
      and o.created_at >= p_from and o.created_at < p_to
      and (p_product_ids is null or oi.product_id = any (p_product_ids))
      and (p_categories is null or coalesce(p.category, 'Sin categoría') = any (p_categories))
      and (p_payment_methods is null or o.payment_method = any (p_payment_methods))
  ),
  keyed as (
    select l.*,
      case p_group_by
        when 'producto' then coalesce(l.product_id::text, 'nombre:' || l.product_name)
        when 'categoria' then l.category
        when 'metodo_pago' then l.payment_method::text
        else 'total'
      end as k,
      case p_group_by
        when 'producto' then l.product_name
        when 'categoria' then l.category
        when 'metodo_pago' then l.payment_method::text
        else 'Total'
      end as lbl
    from lines l
  )
  select k, max(lbl), sum(quantity)::numeric, sum(quantity * unit_price)::numeric, count(distinct order_id)
  from keyed
  group by k
  order by 4 desc, 3 desc, 2;

  -- "total" sin ventas: una fila en cero para que el resumen no quede vacío.
  if p_group_by = 'total' and not found then
    return query select 'total'::text, 'Total'::text, 0::numeric, 0::numeric, 0::bigint;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Consola de plataforma: ventas sin pedidos no cobrados ni cancelados
-- (cuerpos iguales a 0011, con el filtro en las cifras de ventas).
-- -----------------------------------------------------------------------------

create or replace function platform_business_overview_cafexis(p_tz text default 'America/Bogota')
returns table (
  id uuid, name text, type text, slug text, primary_color text, logo_url text, created_at timestamptz,
  active_users integer, last_sign_in_at timestamptz,
  last_order_at timestamptz, orders_today integer, sales_today numeric, orders_7d integer, sales_7d numeric,
  low_stock integer, out_of_stock integer, open_proposals integer,
  open_cases integer, urgent_cases integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today timestamptz;
begin
  perform require_platform_staff_cafexis();
  if not exists (select 1 from pg_timezone_names where pg_timezone_names.name = p_tz) then
    raise exception 'Zona horaria desconocida: %.', p_tz;
  end if;
  v_today := date_trunc('day', now() at time zone p_tz) at time zone p_tz;

  return query
  with sales as (
    select o.business_id, o.created_at, o.total
    from orders_cafexis o
    where o.status::text not in ('pendiente_pago', 'cancelado')
      and o.created_at >= least(v_today, now() - interval '7 days')
  )
  select b.id, b.name, b.type::text, b.slug, b.primary_color, b.logo_url, b.created_at,
    (select count(*)::integer from app_users_cafexis u where u.business_id = b.id and u.active),
    (select max(au.last_sign_in_at) from app_users_cafexis u join auth.users au on au.id = u.id where u.business_id = b.id),
    (select max(o.created_at) from orders_cafexis o where o.business_id = b.id),
    (select count(*)::integer from sales s where s.business_id = b.id and s.created_at >= v_today),
    (select coalesce(sum(s.total), 0) from sales s where s.business_id = b.id and s.created_at >= v_today),
    (select count(*)::integer from sales s where s.business_id = b.id and s.created_at >= now() - interval '7 days'),
    (select coalesce(sum(s.total), 0) from sales s where s.business_id = b.id and s.created_at >= now() - interval '7 days'),
    (select count(*)::integer from inventory_items_cafexis i where i.business_id = b.id and i.status = 'bajo'),
    (select count(*)::integer from inventory_items_cafexis i where i.business_id = b.id and i.status = 'agotado'),
    (select count(*)::integer from purchase_orders_cafexis po where po.business_id = b.id and po.status = 'propuesta'),
    (select count(*)::integer from support_cases_cafexis c where c.business_id = b.id and c.status not in ('resuelto', 'cerrado')),
    (select count(*)::integer from support_cases_cafexis c where c.business_id = b.id and c.status not in ('resuelto', 'cerrado') and c.priority = 'urgente')
  from businesses_cafexis b
  order by b.name;
end;
$$;

create or replace function platform_business_detail_cafexis(p_business_id uuid, p_tz text default 'America/Bogota')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_business businesses_cafexis;
  v_today date;
begin
  perform require_platform_staff_cafexis();
  select * into v_business from businesses_cafexis where id = p_business_id;
  if not found then
    raise exception 'Negocio no encontrado.';
  end if;
  if not exists (select 1 from pg_timezone_names where pg_timezone_names.name = p_tz) then
    raise exception 'Zona horaria desconocida: %.', p_tz;
  end if;
  v_today := (now() at time zone p_tz)::date;

  return jsonb_build_object(
    'business', jsonb_build_object(
      'id', v_business.id, 'name', v_business.name, 'type', v_business.type, 'country', v_business.country,
      'slug', v_business.slug, 'primary_color', v_business.primary_color, 'logo_url', v_business.logo_url,
      'created_at', v_business.created_at
    ),
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.id, 'name', u.name, 'email', u.email, 'role', u.role, 'active', u.active,
        'last_sign_in_at', au.last_sign_in_at
      ) order by u.active desc, u.name)
      from app_users_cafexis u left join auth.users au on au.id = u.id
      where u.business_id = p_business_id
    ), '[]'::jsonb),
    'pending_invitations', (select count(*) from user_invitations_cafexis where business_id = p_business_id and status = 'pendiente'),
    'inventory_alerts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', i.name, 'quantity', i.quantity, 'unit', i.unit, 'threshold', i.low_stock_threshold, 'status', i.status
      ) order by i.status desc, i.name)
      from inventory_items_cafexis i where i.business_id = p_business_id and i.status <> 'ok'
    ), '[]'::jsonb),
    'recent_orders', coalesce((
      select jsonb_agg(row_to_json(o)::jsonb order by o.created_at desc)
      from (
        select o.code, o.created_at, o.total, o.status, o.payment_method,
          (select count(*) from order_items_cafexis oi where oi.order_id = o.id) as items
        from orders_cafexis o where o.business_id = p_business_id
        order by o.created_at desc limit 15
      ) o
    ), '[]'::jsonb),
    'open_purchase_orders', coalesce((
      select jsonb_agg(jsonb_build_object('code', po.code, 'status', po.status, 'origin', po.origin, 'created_at', po.created_at)
        order by po.created_at desc)
      from purchase_orders_cafexis po
      where po.business_id = p_business_id and po.status in ('propuesta', 'confirmada')
    ), '[]'::jsonb),
    'sales_14d', (
      select jsonb_agg(jsonb_build_object('day', d.day, 'revenue', coalesce(s.revenue, 0), 'orders', coalesce(s.orders, 0)) order by d.day)
      from generate_series(v_today - 13, v_today, interval '1 day') as d(day)
      left join (
        select (o.created_at at time zone p_tz)::date as day, sum(o.total) as revenue, count(*) as orders
        from orders_cafexis o
        where o.business_id = p_business_id
          and o.status::text not in ('pendiente_pago', 'cancelado')
          and o.created_at >= (v_today - 13)::timestamp at time zone p_tz
        group by 1
      ) s on s.day = d.day::date
    )
  );
end;
$$;

notify pgrst, 'reload schema';
