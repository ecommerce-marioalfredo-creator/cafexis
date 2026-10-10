-- =============================================================================
-- Cafexis · Supervisor técnico operando otro negocio desde las RPC de Fase 2
--
-- 0007_fase3_roles_cafexis.sql permite al supervisor técnico escribir en
-- cualquier negocio, y el frontend le deja elegir en qué negocio opera
-- (selector de la barra superior). Pero las RPC de 0006 calculaban el
-- negocio con auth_business_id_cafexis(), que siempre devuelve el negocio
-- del PERFIL: un supervisor "dentro" de otro negocio registraba ventas y
-- compras en el suyo propio.
--
-- Esta migración agrega a esas RPC un parámetro opcional p_business_id:
--   - null o el negocio propio: comportamiento igual que antes.
--   - otro negocio: solo se acepta si quien llama es supervisor técnico.
--
-- confirm_purchase_order_cafexis no cambia: ya opera sobre el negocio de la
-- orden que recibe, y RLS (0007) decide si el supervisor puede tocarla.
--
-- Las funciones se eliminan y se recrean (en vez de "create or replace")
-- porque cambia su firma: dejar ambas versiones crearía sobrecargas
-- ambiguas para PostgREST.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper: negocio sobre el que actúa la llamada.
-- -----------------------------------------------------------------------------

create or replace function resolve_business_id_cafexis(p_business_id uuid)
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  v_own uuid := auth_business_id_cafexis();
begin
  if v_own is null then
    raise exception 'No hay un negocio asociado a la sesión activa.';
  end if;

  if p_business_id is null or p_business_id = v_own then
    return v_own;
  end if;

  if auth_is_supervisor_cafexis() and exists (select 1 from businesses_cafexis where id = p_business_id) then
    return p_business_id;
  end if;

  raise exception 'No tienes permiso para operar en ese negocio.';
end;
$$;

revoke execute on function resolve_business_id_cafexis(uuid) from public, anon;
grant execute on function resolve_business_id_cafexis(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Punto de venta
-- -----------------------------------------------------------------------------

drop function if exists register_sale_cafexis(jsonb, payment_method_cafexis, text, text);

create function register_sale_cafexis(
  p_items jsonb,
  p_payment_method payment_method_cafexis,
  p_table_or_reference text default null,
  p_customer_name text default null,
  p_business_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
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
-- Revisión manual del inventario
-- -----------------------------------------------------------------------------

drop function if exists generate_purchase_proposals_cafexis();

create function generate_purchase_proposals_cafexis(p_business_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid := resolve_business_id_cafexis(p_business_id);
  v_item_id uuid;
  v_count integer := 0;
begin
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
-- Orden de compra manual
-- -----------------------------------------------------------------------------

drop function if exists create_purchase_order_cafexis(uuid, jsonb, text);

create function create_purchase_order_cafexis(
  p_supplier_id uuid,
  p_lines jsonb,
  p_reason text default null,
  p_business_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_business_id uuid := resolve_business_id_cafexis(p_business_id);
  v_po_id uuid;
begin
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

-- -----------------------------------------------------------------------------
-- Permisos (los drop de arriba eliminaron los grants de 0006)
-- -----------------------------------------------------------------------------

revoke execute on function register_sale_cafexis(jsonb, payment_method_cafexis, text, text, uuid) from public, anon;
revoke execute on function generate_purchase_proposals_cafexis(uuid) from public, anon;
revoke execute on function create_purchase_order_cafexis(uuid, jsonb, text, uuid) from public, anon;
grant execute on function register_sale_cafexis(jsonb, payment_method_cafexis, text, text, uuid) to authenticated;
grant execute on function generate_purchase_proposals_cafexis(uuid) to authenticated;
grant execute on function create_purchase_order_cafexis(uuid, jsonb, text, uuid) to authenticated;

-- PostgREST guarda en caché las firmas de las funciones; avisarle del cambio.
notify pgrst, 'reload schema';
