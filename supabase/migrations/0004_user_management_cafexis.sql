-- =============================================================================
-- Cafexis · Gestión de usuarios internos y roles
--
-- Añade el flujo de invitación por correo (sin afectar la sesión de quien
-- invita, a diferencia de auth.signUp) y refuerza las políticas de
-- app_users_cafexis: hoy cualquier miembro de un negocio podía editar la
-- fila de otro miembro (la policy de update solo miraba business_id, no el
-- rol de quien edita). Con esta migración, solo 'administrador' (de su
-- propio negocio) o 'supervisor_tecnico' (de cualquiera) pueden gestionar
-- usuarios, y nadie puede cambiarse su propio rol salvo que ya sea
-- supervisor técnico.
-- =============================================================================

create type invitation_status_cafexis as enum ('pendiente', 'aceptada', 'expirada');

create table user_invitations_cafexis (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses_cafexis (id) on delete cascade,
  email text not null,
  name text not null,
  role user_role_cafexis not null,
  invited_by uuid references app_users_cafexis (id) on delete set null,
  status invitation_status_cafexis not null default 'pendiente',
  created_at timestamptz not null default now()
);

create index user_invitations_cafexis_business_id_idx on user_invitations_cafexis (business_id);
comment on table user_invitations_cafexis is 'Invitaciones enviadas a nuevos usuarios internos; se marca aceptada cuando la persona confirma su cuenta en auth.users.';

-- -----------------------------------------------------------------------------
-- Helper: ¿el usuario autenticado es administrador o supervisor técnico?
-- (a diferencia de auth_business_id_cafexis/auth_is_supervisor_cafexis, ya
-- creados en 0002_rls_cafexis.sql, este combina ambos criterios para no
-- repetir la condición en cada policy de gestión de usuarios.)
-- -----------------------------------------------------------------------------

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
      where id = auth.uid() and business_id = target_business_id and role = 'administrador'
    );
$$;

-- -----------------------------------------------------------------------------
-- Reemplazar las políticas de update/delete de app_users_cafexis (creadas en
-- 0002_rls_cafexis.sql) por versiones que exigen rol de gestión.
-- -----------------------------------------------------------------------------

drop policy if exists app_users_cafexis_update on app_users_cafexis;

create policy app_users_cafexis_update on app_users_cafexis
  for update using (auth_can_manage_business_users_cafexis(business_id));

create policy app_users_cafexis_delete on app_users_cafexis
  for delete using (auth_can_manage_business_users_cafexis(business_id));

-- -----------------------------------------------------------------------------
-- Trigger: nadie puede cambiar su propio rol, salvo que ya sea supervisor
-- técnico. Esto no puede expresarse solo con una policy de RLS porque RLS no
-- distingue "qué columna cambió" — necesita comparar OLD.role vs NEW.role.
-- -----------------------------------------------------------------------------

create or replace function prevent_self_role_escalation_cafexis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id and new.role <> old.role and not auth_is_supervisor_cafexis() then
    raise exception 'No puedes cambiar tu propio rol.';
  end if;
  return new;
end;
$$;

create trigger app_users_cafexis_prevent_self_role_escalation
  before update of role on app_users_cafexis
  for each row execute function prevent_self_role_escalation_cafexis();

-- -----------------------------------------------------------------------------
-- RLS de user_invitations_cafexis: mismo criterio que la gestión de usuarios.
-- -----------------------------------------------------------------------------

alter table user_invitations_cafexis enable row level security;

create policy user_invitations_cafexis_select on user_invitations_cafexis
  for select using (auth_can_manage_business_users_cafexis(business_id));

create policy user_invitations_cafexis_insert on user_invitations_cafexis
  for insert with check (auth_can_manage_business_users_cafexis(business_id));

create policy user_invitations_cafexis_update on user_invitations_cafexis
  for update using (auth_can_manage_business_users_cafexis(business_id));

-- -----------------------------------------------------------------------------
-- Trigger sobre auth.users: cuando alguien acepta una invitación (Supabase
-- crea la fila en auth.users con los metadatos pasados a
-- admin.inviteUserByEmail), se crea automáticamente su perfil en
-- app_users_cafexis y se marca la invitación como aceptada. Así el frontend
-- no depende de un paso manual tras el primer login.
-- -----------------------------------------------------------------------------

create or replace function handle_invited_user_cafexis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_role user_role_cafexis;
  v_name text;
begin
  -- Solo actuar si el usuario trae metadatos de invitación de Cafexis
  -- (evita interferir con signUp normal, que no trae business_id).
  if new.raw_user_meta_data ? 'business_id' then
    v_business_id := (new.raw_user_meta_data ->> 'business_id')::uuid;
    v_role := (new.raw_user_meta_data ->> 'role')::user_role_cafexis;
    v_name := coalesce(new.raw_user_meta_data ->> 'name', new.email);

    insert into app_users_cafexis (id, business_id, name, email, role)
    values (new.id, v_business_id, v_name, new.email, v_role)
    on conflict (id) do nothing;

    update user_invitations_cafexis
    set status = 'aceptada'
    where business_id = v_business_id and email = new.email and status = 'pendiente';
  end if;
  return new;
end;
$$;

create trigger on_auth_user_invited_cafexis
  after insert on auth.users
  for each row execute function handle_invited_user_cafexis();
