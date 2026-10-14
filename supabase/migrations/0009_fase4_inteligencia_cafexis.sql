-- =============================================================================
-- Cafexis · Fase 4 — Inteligencia del negocio
--
--   1. Historial de movimientos de inventario (stock_movements_cafexis): cada
--      cambio de existencia de un insumo o de un lote de café queda
--      registrado con su motivo (venta, compra recibida, ajuste manual o
--      existencia inicial). Lo llenan triggers; el frontend solo lo lee.
--      Es la base de los reportes de consumo y de la proyección de
--      reposición: sin historial no se puede saber qué tan rápido se agota
--      algo.
--   2. Reportes calculados en la base de datos (ventas y movimientos), con
--      período y agrupación (producto, categoría, método de pago, hora, día,
--      semana, mes, insumo, lote). Calcular aquí evita el límite de 1000
--      filas por consulta de PostgREST y sirve igual a los 4 reportes
--      predefinidos y al generador de reportes personalizados.
--   3. Proyección de reposición: consumo diario promedio de cada insumo,
--      fecha estimada en que se agota y cantidad sugerida a comprar.
--   4. Reportes solo para administrador y supervisor técnico (el barista no
--      ve reportes, según el documento de alcance).
--
-- Requiere 0001-0008 aplicadas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Permiso de reportes
-- -----------------------------------------------------------------------------

create or replace function auth_can_view_reports_cafexis()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from app_users_cafexis
    where id = auth.uid() and active and role in ('administrador', 'supervisor_tecnico')
  );
$$;

-- Negocio sobre el que se consulta un reporte (el propio, o el elegido por
-- el supervisor), exigiendo rol con acceso a reportes.
create or replace function resolve_report_business_id_cafexis(p_business_id uuid)
returns uuid
language plpgsql
stable
set search_path = public
as $$
begin
  if not auth_can_view_reports_cafexis() then
    raise exception 'Tu rol no tiene acceso a los reportes.';
  end if;
  return resolve_business_id_cafexis(p_business_id);
end;
$$;

-- Los reportes personalizados pasan a ser solo de administrador/supervisor.
drop policy if exists custom_reports_cafexis_select on custom_reports_cafexis;
drop policy if exists custom_reports_cafexis_insert on custom_reports_cafexis;
drop policy if exists custom_reports_cafexis_update on custom_reports_cafexis;
drop policy if exists custom_reports_cafexis_delete on custom_reports_cafexis;

create policy custom_reports_cafexis_select on custom_reports_cafexis for select
  using ((business_id = auth_business_id_cafexis() or auth_is_supervisor_cafexis()) and auth_can_view_reports_cafexis());
create policy custom_reports_cafexis_insert on custom_reports_cafexis for insert
  with check ((business_id = auth_business_id_cafexis() or auth_is_supervisor_cafexis()) and auth_can_view_reports_cafexis());
create policy custom_reports_cafexis_update on custom_reports_cafexis for update
  using ((business_id = auth_business_id_cafexis() or auth_is_supervisor_cafexis()) and auth_can_view_reports_cafexis());
create policy custom_reports_cafexis_delete on custom_reports_cafexis for delete
  using ((business_id = auth_business_id_cafexis() or auth_is_supervisor_cafexis()) and auth_can_view_reports_cafexis());

-- -----------------------------------------------------------------------------
-- 2. Historial de movimientos de inventario
-- -----------------------------------------------------------------------------

create type stock_movement_kind_cafexis as enum ('venta', 'compra', 'ajuste', 'inicial');

create table stock_movements_cafexis (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses_cafexis (id) on delete cascade,
  inventory_item_id uuid references inventory_items_cafexis (id) on delete cascade,
  coffee_lot_id uuid references coffee_lots_cafexis (id) on delete cascade,
  kind stock_movement_kind_cafexis not null,
  quantity numeric(14, 4) not null, -- con signo, en la unidad del insumo (kg para lotes)
  order_id uuid references orders_cafexis (id) on delete set null,
  purchase_order_id uuid references purchase_orders_cafexis (id) on delete set null,
  created_by uuid default auth.uid(),
  estimated boolean not null default false,
  created_at timestamptz not null default now(),
  check (num_nonnulls(inventory_item_id, coffee_lot_id) = 1)
);

create index stock_movements_cafexis_business_created_idx on stock_movements_cafexis (business_id, created_at);
create index stock_movements_cafexis_item_idx on stock_movements_cafexis (inventory_item_id, created_at);
create index stock_movements_cafexis_lot_idx on stock_movements_cafexis (coffee_lot_id, created_at);
create index orders_cafexis_business_created_idx on orders_cafexis (business_id, created_at);

comment on table stock_movements_cafexis is 'Historial de cada cambio de existencia de un insumo o lote de café (venta, compra recibida, ajuste o existencia inicial). Lo escriben triggers; base de reportes de consumo y proyección de reposición.';
comment on column stock_movements_cafexis.estimated is 'true en movimientos reconstruidos al aplicar la migración 0009 a partir de ventas anteriores y las recetas actuales.';

-- Solo lectura para quien puede ver reportes; sin políticas de escritura,
-- así nadie puede alterar el historial desde el cliente.
alter table stock_movements_cafexis enable row level security;

create policy stock_movements_cafexis_select on stock_movements_cafexis for select
  using ((business_id = auth_business_id_cafexis() or auth_is_supervisor_cafexis()) and auth_can_view_reports_cafexis());

-- Registra el movimiento. El motivo lo fijan, dentro de la misma
-- transacción, los triggers de venta y de recepción de compras
-- (set_config 'cafexis.movement_*'); cualquier otro cambio es un ajuste.
create or replace function log_stock_movement_cafexis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old numeric := 0;
  v_new numeric;
  v_kind text := nullif(current_setting('cafexis.movement_kind', true), '');
begin
  if tg_table_name = 'inventory_items_cafexis' then
    v_new := new.quantity;
    if tg_op = 'UPDATE' then v_old := old.quantity; end if;
  else
    v_new := new.quantity_kg;
    if tg_op = 'UPDATE' then v_old := old.quantity_kg; end if;
  end if;

  if v_new = v_old then return new; end if;

  insert into stock_movements_cafexis (business_id, inventory_item_id, coffee_lot_id, kind, quantity, order_id, purchase_order_id)
  values (
    new.business_id,
    case when tg_table_name = 'inventory_items_cafexis' then new.id end,
    case when tg_table_name = 'coffee_lots_cafexis' then new.id end,
    coalesce(v_kind, case when tg_op = 'INSERT' then 'inicial' else 'ajuste' end)::stock_movement_kind_cafexis,
    v_new - v_old,
    nullif(current_setting('cafexis.movement_order_id', true), '')::uuid,
    nullif(current_setting('cafexis.movement_purchase_order_id', true), '')::uuid
  );
  return new;
end;
$$;

create trigger inventory_items_cafexis_log_movement
  after insert or update of quantity on inventory_items_cafexis
  for each row execute function log_stock_movement_cafexis();

create trigger coffee_lots_cafexis_log_movement
  after insert or update of quantity_kg on coffee_lots_cafexis
  for each row execute function log_stock_movement_cafexis();

-- Trigger de venta (0006) con el motivo "venta" y el pedido de origen.
create or replace function discount_inventory_on_sale_cafexis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product products_cafexis%rowtype;
  v_recipe record;
  v_has_recipe boolean := false;
  v_needed numeric;
  v_lot coffee_lots_cafexis%rowtype;
begin
  if new.product_id is null then return new; end if;

  select * into v_product from products_cafexis where id = new.product_id;
  if not found then return new; end if;

  perform set_config('cafexis.movement_kind', 'venta', true);
  perform set_config('cafexis.movement_order_id', new.order_id::text, true);

  -- a) Bebida preparada: descontar cada ingrediente de la receta.
  for v_recipe in
    select r.quantity, r.unit, i.id as item_id, i.name, i.unit as item_unit, i.quantity as available
    from product_recipe_items_cafexis r
    join inventory_items_cafexis i on i.id = r.inventory_item_id
    where r.product_id = new.product_id
    for update of i
  loop
    v_has_recipe := true;
    v_needed := convert_quantity_cafexis(v_recipe.quantity, v_recipe.unit, v_recipe.item_unit) * new.quantity;

    if v_recipe.available < v_needed then
      raise exception 'Stock insuficiente de "%" para vender % × %: se necesitan % %, hay % %.',
        v_recipe.name, trim_scale(new.quantity), v_product.name,
        trim_scale(round(v_needed, 3)), v_recipe.item_unit,
        trim_scale(v_recipe.available), v_recipe.item_unit;
    end if;

    update inventory_items_cafexis set quantity = quantity - v_needed where id = v_recipe.item_id;
  end loop;

  -- b) Café empacado sin receta: descontar kg del lote de origen.
  if not v_has_recipe and v_product.coffee_lot_id is not null and v_product.lot_kg_per_unit is not null then
    select * into v_lot from coffee_lots_cafexis where id = v_product.coffee_lot_id for update;
    if found then
      v_needed := v_product.lot_kg_per_unit * new.quantity;
      if v_lot.quantity_kg < v_needed then
        raise exception 'El lote % no tiene suficiente café para vender % × %: se necesitan % kg, hay % kg.',
          v_lot.code, trim_scale(new.quantity), v_product.name,
          trim_scale(round(v_needed, 3)), trim_scale(v_lot.quantity_kg);
      end if;
      update coffee_lots_cafexis set quantity_kg = quantity_kg - v_needed where id = v_lot.id;
    end if;
  end if;

  perform set_config('cafexis.movement_kind', '', true);
  perform set_config('cafexis.movement_order_id', '', true);
  return new;
end;
$$;

-- Trigger de recepción (0006) con el motivo "compra" y la orden de origen.
create or replace function apply_purchase_receipt_cafexis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'confirmada' and new.status = 'recibida' then
    perform set_config('cafexis.movement_kind', 'compra', true);
    perform set_config('cafexis.movement_purchase_order_id', new.id::text, true);

    update inventory_items_cafexis i
    set quantity = i.quantity + received.quantity
    from (
      select l.inventory_item_id, sum(convert_quantity_cafexis(l.quantity, l.unit, ii.unit)) as quantity
      from purchase_order_lines_cafexis l
      join inventory_items_cafexis ii on ii.id = l.inventory_item_id
      where l.purchase_order_id = new.id
      group by l.inventory_item_id
    ) received
    where i.id = received.inventory_item_id;

    perform set_config('cafexis.movement_kind', '', true);
    perform set_config('cafexis.movement_purchase_order_id', '', true);
  end if;
  return new;
end;
$$;

-- Reconstrucción del consumo de ventas anteriores a esta migración, con las
-- recetas y lotes actuales (marcado como estimado). Las recetas con
-- unidades no convertibles se omiten en vez de abortar la migración.
insert into stock_movements_cafexis (business_id, inventory_item_id, kind, quantity, order_id, created_by, estimated, created_at)
select o.business_id, i.id, 'venta',
  -(case
      when lower(r.unit) = lower(i.unit) then r.quantity
      when lower(r.unit) = 'g' and lower(i.unit) = 'kg' then r.quantity / 1000
      when lower(r.unit) = 'kg' and lower(i.unit) = 'g' then r.quantity * 1000
      when lower(r.unit) = 'ml' and lower(i.unit) = 'l' then r.quantity / 1000
      when lower(r.unit) = 'l' and lower(i.unit) = 'ml' then r.quantity * 1000
    end) * oi.quantity,
  o.id, null, true, o.created_at
from order_items_cafexis oi
join orders_cafexis o on o.id = oi.order_id
join product_recipe_items_cafexis r on r.product_id = oi.product_id
join inventory_items_cafexis i on i.id = r.inventory_item_id
where lower(r.unit) = lower(i.unit)
   or (lower(r.unit), lower(i.unit)) in (('g', 'kg'), ('kg', 'g'), ('ml', 'l'), ('l', 'ml'));

insert into stock_movements_cafexis (business_id, coffee_lot_id, kind, quantity, order_id, created_by, estimated, created_at)
select o.business_id, p.coffee_lot_id, 'venta', -(p.lot_kg_per_unit * oi.quantity), o.id, null, true, o.created_at
from order_items_cafexis oi
join orders_cafexis o on o.id = oi.order_id
join products_cafexis p on p.id = oi.product_id
where p.coffee_lot_id is not null
  and p.lot_kg_per_unit is not null
  and not exists (select 1 from product_recipe_items_cafexis r where r.product_id = p.id);

-- -----------------------------------------------------------------------------
-- 3. Reportes
-- -----------------------------------------------------------------------------

-- Valida período y zona horaria comunes a todos los reportes.
create or replace function validate_report_period_cafexis(p_from timestamptz, p_to timestamptz, p_tz text)
returns void
language plpgsql
stable
as $$
begin
  if p_from is null or p_to is null or p_to <= p_from then
    raise exception 'El período del reporte no es válido.';
  end if;
  if p_to - p_from > interval '400 days' then
    raise exception 'El período del reporte no puede superar un año.';
  end if;
  if not exists (select 1 from pg_timezone_names where name = p_tz) then
    raise exception 'Zona horaria desconocida: %.', p_tz;
  end if;
end;
$$;

-- Ventas. p_group_by: producto | categoria | metodo_pago | total
--                     | hora | dia | semana | mes (series con períodos vacíos en 0).
-- La categoría es la actual del producto (el pedido no la guarda).
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

-- Movimientos de insumos (p_target = 'insumos') o lotes de café ('lotes').
-- p_group_by: elemento | total | dia | semana | mes.
--   sold      = salidas por ventas (positivo)
--   received  = entradas por compras recibidas o existencia inicial
--   adjusted  = ajustes manuales netos (con signo)
-- Por elemento incluye los que no tuvieron movimiento (para ver la
-- disponibilidad completa) y la cobertura: días que dura la existencia
-- actual al ritmo de venta del período.
create or replace function report_stock_movements_cafexis(
  p_target text,
  p_from timestamptz,
  p_to timestamptz,
  p_group_by text default 'elemento',
  p_tz text default 'America/Bogota',
  p_business_id uuid default null,
  p_ids uuid[] default null
)
returns table (
  key text, label text, unit text,
  sold numeric, received numeric, adjusted numeric,
  current_quantity numeric, threshold numeric, daily_rate numeric, days_coverage numeric
)
language plpgsql
stable
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
  v_business_id uuid := resolve_report_business_id_cafexis(p_business_id);
  v_days numeric;
  v_trunc text;
  v_units integer;
begin
  perform validate_report_period_cafexis(p_from, p_to, p_tz);
  if p_target not in ('insumos', 'lotes') then
    raise exception 'Tipo de reporte de inventario no válido: %.', p_target;
  end if;

  -- Días transcurridos del período (un período en curso cuenta hasta ahora).
  v_days := extract(epoch from (least(p_to, now()) - p_from)) / 86400;
  if v_days <= 0 then v_days := null; end if;

  if p_group_by in ('dia', 'semana', 'mes') then
    v_trunc := case p_group_by when 'dia' then 'day' when 'semana' then 'week' else 'month' end;

    if p_target = 'insumos' then
      select count(distinct lower(i.unit)) into v_units
      from inventory_items_cafexis i
      where i.business_id = v_business_id and (p_ids is null or i.id = any (p_ids));
      if v_units > 1 then
        raise exception 'Para ver el consumo en el tiempo elige insumos con la misma unidad (no se pueden sumar kg con litros).';
      end if;
    end if;

    return query
    with mv as (
      select m.kind, m.quantity, m.created_at
      from stock_movements_cafexis m
      where m.business_id = v_business_id
        and m.created_at >= p_from and m.created_at < p_to
        and (
          (p_target = 'insumos' and m.inventory_item_id is not null and (p_ids is null or m.inventory_item_id = any (p_ids)))
          or (p_target = 'lotes' and m.coffee_lot_id is not null and (p_ids is null or m.coffee_lot_id = any (p_ids)))
        )
    ),
    buckets as (
      select generate_series(
        date_trunc(v_trunc, p_from at time zone p_tz),
        date_trunc(v_trunc, (p_to - interval '1 microsecond') at time zone p_tz),
        ('1 ' || v_trunc)::interval
      ) as b
    )
    select to_char(bk.b, 'YYYY-MM-DD'), to_char(bk.b, 'YYYY-MM-DD'),
      case when p_target = 'lotes' then 'kg' else (
        select min(i.unit) from inventory_items_cafexis i
        where i.business_id = v_business_id and (p_ids is null or i.id = any (p_ids))
      ) end,
      coalesce(-sum(mv.quantity) filter (where mv.kind = 'venta'), 0)::numeric,
      coalesce(sum(mv.quantity) filter (where mv.kind in ('compra', 'inicial')), 0)::numeric,
      coalesce(sum(mv.quantity) filter (where mv.kind = 'ajuste'), 0)::numeric,
      null::numeric, null::numeric, null::numeric, null::numeric
    from buckets bk
    left join mv on date_trunc(v_trunc, mv.created_at at time zone p_tz) = bk.b
    group by bk.b
    order by bk.b;
    return;
  end if;

  if p_group_by not in ('elemento', 'total') then
    raise exception 'Agrupación de inventario no válida: %.', p_group_by;
  end if;

  return query
  with elements as (
    select i.id, i.name as lbl, i.unit, i.quantity as qty, i.low_stock_threshold as thr
    from inventory_items_cafexis i
    where p_target = 'insumos' and i.business_id = v_business_id and (p_ids is null or i.id = any (p_ids))
    union all
    select l.id, l.code || ' · ' || l.variety, 'kg', l.quantity_kg, null
    from coffee_lots_cafexis l
    where p_target = 'lotes' and l.business_id = v_business_id and (p_ids is null or l.id = any (p_ids))
  ),
  per_element as (
    select e.id, e.lbl, e.unit, e.qty, e.thr,
      coalesce(-sum(m.quantity) filter (where m.kind = 'venta'), 0) as sold_q,
      coalesce(sum(m.quantity) filter (where m.kind in ('compra', 'inicial')), 0) as recv_q,
      coalesce(sum(m.quantity) filter (where m.kind = 'ajuste'), 0) as adj_q
    from elements e
    left join stock_movements_cafexis m
      on coalesce(m.inventory_item_id, m.coffee_lot_id) = e.id
     and m.created_at >= p_from and m.created_at < p_to
    group by e.id, e.lbl, e.unit, e.qty, e.thr
  ),
  rated as (
    select pe.*, case when v_days is null then null else pe.sold_q / v_days end as rate
    from per_element pe
  )
  select
    case when p_group_by = 'total' then 'total' else x.id::text end,
    case when p_group_by = 'total' then 'Total' else x.lbl end,
    x.unit,
    round(x.sold_q, 3), round(x.recv_q, 3), round(x.adj_q, 3),
    x.qty, x.thr,
    round(x.rate, 4),
    case when x.rate > 0 then round(x.qty / x.rate, 1) end
  from rated x
  where p_group_by <> 'total'
  order by 10 asc nulls last, 4 desc, 2;

  if p_group_by = 'total' then
    if p_target = 'insumos' then
      select count(distinct lower(i.unit)) into v_units
      from inventory_items_cafexis i
      where i.business_id = v_business_id and (p_ids is null or i.id = any (p_ids));
      if v_units > 1 then
        raise exception 'El total solo se puede calcular para insumos con la misma unidad.';
      end if;
    end if;

    return query
    select 'total'::text, 'Total'::text,
      case when p_target = 'lotes' then 'kg' else min(e.unit) end,
      round(coalesce(-sum(m.quantity) filter (where m.kind = 'venta'), 0), 3),
      round(coalesce(sum(m.quantity) filter (where m.kind in ('compra', 'inicial')), 0), 3),
      round(coalesce(sum(m.quantity) filter (where m.kind = 'ajuste'), 0), 3),
      null::numeric, null::numeric, null::numeric, null::numeric
    from (
      select i.id, i.unit from inventory_items_cafexis i
      where p_target = 'insumos' and i.business_id = v_business_id and (p_ids is null or i.id = any (p_ids))
      union all
      select l.id, 'kg' from coffee_lots_cafexis l
      where p_target = 'lotes' and l.business_id = v_business_id and (p_ids is null or l.id = any (p_ids))
    ) e
    left join stock_movements_cafexis m
      on coalesce(m.inventory_item_id, m.coffee_lot_id) = e.id
     and m.created_at >= p_from and m.created_at < p_to;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Proyección de reposición
-- -----------------------------------------------------------------------------

-- Para cada insumo: consumo diario promedio por ventas en los últimos
-- p_window_days días (o desde la primera venta registrada, si hay menos
-- historial), cuándo se agotará a ese ritmo y cuánto comprar para cubrir
-- p_cover_days días más el umbral de alerta.
create or replace function inventory_projection_cafexis(
  p_window_days integer default 14,
  p_cover_days integer default 14,
  p_business_id uuid default null
)
returns table (
  inventory_item_id uuid, name text, unit text,
  quantity numeric, low_stock_threshold numeric, status stock_status_cafexis,
  daily_consumption numeric, history_days numeric,
  days_until_out numeric, depletes_at timestamptz, days_until_threshold numeric,
  suggested_quantity numeric, preferred_supplier_id uuid, in_open_order boolean
)
language plpgsql
stable
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
  v_business_id uuid := resolve_report_business_id_cafexis(p_business_id);
  v_start timestamptz;
  v_days numeric;
begin
  if p_window_days is null or p_window_days < 1 or p_window_days > 365 then
    raise exception 'La ventana de consumo debe estar entre 1 y 365 días.';
  end if;
  if p_cover_days is null or p_cover_days < 1 or p_cover_days > 365 then
    raise exception 'Los días a cubrir deben estar entre 1 y 365.';
  end if;

  select greatest(now() - make_interval(days => p_window_days), min(m.created_at))
  into v_start
  from stock_movements_cafexis m
  where m.business_id = v_business_id and m.kind = 'venta' and m.inventory_item_id is not null;

  v_start := coalesce(v_start, now() - make_interval(days => p_window_days));
  v_days := greatest(extract(epoch from (now() - v_start)) / 86400, 1);

  return query
  with consumption as (
    select m.inventory_item_id as item_id, -sum(m.quantity) / v_days as rate
    from stock_movements_cafexis m
    where m.business_id = v_business_id
      and m.kind = 'venta'
      and m.inventory_item_id is not null
      and m.created_at >= v_start
    group by m.inventory_item_id
  ),
  open_lines as (
    select distinct l.inventory_item_id as item_id
    from purchase_order_lines_cafexis l
    join purchase_orders_cafexis po on po.id = l.purchase_order_id
    where po.business_id = v_business_id and po.status in ('propuesta', 'confirmada')
  )
  select i.id, i.name, i.unit, i.quantity, i.low_stock_threshold, i.status,
    round(coalesce(c.rate, 0), 4),
    round(v_days, 1),
    case when c.rate > 0 then round(i.quantity / c.rate, 1) end,
    case when c.rate > 0 then now() + make_interval(secs => (i.quantity / c.rate * 86400)::double precision) end,
    case when c.rate > 0 then round(greatest(i.quantity - i.low_stock_threshold, 0) / c.rate, 1) end,
    case
      when coalesce(c.rate, 0) > 0
        then round(greatest(c.rate * p_cover_days + i.low_stock_threshold - i.quantity, 0), 3)
      when i.status <> 'ok'
        then round(greatest(i.low_stock_threshold * 2 - i.quantity, 1), 3)
      else 0
    end,
    i.preferred_supplier_id,
    ol.item_id is not null
  from inventory_items_cafexis i
  left join consumption c on c.item_id = i.id
  left join open_lines ol on ol.item_id = i.id
  where i.business_id = v_business_id
  order by 9 asc nulls last, i.status desc, i.name;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Permisos de ejecución
-- -----------------------------------------------------------------------------

revoke execute on function report_sales_cafexis(timestamptz, timestamptz, text, text, uuid, uuid[], text[], payment_method_cafexis[]) from public, anon;
revoke execute on function report_stock_movements_cafexis(text, timestamptz, timestamptz, text, text, uuid, uuid[]) from public, anon;
revoke execute on function inventory_projection_cafexis(integer, integer, uuid) from public, anon;
revoke execute on function resolve_report_business_id_cafexis(uuid) from public, anon;
revoke execute on function validate_report_period_cafexis(timestamptz, timestamptz, text) from public, anon;
grant execute on function report_sales_cafexis(timestamptz, timestamptz, text, text, uuid, uuid[], text[], payment_method_cafexis[]) to authenticated;
grant execute on function report_stock_movements_cafexis(text, timestamptz, timestamptz, text, text, uuid, uuid[]) to authenticated;
grant execute on function inventory_projection_cafexis(integer, integer, uuid) to authenticated;
grant execute on function resolve_report_business_id_cafexis(uuid) to authenticated;
grant execute on function validate_report_period_cafexis(timestamptz, timestamptz, text) to authenticated;

notify pgrst, 'reload schema';
