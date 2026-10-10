-- =============================================================================
-- Cafexis · Fase 1 — Datos base (Inventario, Configuración, Proveedores, Lotes)
--
-- Habilita la escritura completa de los módulos base de los que dependen el
-- resto de flujos (recetas, compras, trazabilidad hasta el producto
-- empacado). El frontend ya podía leer estas tablas; esta migración solo
-- añade lo que faltaba en el esquema para poder crear/editar desde la app:
--
--   1. products_cafexis.coffee_lot_id: liga un producto empacado con el lote
--      de café del que proviene (relación simple 1 lote -> muchos productos).
--   2. Bucket de Supabase Storage "business-logos" para subir el logo del
--      negocio desde Configuración, con políticas RLS que solo permiten a
--      cada negocio gestionar su propio archivo.
--
-- No modifica ninguna migración anterior ni sus políticas: inventory_items_-
-- cafexis, suppliers_cafexis, coffee_lots_cafexis y businesses_cafexis ya
-- tenían insert/update/delete filtrados por business_id en 0002_rls_cafexis,
-- que es todo lo que necesitan los formularios nuevos.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Lote de origen de un producto empacado
-- -----------------------------------------------------------------------------

alter table products_cafexis
  add column coffee_lot_id uuid references coffee_lots_cafexis (id) on delete set null;

comment on column products_cafexis.coffee_lot_id is 'Lote de café (coffee_lots_cafexis) del que proviene este producto, cuando es café empacado. Opcional: no aplica a bebidas preparadas.';

create index products_cafexis_coffee_lot_id_idx on products_cafexis (coffee_lot_id);

-- -----------------------------------------------------------------------------
-- 2. Storage: logo del negocio
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('business-logos', 'business-logos', true)
on conflict (id) do nothing;

-- Convención de path: "<business_id>/logo.<ext>". storage.foldername(name)
-- devuelve el arreglo de segmentos de la ruta; el primero es el business_id,
-- comparado contra el negocio del usuario autenticado (mismo helper que usa
-- el resto del esquema, ver 0002_rls_cafexis.sql).

create policy business_logos_public_read on storage.objects
  for select using (bucket_id = 'business-logos');

create policy business_logos_insert on storage.objects
  for insert with check (
    bucket_id = 'business-logos'
    and (storage.foldername(name))[1] = auth_business_id_cafexis()::text
  );

create policy business_logos_update on storage.objects
  for update using (
    bucket_id = 'business-logos'
    and (storage.foldername(name))[1] = auth_business_id_cafexis()::text
  );

create policy business_logos_delete on storage.objects
  for delete using (
    bucket_id = 'business-logos'
    and (storage.foldername(name))[1] = auth_business_id_cafexis()::text
  );
