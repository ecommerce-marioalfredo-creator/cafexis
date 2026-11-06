-- =============================================================================
-- Cafexis · Auditoría de seguridad y consistencia (posterior a 0001-0012)
--
-- Corrige huecos encontrados al revisar las migraciones anteriores:
--
--   1. Usuarios desactivados (active = false) seguían con acceso completo:
--      auth_business_id_cafexis() y auth_is_supervisor_cafexis() no miraban
--      la columna active. Ahora sí. Además cada usuario puede leer su propio
--      perfil (aunque esté inactivo) para que el login le explique por qué
--      no puede entrar.
--   2. Un cliente final (cualquier cuenta de Google) podía insertar pedidos
--      y líneas directo por la API REST, saltándose
--      register_public_order_cafexis: elegía el estado (sin pasar por
--      'pendiente_pago'), el total, el precio de cada línea y hasta
--      productos de otros negocios. Se eliminan esas políticas: el cliente
--      solo pide a través de la RPC.
--   3. Referencias entre negocios: los triggers security definer de
--      inventario confiaban en que producto, receta, lote y líneas de compra
--      fueran del mismo negocio, pero las llaves foráneas no pasan por RLS.
--      Con un id ajeno (los de productos y lotes son públicos en el catálogo
--      y en el QR de trazabilidad) se podía descontar o sumar inventario de
--      otro negocio. Ahora un trigger lo valida en cada tabla.
--   4. products_cafexis_insert (recreada en 0012) había perdido la cláusula
--      del supervisor técnico que le dio 0007.
--   5. Registro atómico de negocio + administrador
--      (register_business_cafexis) en vez de dos inserts desde el navegador,
--      que dejaban negocios huérfanos si el segundo fallaba. Con eso ya no
--      hace falta que cualquier usuario autenticado pueda insertar negocios
--      o perfiles internos directamente.
--   6. Pagos: confirm_payment_cafexis valida que el monto cobrado coincida
--      con el del pedido y no deja que un evento tardío o repetido cambie
--      una transacción ya aprobada.
--   7. Facturas: generate-invoice reclama la fila de forma atómica
--      (claim_invoice_generation_cafexis) para no emitir dos veces la misma
--      factura ante la DIAN si se pulsa dos veces o hay dos pestañas.
--   8. Reporte de ventas: excluye los pedidos 'pendiente_pago' (aún no
--      cobrados).
--   9. "Mis negocios" del cliente final: RPC list_my_businesses_cafexis. El
--      cliente no puede leer businesses_cafexis por RLS, así que el select
--      anidado que usaba el frontend devolvía el negocio vacío.
--  10. Logos: el bucket solo acepta imágenes rasterizadas de hasta 2 MB (sin
--      SVG, que puede llevar scripts), y el supervisor técnico puede subir
--      el logo del negocio que opera.
--
-- IMPORTANTE: después de aplicar esta migración hay que volver a desplegar
-- las Edge Functions generate-invoice, wompi-webhook, create-payment-link e
-- invite-user, y publicar el frontend de este mismo commit (el registro de
-- negocios ahora usa register_business_cafexis).
--
-- Requiere 0001-0012 aplicadas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Usuarios desactivados sin acceso
-- -----------------------------------------------------------------------------

create or replace function auth_business_id_cafexis()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select business_id from app_users_cafexis where id = auth.uid() and active;
$$;

create or replace function auth_is_supervisor_cafexis()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from app_users_cafexis
    where id = auth.uid() and active and role = 'supervisor_tecnico'
  );
$$;

create or replace function auth_can_manage_business_users_cafexis(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth_is_supervisor_cafexis()
    or exists (
      select 1 from app_users_cafexis
      where id = auth.uid() and active and business_id = target_business_id and role = 'administrador'
    );
$$;

-- El propio perfil siempre es legible (aunque esté inactivo): el login lo
-- consulta para avisar "tu usuario está desactivado" en vez de fallar mudo.
drop policy if exists app_users_cafexis_select_self on app_users_cafexis;
create policy app_users_cafexis_select_self on app_users_cafexis
  for select using (id = auth.uid());

-- -----------------------------------------------------------------------------
-- 2. El cliente final solo pide a través de register_public_order_cafexis
-- -----------------------------------------------------------------------------

drop policy if exists orders_cafexis_customer_insert on orders_cafexis;
drop policy if exists order_items_cafexis_customer_insert on order_items_cafexis;

-- -----------------------------------------------------------------------------
-- 3. Ninguna referencia puede apuntar a un elemento de otro negocio
-- -----------------------------------------------------------------------------

-- Security definer: debe ver la fila referenciada aunque RLS se la oculte a
-- quien escribe (por ejemplo, un cliente final a través de una RPC).
create or replace function guard_same_business_cafexis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  if tg_table_name = 'order_items_cafexis' then
    if new.product_id is null then return new; end if;
    select exists (
      select 1
      from orders_cafexis o
      join products_cafexis p on p.business_id = o.business_id
      where o.id = new.order_id and p.id = new.product_id
    ) into v_ok;
  elsif tg_table_name = 'product_recipe_items_cafexis' then
    select exists (
      select 1
      from products_cafexis p
      join inventory_items_cafexis i on i.business_id = p.business_id
      where p.id = new.product_id and i.id = new.inventory_item_id
    ) into v_ok;
  elsif tg_table_name = 'purchase_order_lines_cafexis' then
    select exists (
      select 1
      from purchase_orders_cafexis po
      join inventory_items_cafexis i on i.business_id = po.business_id
      where po.id = new.purchase_order_id and i.id = new.inventory_item_id
    ) into v_ok;
  elsif tg_table_name = 'products_cafexis' then
    if new.coffee_lot_id is null then return new; end if;
    select exists (
      select 1 from coffee_lots_cafexis l
      where l.id = new.coffee_lot_id and l.business_id = new.business_id
    ) into v_ok;
  else
    return new;
  end if;

  if not v_ok then
    raise exception 'Referencia inválida: el elemento relacionado pertenece a otro negocio.';
  end if;
  return new;
end;
$$;

revoke execute on function guard_same_business_cafexis() from public, anon, authenticated;

drop trigger if exists order_items_cafexis_guard_business on order_items_cafexis;
create trigger order_items_cafexis_guard_business
  before insert or update of order_id, product_id on order_items_cafexis
  for each row execute function guard_same_business_cafexis();

drop trigger if exists product_recipe_items_cafexis_guard_business on product_recipe_items_cafexis;
create trigger product_recipe_items_cafexis_guard_business
  before insert or update of product_id, inventory_item_id on product_recipe_items_cafexis
  for each row execute function guard_same_business_cafexis();

drop trigger if exists purchase_order_lines_cafexis_guard_business on purchase_order_lines_cafexis;
create trigger purchase_order_lines_cafexis_guard_business
  before insert or update of purchase_order_id, inventory_item_id on purchase_order_lines_cafexis
  for each row execute function guard_same_business_cafexis();

drop trigger if exists products_cafexis_guard_business on products_cafexis;
create trigger products_cafexis_guard_business
  before insert or update of coffee_lot_id, business_id on products_cafexis
  for each row execute function guard_same_business_cafexis();

-- -----------------------------------------------------------------------------
-- 4. El supervisor técnico vuelve a poder crear productos en el negocio que
-- opera (0012 recreó la política sin la cláusula de 0007). El bloqueo por
-- suscripción vencida sigue aplicando al personal del negocio.
-- -----------------------------------------------------------------------------

drop policy if exists products_cafexis_insert on products_cafexis;
create policy products_cafexis_insert on products_cafexis
  for insert with check (
    auth_is_supervisor_cafexis()
    or (business_id = auth_business_id_cafexis() and is_business_subscription_active_cafexis(business_id))
  );

-- -----------------------------------------------------------------------------
-- 5. Registro atómico de negocio + administrador
-- -----------------------------------------------------------------------------

create or replace function register_business_cafexis(
  p_business_name text,
  p_business_type business_type_cafexis,
  p_country text,
  p_primary_color text,
  p_owner_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_business_id uuid;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión para registrar un negocio.';
  end if;
  if exists (select 1 from app_users_cafexis where id = v_uid) then
    raise exception 'Tu cuenta ya pertenece a un negocio.';
  end if;
  if char_length(trim(coalesce(p_business_name, ''))) < 2 then
    raise exception 'Escribe el nombre del negocio.';
  end if;
  if char_length(trim(coalesce(p_owner_name, ''))) < 2 then
    raise exception 'Escribe tu nombre.';
  end if;

  select email into v_email from auth.users where id = v_uid;

  insert into businesses_cafexis (name, type, country, primary_color)
  values (
    trim(p_business_name),
    p_business_type,
    coalesce(nullif(trim(p_country), ''), 'Colombia'),
    case when p_primary_color ~ '^#[0-9A-Fa-f]{6}$' then p_primary_color else '#D85A30' end
  )
  returning id into v_business_id;

  insert into app_users_cafexis (id, business_id, name, email, role)
  values (v_uid, v_business_id, trim(p_owner_name), coalesce(v_email, ''), 'administrador');

  return v_business_id;
end;
$$;

revoke execute on function register_business_cafexis(text, business_type_cafexis, text, text, text) from public, anon;
grant execute on function register_business_cafexis(text, business_type_cafexis, text, text, text) to authenticated;

-- Con el registro en la RPC, ya nadie necesita insertar negocios ni perfiles
-- internos directamente desde el navegador (antes cualquier cuenta podía
-- crear negocios sin límite o adueñarse de uno sin usuarios). Se conserva
-- solo para el supervisor técnico.
drop policy if exists businesses_cafexis_insert on businesses_cafexis;
create policy businesses_cafexis_insert on businesses_cafexis
  for insert with check (auth_is_supervisor_cafexis());

drop policy if exists app_users_cafexis_insert on app_users_cafexis;
create policy app_users_cafexis_insert on app_users_cafexis
  for insert with check (auth_is_supervisor_cafexis());

-- -----------------------------------------------------------------------------
-- 6. Confirmación de pagos: monto exacto y aprobación final
-- -----------------------------------------------------------------------------

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
  v_status payment_transaction_status_cafexis := p_status;
  v_amount text := p_raw_payload #>> '{data,transaction,amount_in_cents}';
begin
  select * into v_tx from payment_transactions_cafexis
  where provider = p_provider and provider_reference = p_provider_reference
  for update;

  if not found then
    raise exception 'Transacción no encontrada para % / %.', p_provider, p_provider_reference;
  end if;

  -- Una transacción aprobada es final: un evento repetido o tardío no la cambia.
  if v_tx.status = 'aprobada' then
    return;
  end if;

  -- Solo se aprueba si lo cobrado es exactamente el total del pedido
  -- (p_raw_payload es el evento de Wompi que manda el webhook).
  if v_status = 'aprobada' and (v_amount is null or v_amount !~ '^\d+$' or v_amount::bigint <> v_tx.amount_cents) then
    v_status := 'error';
  end if;

  update payment_transactions_cafexis
  set status = v_status, raw_payload = coalesce(p_raw_payload, raw_payload)
  where id = v_tx.id;

  if v_status = 'aprobada' then
    update orders_cafexis set status = 'pedido' where id = v_tx.order_id and status = 'pendiente_pago';
  end if;
  -- declinada/error: el pedido sigue en 'pendiente_pago' (ver 0012).
end;
$$;

revoke execute on function confirm_payment_cafexis(text, text, payment_transaction_status_cafexis, jsonb) from public, anon, authenticated;
grant execute on function confirm_payment_cafexis(text, text, payment_transaction_status_cafexis, jsonb) to service_role;

-- -----------------------------------------------------------------------------
-- 7. Facturas: reclamo atómico antes de llamar al proveedor
-- -----------------------------------------------------------------------------

alter table invoices_cafexis add column if not exists processing_started_at timestamptz;

comment on column invoices_cafexis.processing_started_at is 'Momento en que generate-invoice empezó a emitir la factura; evita emitirla dos veces en paralelo. Un reclamo de más de 10 minutos se considera abandonado.';

-- true si quien llama (la Edge Function, con service_role) se quedó con la
-- emisión de esta factura; false si ya está emitida o la está emitiendo otra
-- llamada.
create or replace function claim_invoice_generation_cafexis(p_invoice_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update invoices_cafexis
  set processing_started_at = now()
  where id = p_invoice_id
    and status = 'pendiente'
    and (processing_started_at is null or processing_started_at < now() - interval '10 minutes');
  return found;
end;
$$;

revoke execute on function claim_invoice_generation_cafexis(uuid) from public, anon, authenticated;
grant execute on function claim_invoice_generation_cafexis(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- 8. Reporte de ventas sin pedidos pendientes de pago (cuerpo igual a 0009,
-- con el filtro de estado en los dos CTE "lines").
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
        and o.status <> 'pendiente_pago'
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
      and o.status <> 'pendiente_pago'
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
-- 9. "Mis negocios" del cliente final
-- -----------------------------------------------------------------------------

-- Solo los datos públicos (los mismos de get_public_business_cafexis) de los
-- negocios a los que el cliente autenticado ya se vinculó.
create or replace function list_my_businesses_cafexis()
returns table (
  id uuid, name text, type business_type_cafexis, primary_color text, logo_url text, slug text, linked_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.name, b.type, b.primary_color, b.logo_url, b.slug, cb.linked_at
  from customer_businesses_cafexis cb
  join businesses_cafexis b on b.id = cb.business_id
  where cb.customer_id = auth.uid()
  order by cb.linked_at desc;
$$;

revoke execute on function list_my_businesses_cafexis() from public, anon;
grant execute on function list_my_businesses_cafexis() to authenticated;

-- -----------------------------------------------------------------------------
-- 10. Logos del negocio
-- -----------------------------------------------------------------------------

update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'],
    file_size_limit = 2097152
where id = 'business-logos';

drop policy if exists business_logos_insert on storage.objects;
create policy business_logos_insert on storage.objects
  for insert with check (
    bucket_id = 'business-logos'
    and not auth_is_support_cafexis()
    and ((storage.foldername(name))[1] = auth_business_id_cafexis()::text or auth_is_supervisor_cafexis())
  );

drop policy if exists business_logos_update on storage.objects;
create policy business_logos_update on storage.objects
  for update using (
    bucket_id = 'business-logos'
    and not auth_is_support_cafexis()
    and ((storage.foldername(name))[1] = auth_business_id_cafexis()::text or auth_is_supervisor_cafexis())
  );

drop policy if exists business_logos_delete on storage.objects;
create policy business_logos_delete on storage.objects
  for delete using (
    bucket_id = 'business-logos'
    and not auth_is_support_cafexis()
    and ((storage.foldername(name))[1] = auth_business_id_cafexis()::text or auth_is_supervisor_cafexis())
  );

notify pgrst, 'reload schema';
