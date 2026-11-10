-- =============================================================================
-- Cafexis · Guías de preparación (videos y PDF por producto)
--
-- Cada producto de venta puede tener uno o varios materiales que explican cómo
-- prepararlo: un video o un PDF, subido al bucket privado "product-guides" o
-- como enlace externo (YouTube, Vimeo, Google Drive…).
--
--   - Lo consulta todo el personal activo del negocio (el barista en
--     /preparacion y desde cada comanda en Ventas).
--   - Solo quien administra el negocio (administrador o supervisor técnico)
--     lo sube, edita, borra y decide si queda "disponible para el cliente".
--   - El cliente final solo ve, desde el catálogo (/c/:slug), los materiales
--     marcados como disponibles, a través de get_public_product_guides_cafexis.
--
-- El bucket es privado: los archivos se abren con URLs firmadas que vencen.
-- Así, al quitar "disponible para el cliente", un enlace que el cliente haya
-- guardado deja de funcionar cuando vence, y un material interno nunca queda
-- expuesto por adivinar o compartir su URL.
--
-- Se puede ejecutar más de una vez. Requiere 0001-0017 aplicadas. No requiere
-- redesplegar Edge Functions.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabla
-- -----------------------------------------------------------------------------

create table if not exists product_guides_cafexis (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses_cafexis (id) on delete cascade,
  product_id uuid not null references products_cafexis (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 120),
  description text check (description is null or char_length(description) <= 1000),
  kind text not null check (kind in ('video', 'pdf')),
  -- Exactamente una de las dos: archivo en el bucket o enlace externo.
  storage_path text,
  external_url text check (external_url is null or (external_url ~* '^https?://' and char_length(external_url) <= 2000)),
  visible_to_customers boolean not null default false,
  created_by uuid default auth.uid() references app_users_cafexis (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_guides_cafexis_one_source check ((storage_path is null) <> (external_url is null))
);

create index if not exists product_guides_cafexis_business_id_idx on product_guides_cafexis (business_id);
create index if not exists product_guides_cafexis_product_id_idx on product_guides_cafexis (product_id);

comment on table product_guides_cafexis is 'Videos y PDF que explican cómo preparar un producto. Los consulta el personal; el cliente final solo los marcados con visible_to_customers.';
comment on column product_guides_cafexis.storage_path is 'Ruta en el bucket privado product-guides ("<business_id>/<uuid>.<ext>"). Vacío si es un enlace externo.';
comment on column product_guides_cafexis.visible_to_customers is 'Si el cliente final ve este material desde el catálogo público del negocio.';

drop trigger if exists product_guides_cafexis_set_updated_at on product_guides_cafexis;
create trigger product_guides_cafexis_set_updated_at before update on product_guides_cafexis
  for each row execute function set_updated_at_cafexis();

-- -----------------------------------------------------------------------------
-- 2. Coherencia entre negocios
--
-- El producto debe ser del mismo negocio, y el archivo debe estar en la
-- carpeta de ese negocio. Lo segundo es clave: sin esta validación, un
-- administrador podría apuntar una guía "visible para el cliente" a un
-- archivo privado de otro negocio y exponerlo por el catálogo público.
-- -----------------------------------------------------------------------------

create or replace function guard_product_guide_cafexis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from products_cafexis p
    where p.id = new.product_id and p.business_id = new.business_id
  ) then
    raise exception 'Referencia inválida: el producto pertenece a otro negocio.';
  end if;

  if new.storage_path is not null and split_part(new.storage_path, '/', 1) <> new.business_id::text then
    raise exception 'Referencia inválida: el archivo pertenece a otro negocio.';
  end if;

  return new;
end;
$$;

revoke execute on function guard_product_guide_cafexis() from public, anon, authenticated;

drop trigger if exists product_guides_cafexis_guard_business on product_guides_cafexis;
create trigger product_guides_cafexis_guard_business
  before insert or update of business_id, product_id, storage_path on product_guides_cafexis
  for each row execute function guard_product_guide_cafexis();

-- -----------------------------------------------------------------------------
-- 3. Row Level Security
--
-- Lectura: todo el personal activo del negocio (o el supervisor técnico).
-- Escritura: solo quien administra el negocio; crear exige suscripción
-- vigente, igual que los productos (0014). Soporte nunca escribe (0011).
-- -----------------------------------------------------------------------------

alter table product_guides_cafexis enable row level security;

drop policy if exists product_guides_cafexis_select on product_guides_cafexis;
create policy product_guides_cafexis_select on product_guides_cafexis
  for select using (business_id = auth_business_id_cafexis() or auth_is_supervisor_cafexis());

drop policy if exists product_guides_cafexis_insert on product_guides_cafexis;
create policy product_guides_cafexis_insert on product_guides_cafexis
  for insert with check (
    auth_is_supervisor_cafexis()
    or (auth_can_manage_business_cafexis(business_id) and is_business_subscription_active_cafexis(business_id))
  );

drop policy if exists product_guides_cafexis_update on product_guides_cafexis;
create policy product_guides_cafexis_update on product_guides_cafexis
  for update using (auth_can_manage_business_cafexis(business_id))
  with check (auth_can_manage_business_cafexis(business_id));

drop policy if exists product_guides_cafexis_delete on product_guides_cafexis;
create policy product_guides_cafexis_delete on product_guides_cafexis
  for delete using (auth_can_manage_business_cafexis(business_id));

drop policy if exists product_guides_cafexis_no_support_insert on product_guides_cafexis;
create policy product_guides_cafexis_no_support_insert on product_guides_cafexis
  as restrictive for insert with check (not auth_is_support_cafexis());
drop policy if exists product_guides_cafexis_no_support_update on product_guides_cafexis;
create policy product_guides_cafexis_no_support_update on product_guides_cafexis
  as restrictive for update using (not auth_is_support_cafexis());
drop policy if exists product_guides_cafexis_no_support_delete on product_guides_cafexis;
create policy product_guides_cafexis_no_support_delete on product_guides_cafexis
  as restrictive for delete using (not auth_is_support_cafexis());

-- -----------------------------------------------------------------------------
-- 4. Lectura pública para el catálogo (/c/:slug)
--
-- Igual que get_public_catalog_cafexis (0010): security definer y solo lo que
-- un visitante debe ver, es decir, los materiales marcados como disponibles.
-- -----------------------------------------------------------------------------

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
  where g.business_id = p_business_id and g.visible_to_customers
  order by g.created_at;
$$;

revoke execute on function get_public_product_guides_cafexis(uuid) from public;
grant execute on function get_public_product_guides_cafexis(uuid) to anon, authenticated;

-- ¿Este archivo del bucket pertenece a un material disponible para el cliente?
-- Lo usa la política de lectura del bucket (el visitante no puede leer la
-- tabla directamente por RLS).
create or replace function is_public_product_guide_object_cafexis(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from product_guides_cafexis g
    where g.storage_path = p_name and g.visible_to_customers
  );
$$;

revoke execute on function is_public_product_guide_object_cafexis(text) from public;
grant execute on function is_public_product_guide_object_cafexis(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Bucket privado "product-guides"
--
-- 50 MB por archivo (el máximo del plan gratuito de Supabase; en planes pagos
-- se puede subir aquí y en Storage → Settings). Solo PDF, MP4 y WebM: son
-- los formatos que reproducen todos los navegadores y las apps. Para videos
-- más pesados se usa un enlace externo (YouTube "no listado", Vimeo, Drive).
--
-- Convención de path: "<business_id>/<uuid>.<ext>" (ver uploadGuideFile en
-- productGuidesService.ts).
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-guides', 'product-guides', false, 52428800, array['application/pdf', 'video/mp4', 'video/webm'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Lectura (y por tanto URLs firmadas): el personal del negocio dueño de la
-- carpeta, el supervisor técnico, o cualquiera si el archivo pertenece a un
-- material disponible para el cliente.
drop policy if exists product_guides_read on storage.objects;
create policy product_guides_read on storage.objects
  for select using (
    bucket_id = 'product-guides'
    and (
      auth_is_supervisor_cafexis()
      or (storage.foldername(name))[1] = auth_business_id_cafexis()::text
      or is_public_product_guide_object_cafexis(name)
    )
  );

-- Escritura: mismo criterio que las fotos de producto (0015).
drop policy if exists product_guides_insert on storage.objects;
create policy product_guides_insert on storage.objects
  for insert with check (
    bucket_id = 'product-guides'
    and not auth_is_support_cafexis()
    and (
      auth_is_supervisor_cafexis()
      or ((storage.foldername(name))[1] = auth_business_id_cafexis()::text
          and auth_can_manage_business_cafexis(auth_business_id_cafexis()))
    )
  );

drop policy if exists product_guides_update on storage.objects;
create policy product_guides_update on storage.objects
  for update using (
    bucket_id = 'product-guides'
    and not auth_is_support_cafexis()
    and (
      auth_is_supervisor_cafexis()
      or ((storage.foldername(name))[1] = auth_business_id_cafexis()::text
          and auth_can_manage_business_cafexis(auth_business_id_cafexis()))
    )
  );

drop policy if exists product_guides_delete on storage.objects;
create policy product_guides_delete on storage.objects
  for delete using (
    bucket_id = 'product-guides'
    and not auth_is_support_cafexis()
    and (
      auth_is_supervisor_cafexis()
      or ((storage.foldername(name))[1] = auth_business_id_cafexis()::text
          and auth_can_manage_business_cafexis(auth_business_id_cafexis()))
    )
  );

notify pgrst, 'reload schema';
