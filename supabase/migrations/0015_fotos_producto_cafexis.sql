-- =============================================================================
-- Cafexis · Fotos de producto
--
-- products_cafexis.image_url y get_public_catalog_cafexis (0010) ya existían;
-- faltaba dónde guardar las fotos. Este bucket las hace públicas para que el
-- cliente las vea en el catálogo (/c/:slug) sin iniciar sesión.
--
-- Límites en el servidor, no solo en el formulario: 5 MB por archivo y solo
-- JPG, PNG o WebP. Se deja SVG por fuera porque puede ejecutar scripts y este
-- bucket se sirve público.
--
-- Se puede ejecutar más de una vez. Antes se llamó
-- 0013_fotos_producto_cafexis.sql; volver a correrla sobre esa versión ajusta
-- los permisos a las reglas de la 0014.
--
-- Requiere 0001-0014 aplicadas.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Convención de path: "<business_id>/<uuid>.<ext>" (ver uploadProductImage en
-- productsService.ts). Mismo criterio que el logo del negocio en la 0014: solo
-- quien administra el negocio, o el supervisor técnico que lo está operando.

drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists product_images_insert on storage.objects;
create policy product_images_insert on storage.objects
  for insert with check (
    bucket_id = 'product-images'
    and not auth_is_support_cafexis()
    and (
      auth_is_supervisor_cafexis()
      or ((storage.foldername(name))[1] = auth_business_id_cafexis()::text
          and auth_can_manage_business_cafexis(auth_business_id_cafexis()))
    )
  );

drop policy if exists product_images_update on storage.objects;
create policy product_images_update on storage.objects
  for update using (
    bucket_id = 'product-images'
    and not auth_is_support_cafexis()
    and (
      auth_is_supervisor_cafexis()
      or ((storage.foldername(name))[1] = auth_business_id_cafexis()::text
          and auth_can_manage_business_cafexis(auth_business_id_cafexis()))
    )
  );

drop policy if exists product_images_delete on storage.objects;
create policy product_images_delete on storage.objects
  for delete using (
    bucket_id = 'product-images'
    and not auth_is_support_cafexis()
    and (
      auth_is_supervisor_cafexis()
      or ((storage.foldername(name))[1] = auth_business_id_cafexis()::text
          and auth_can_manage_business_cafexis(auth_business_id_cafexis()))
    )
  );
