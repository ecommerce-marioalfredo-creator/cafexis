-- =============================================================================
-- Cafexis · Clientes invitados (sin cuenta)
--
-- El catálogo deja continuar "sin cuenta" con el acceso anónimo de Supabase
-- (Authentication → Providers → Allow anonymous sign-ins). Para la base, un
-- invitado es una sesión 'authenticated' más: pedir, ver sus pedidos, recibir
-- avisos y cancelar ya funcionan con auth.uid(), y los datos del negocio siguen
-- cerrados porque no tiene fila en app_users_cafexis.
--
-- Lo único que cambia: registrar un negocio exige una cuenta real. Con accesos
-- anónimos, un script podría abrir negocios sin límite y quedar como su
-- administrador.
--
-- Se puede ejecutar más de una vez. Requiere 0001-0016 aplicadas. No requiere
-- redesplegar Edge Functions.
-- =============================================================================

comment on table customers_cafexis is 'Perfil del cliente final, con cuenta de Google o invitado (sesión anónima, email vacío), sin negocio fijo: puede estar vinculado a varios negocios, ver customer_businesses_cafexis.';

-- Igual que en la 0013, agregando el bloqueo a las sesiones anónimas.
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
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Para registrar un negocio necesitas crear una cuenta.';
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

notify pgrst, 'reload schema';
