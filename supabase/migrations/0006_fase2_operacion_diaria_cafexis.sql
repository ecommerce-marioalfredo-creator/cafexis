-- =============================================================================
-- Cafexis · Fase 2 — Operación diaria (ventas, descuento de inventario, compras)
--
--   1. Punto de venta: método de pago "nequi" y RPC register_sale_cafexis,
--      que crea el pedido y sus líneas en una sola transacción tomando los
--      precios de products_cafexis (nunca del cliente). Sin cobro en línea.
--   2. Descuento automático de inventario: trigger sobre order_items_cafexis
--      que descuenta los ingredientes de la receta del producto o, si no
--      tiene receta, los kg de su lote de café de origen. Si no hay stock
--      suficiente la venta completa se revierte con un mensaje claro.
--   3. Compras: propuestas automáticas cuando un insumo baja de su umbral
--      (agrupadas por proveedor preferido), órdenes manuales, confirmación,
--      recepción (suma al inventario) y cancelación, con las transiciones de
--      estado validadas en la base de datos.
--
-- Requiere 0001-0005 aplicadas. No modifica migraciones anteriores.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Esquema
-- -----------------------------------------------------------------------------

-- Nequi como método de pago propio. 'billetera_digital' y 'cripto' se
-- conservan para no romper pedidos ya registrados, pero el punto de venta
-- solo ofrece efectivo, tarjeta, transferencia y Nequi.
alter type payment_method_cafexis add value if not exists 'nequi';

-- Cuántos kg del lote de origen consume cada unidad vendida de un producto
-- empacado (ej. bolsa de 500 g = 0.5). Sin este dato no se descuenta el lote.
alter table products_cafexis
  add column lot_kg_per_unit numeric(12, 3) check (lot_kg_per_unit is null or lot_kg_per_unit > 0);

comment on column products_cafexis.lot_kg_per_unit is 'Kg del lote de café de origen (coffee_lot_id) que consume cada unidad vendida. Solo aplica a café empacado.';

-- Proveedor al que se le propone comprar un insumo cuando baja del umbral.
alter table inventory_items_cafexis
  add column preferred_supplier_id uuid references suppliers_cafexis (id) on delete set null;

comment on column inventory_items_cafexis.preferred_supplier_id is 'Proveedor sugerido para reponer este insumo en las propuestas automáticas de compra.';

-- Una propuesta automática puede nacer sin proveedor (insumo sin proveedor
-- preferido); el proveedor se exige al confirmarla.
alter table purchase_orders_cafexis alter column supplier_id drop not null;

alter table purchase_orders_cafexis
  add constraint purchase_orders_cafexis_supplier_required
  check (status in ('propuesta', 'cancelada') or supplier_id is not null);

alter table purchase_orders_cafexis add column received_at timestamptz;

comment on column purchase_orders_cafexis.received_at is 'Momento en que la orden se marcó como recibida y se sumó al inventario.';

-- -----------------------------------------------------------------------------
-- 2. Helpers
-- -----------------------------------------------------------------------------

-- Conversión de unidades entre receta/orden de compra e inventario. Cubre
-- los casos comunes (g<->kg, ml<->l); cualquier otra combinación distinta
-- falla en vez de descontar una cantidad equivocada.
create or replace function convert_quantity_cafexis(p_quantity numeric, p_from text, p_to text)
returns numeric
language plpgsql
immutable
as $$
declare
  v_from text := lower(trim(p_from));
  v_to text := lower(trim(p_to));
begin
  if v_from = v_to then return p_quantity; end if;
  if v_from = 'g' and v_to = 'kg' then return p_quantity / 1000; end if;
  if v_from = 'kg' and v_to = 'g' then return p_quantity * 1000; end if;
  if v_from = 'ml' and v_to = 'l' then return p_quantity / 1000; end if;
  if v_from = 'l' and v_to = 'ml' then return p_quantity * 1000; end if;
  raise exception 'No se puede convertir de "%" a "%". Usa la misma unidad que el inventario.', p_from, p_to;
end;
$$;

-- Siguiente código de orden de compra del año para un negocio (OC-2026-015).
-- El advisory lock serializa la numeración (y la creación de propuestas, que
-- toma el mismo lock) por negocio dentro de la transacción.
create or replace function next_purchase_order_code_cafexis(p_business_id uuid)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_year text := to_char(now(), 'YYYY');
  v_next integer;
begin
  perform pg_advisory_xact_lock(hashtext('purchase_orders_cafexis:' || p_business_id::text));

  select coalesce(max(substring(code from ('^OC-' || v_year || '-(\d+)$'))::integer), 0) + 1
  into v_next
  from purchase_orders_cafexis
  where business_id = p_business_id and code ~ ('^OC-' || v_year || '-\d+$');

  return 'OC-' || v_year || '-' || lpad(v_next::text, 3, '0');
end;
$$;

-- Inserta líneas de orden de compra validando que cada insumo sea del negocio.
create or replace function insert_purchase_order_lines_cafexis(p_purchase_order_id uuid, p_business_id uuid, p_lines jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_line jsonb;
  v_item inventory_items_cafexis%rowtype;
  v_quantity numeric;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'La orden de compra debe tener al menos un insumo.';
  end if;

  for v_line in select value from jsonb_array_elements(p_lines) loop
    select * into v_item
    from inventory_items_cafexis
    where id = (v_line ->> 'inventory_item_id')::uuid and business_id = p_business_id;
    if not found then
      raise exception 'Insumo no encontrado en el inventario del negocio.';
    end if;

    v_quantity := (v_line ->> 'quantity')::numeric;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Ingresa una cantidad mayor a cero para "%".', v_item.name;
    end if;

    insert into purchase_order_lines_cafexis (purchase_order_id, inventory_item_id, quantity, unit)
    values (p_purchase_order_id, v_item.id, v_quantity, coalesce(nullif(trim(v_line ->> 'unit'), ''), v_item.unit));
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Punto de venta
-- -----------------------------------------------------------------------------

-- p_items: [{"product_id": "<uuid>", "quantity": 2}, ...]
-- Devuelve el id del pedido creado (estado 'pedido'). Corre con los permisos
-- del usuario (security invoker), así que RLS sigue aplicando.
create or replace function register_sale_cafexis(
  p_items jsonb,
  p_payment_method payment_method_cafexis,
  p_table_or_reference text default null,
  p_customer_name text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_business_id uuid := auth_business_id_cafexis();
  v_order_id uuid;
  v_next integer;
  v_item jsonb;
  v_product products_cafexis%rowtype;
  v_quantity numeric;
  v_total numeric := 0;
begin
  if v_business_id is null then
    raise exception 'No hay un negocio asociado a la sesión activa.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe incluir al menos un producto.';
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
-- 4. Descuento automático de inventario al vender
-- -----------------------------------------------------------------------------

-- Security definer: la fila de order_items ya pasó RLS al insertarse; el
-- descuento solo toca el inventario/lote del mismo producto vendido.
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

  return new;
end;
$$;

create trigger order_items_cafexis_discount_inventory
  after insert on order_items_cafexis
  for each row execute function discount_inventory_on_sale_cafexis();

-- -----------------------------------------------------------------------------
-- 5. Propuestas automáticas de compra
-- -----------------------------------------------------------------------------

-- Agrega un insumo bajo de stock a una propuesta del sistema (la abierta de
-- su proveedor preferido, o una nueva). No hace nada si el insumo está 'ok'
-- o ya figura en una orden abierta (propuesta o confirmada). Cantidad
-- sugerida: lo necesario para llegar al doble del umbral. Devuelve el id de
-- la orden afectada, o null si no hizo nada. Uso interno (triggers y
-- generate_purchase_proposals_cafexis): no se expone a los clientes.
create or replace function propose_purchase_for_item_cafexis(p_item_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item inventory_items_cafexis%rowtype;
  v_po_id uuid;
  v_detail text;
begin
  select * into v_item from inventory_items_cafexis where id = p_item_id;
  if not found or v_item.status = 'ok' then return null; end if;

  perform pg_advisory_xact_lock(hashtext('purchase_orders_cafexis:' || v_item.business_id::text));

  if exists (
    select 1
    from purchase_order_lines_cafexis l
    join purchase_orders_cafexis po on po.id = l.purchase_order_id
    where l.inventory_item_id = p_item_id and po.status in ('propuesta', 'confirmada')
  ) then
    return null;
  end if;

  v_detail := format('%s (quedan %s %s, umbral %s %s)',
    v_item.name, trim_scale(v_item.quantity), v_item.unit, trim_scale(v_item.low_stock_threshold), v_item.unit);

  select id into v_po_id
  from purchase_orders_cafexis
  where business_id = v_item.business_id
    and status = 'propuesta'
    and origin = 'sugerida_sistema'
    and supplier_id is not distinct from v_item.preferred_supplier_id
  order by created_at desc
  limit 1;

  if v_po_id is null then
    insert into purchase_orders_cafexis (business_id, code, supplier_id, origin, reason, status)
    values (
      v_item.business_id,
      next_purchase_order_code_cafexis(v_item.business_id),
      v_item.preferred_supplier_id,
      'sugerida_sistema',
      'Insumos por debajo del umbral de alerta: ' || v_detail,
      'propuesta'
    )
    returning id into v_po_id;
  else
    update purchase_orders_cafexis set reason = coalesce(reason || '; ', '') || v_detail where id = v_po_id;
  end if;

  insert into purchase_order_lines_cafexis (purchase_order_id, inventory_item_id, quantity, unit)
  values (v_po_id, v_item.id, greatest(v_item.low_stock_threshold * 2 - v_item.quantity, 1), v_item.unit);

  return v_po_id;
end;
$$;

-- Dispara la propuesta cuando la existencia de un insumo baja y queda en
-- 'bajo' o 'agotado' (por una venta o por un ajuste manual). Las subidas
-- (ej. recibir una compra) nunca generan propuestas.
create or replace function propose_purchase_on_low_stock_cafexis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'ok' and new.quantity < old.quantity then
    perform propose_purchase_for_item_cafexis(new.id);
  end if;
  return new;
end;
$$;

create trigger inventory_items_cafexis_propose_purchase
  after update of quantity on inventory_items_cafexis
  for each row execute function propose_purchase_on_low_stock_cafexis();

-- Revisión manual de todo el inventario del negocio activo (botón "Revisar
-- inventario"): útil para insumos que ya estaban bajos antes de esta
-- migración o cuya propuesta se canceló. Devuelve cuántos insumos agregó.
create or replace function generate_purchase_proposals_cafexis()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid := auth_business_id_cafexis();
  v_item_id uuid;
  v_count integer := 0;
begin
  if v_business_id is null then
    raise exception 'No hay un negocio asociado a la sesión activa.';
  end if;

  for v_item_id in
    select id from inventory_items_cafexis where business_id = v_business_id and status <> 'ok' order by name
  loop
    if propose_purchase_for_item_cafexis(v_item_id) is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Órdenes manuales, confirmación, recepción y cancelación
-- -----------------------------------------------------------------------------

-- Orden manual: nace 'confirmada' (la arma una persona, no requiere revisión).
-- p_lines: [{"inventory_item_id": "<uuid>", "quantity": 10, "unit": "kg"}, ...]
create or replace function create_purchase_order_cafexis(p_supplier_id uuid, p_lines jsonb, p_reason text default null)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_business_id uuid := auth_business_id_cafexis();
  v_po_id uuid;
begin
  if v_business_id is null then
    raise exception 'No hay un negocio asociado a la sesión activa.';
  end if;
  if p_supplier_id is null or not exists (select 1 from suppliers_cafexis where id = p_supplier_id) then
    raise exception 'Selecciona un proveedor válido.';
  end if;

  insert into purchase_orders_cafexis (business_id, code, supplier_id, origin, reason, status)
  values (v_business_id, next_purchase_order_code_cafexis(v_business_id), p_supplier_id, 'manual', nullif(trim(p_reason), ''), 'confirmada')
  returning id into v_po_id;

  perform insert_purchase_order_lines_cafexis(v_po_id, v_business_id, p_lines);
  return v_po_id;
end;
$$;

-- Confirma una propuesta con el proveedor y las cantidades revisadas.
create or replace function confirm_purchase_order_cafexis(p_purchase_order_id uuid, p_supplier_id uuid, p_lines jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_po purchase_orders_cafexis%rowtype;
begin
  select * into v_po from purchase_orders_cafexis where id = p_purchase_order_id for update;
  if not found then
    raise exception 'Orden de compra no encontrada.';
  end if;
  if v_po.status <> 'propuesta' then
    raise exception 'Solo se pueden confirmar órdenes pendientes de revisión.';
  end if;
  if p_supplier_id is null or not exists (select 1 from suppliers_cafexis where id = p_supplier_id) then
    raise exception 'Selecciona un proveedor para confirmar la orden.';
  end if;

  delete from purchase_order_lines_cafexis where purchase_order_id = p_purchase_order_id;
  perform insert_purchase_order_lines_cafexis(p_purchase_order_id, v_po.business_id, p_lines);

  update purchase_orders_cafexis set supplier_id = p_supplier_id, status = 'confirmada' where id = p_purchase_order_id;
end;
$$;

-- Máquina de estados: propuesta -> confirmada | cancelada;
-- confirmada -> recibida | cancelada. Recibida y cancelada son finales.
-- Recibir y cancelar se hacen con un update directo de status desde el
-- frontend; este trigger garantiza que no se salte ningún paso.
create or replace function guard_purchase_order_status_cafexis()
returns trigger
language plpgsql
as $$
begin
  if new.status = old.status then return new; end if;

  if not (
    (old.status = 'propuesta' and new.status in ('confirmada', 'cancelada'))
    or (old.status = 'confirmada' and new.status in ('recibida', 'cancelada'))
  ) then
    raise exception 'Una orden de compra no puede pasar de "%" a "%".', old.status, new.status;
  end if;

  if new.status = 'recibida' then
    new.received_at := now();
  end if;
  return new;
end;
$$;

create trigger purchase_orders_cafexis_guard_status
  before update of status on purchase_orders_cafexis
  for each row execute function guard_purchase_order_status_cafexis();

-- Al recibir una orden, sumar sus líneas al inventario (convirtiendo
-- unidades si la línea no está en la unidad del insumo).
create or replace function apply_purchase_receipt_cafexis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'confirmada' and new.status = 'recibida' then
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
  end if;
  return new;
end;
$$;

create trigger purchase_orders_cafexis_apply_receipt
  after update of status on purchase_orders_cafexis
  for each row execute function apply_purchase_receipt_cafexis();

-- -----------------------------------------------------------------------------
-- 7. Permisos de ejecución
-- Supabase concede EXECUTE a anon/authenticated por defecto; se restringen
-- las RPC a usuarios autenticados y los helpers internos a nadie.
-- -----------------------------------------------------------------------------

revoke execute on function register_sale_cafexis(jsonb, payment_method_cafexis, text, text) from public, anon;
revoke execute on function generate_purchase_proposals_cafexis() from public, anon;
revoke execute on function create_purchase_order_cafexis(uuid, jsonb, text) from public, anon;
revoke execute on function confirm_purchase_order_cafexis(uuid, uuid, jsonb) from public, anon;
grant execute on function register_sale_cafexis(jsonb, payment_method_cafexis, text, text) to authenticated;
grant execute on function generate_purchase_proposals_cafexis() to authenticated;
grant execute on function create_purchase_order_cafexis(uuid, jsonb, text) to authenticated;
grant execute on function confirm_purchase_order_cafexis(uuid, uuid, jsonb) to authenticated;

-- Las RPC invoker de arriba las llaman con el rol del usuario.
revoke execute on function next_purchase_order_code_cafexis(uuid) from public, anon;
revoke execute on function insert_purchase_order_lines_cafexis(uuid, uuid, jsonb) from public, anon;
grant execute on function next_purchase_order_code_cafexis(uuid) to authenticated;
grant execute on function insert_purchase_order_lines_cafexis(uuid, uuid, jsonb) to authenticated;

-- Solo la usan funciones security definer (triggers y la revisión manual).
revoke execute on function propose_purchase_for_item_cafexis(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 8. Datos demo: ligar las bolsas del negocio demo a sus lotes para que el
-- descuento por lote se pueda probar de inmediato. No afecta otros negocios.
-- -----------------------------------------------------------------------------

update products_cafexis p
set coffee_lot_id = l.id, lot_kg_per_unit = 0.5
from coffee_lots_cafexis l
where p.business_id = '11111111-1111-1111-1111-111111111111'
  and l.business_id = p.business_id
  and p.name = 'Café de origen · Huila (bolsa 500g)'
  and l.code = 'HUI-2026-04'
  and p.coffee_lot_id is null;

update products_cafexis p
set coffee_lot_id = l.id, lot_kg_per_unit = 0.34
from coffee_lots_cafexis l
where p.business_id = '11111111-1111-1111-1111-111111111111'
  and l.business_id = p.business_id
  and p.name = 'Café Nariño (bolsa 340g)'
  and l.code = 'NAR-2026-01'
  and p.coffee_lot_id is null;
