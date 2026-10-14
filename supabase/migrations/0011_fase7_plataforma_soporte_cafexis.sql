-- =============================================================================
-- Cafexis · Fase 7 — Plataforma: consola del supervisor técnico y soporte
--
--   1. Rol nuevo "soporte": ve todos los negocios y gestiona casos, pero es
--      de SOLO LECTURA sobre los datos de los negocios (no vende, no ajusta
--      inventario, no cambia precios). Lo garantizan políticas RLS
--      restrictivas y un bloqueo en las RPC de escritura.
--   2. Casos de soporte (tickets): los abren administradores y baristas
--      desde su panel; supervisor técnico y soporte los ven todos, los
--      asignan, cambian estado/prioridad y responden (también con notas
--      internas que el negocio no ve).
--   3. Consola de plataforma: resumen de salud de todos los negocios y
--      detalle de uno, en funciones de solo lectura para el equipo.
--   4. Cierre de huecos de seguridad previos (graves desde que existen los
--      clientes con login de Google, Fase 5):
--        a) la policy de insert de app_users_cafexis (0002) solo exigía
--           id = auth.uid(): cualquier usuario autenticado podía insertarse
--           en cualquier negocio con cualquier rol, incluso supervisor;
--        b) handle_invited_user_cafexis (0004) creaba el perfil con el
--           business_id y rol de raw_user_meta_data, que cualquiera puede
--           escribir al registrarse con signUp: ahora exige una invitación
--           pendiente que coincida;
--        c) un administrador podía ascender a alguien a supervisor técnico.
--
-- IMPORTANTE: después de aplicar esta migración hay que volver a desplegar
-- la Edge Function invite-user (ahora registra la invitación ANTES de
-- enviar el correo; sin eso, las invitaciones nuevas no crean perfil).
--
-- El valor de enum 'soporte' se agrega aquí y, como Postgres no permite
-- usar un valor de enum nuevo en la misma transacción, en este archivo
-- siempre se compara como texto (role::text = 'soporte').
--
-- Requiere 0001-0010 aplicadas.
-- =============================================================================

alter type user_role_cafexis add value if not exists 'soporte';

-- -----------------------------------------------------------------------------
-- 1. Helpers de rol
-- -----------------------------------------------------------------------------

create or replace function auth_is_support_cafexis()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from app_users_cafexis
    where id = auth.uid() and role::text = 'soporte'
  );
$$;

-- Equipo de plataforma: supervisor técnico + soporte (activos).
create or replace function auth_is_platform_staff_cafexis()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from app_users_cafexis
    where id = auth.uid() and active and role::text in ('supervisor_tecnico', 'soporte')
  );
$$;

create or replace function require_platform_staff_cafexis()
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if not auth_is_platform_staff_cafexis() then
    raise exception 'Solo el supervisor técnico y el equipo de soporte pueden usar la consola.';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Soporte es de solo lectura sobre los datos de los negocios
-- -----------------------------------------------------------------------------

-- Políticas RESTRICTIVAS: se combinan con AND con las existentes, así que
-- bloquean la escritura del rol soporte aunque otra política la permita
-- (por ejemplo en el negocio al que pertenece su perfil).
do $$
declare
  t text;
  cmd text;
  tables text[] := array[
    'businesses_cafexis',
    'app_users_cafexis',
    'inventory_items_cafexis',
    'products_cafexis',
    'product_recipe_items_cafexis',
    'coffee_lots_cafexis',
    'orders_cafexis',
    'order_items_cafexis',
    'purchase_orders_cafexis',
    'purchase_order_lines_cafexis',
    'custom_reports_cafexis',
    'business_suppliers_cafexis',
    'suppliers_cafexis',
    'supplier_branches_cafexis',
    'user_invitations_cafexis'
  ];
begin
  foreach t in array tables loop
    foreach cmd in array array['insert', 'update', 'delete'] loop
      execute format('drop policy if exists %I on %I;', t || '_no_support_' || cmd, t);
      if cmd = 'insert' then
        execute format(
          'create policy %I on %I as restrictive for insert with check (not auth_is_support_cafexis());',
          t || '_no_support_' || cmd, t
        );
      else
        execute format(
          'create policy %I on %I as restrictive for %s using (not auth_is_support_cafexis());',
          t || '_no_support_' || cmd, t, cmd
        );
      end if;
    end loop;
  end loop;
end $$;

-- Las RPC de escritura de Fase 2 (y las security definer, que se saltan RLS)
-- resuelven el negocio con esta función: se bloquea aquí al rol soporte.
create or replace function resolve_business_id_cafexis(p_business_id uuid)
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  v_own uuid := auth_business_id_cafexis();
begin
  if auth_is_support_cafexis() then
    raise exception 'El rol soporte es de solo lectura: no puede registrar ventas ni compras.';
  end if;

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

-- -----------------------------------------------------------------------------
-- 3. Cierre de huecos en la creación de usuarios internos
-- -----------------------------------------------------------------------------

-- a + c) Quién puede crear o cambiar perfiles internos. Solo actúa cuando
-- la operación la hace un usuario final (auth.uid() presente); el panel de
-- Supabase, el SQL Editor y el flujo de invitación (sin usuario final)
-- quedan cubiertos por sus propios controles.
create or replace function guard_app_user_changes_cafexis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth_is_supervisor_cafexis() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Autorregistro (RegisterPage): solo como administrador de un negocio
    -- nuevo, todavía sin usuarios.
    if new.id = auth.uid()
       and new.role::text = 'administrador'
       and not exists (select 1 from app_users_cafexis where business_id = new.business_id) then
      return new;
    end if;
    raise exception 'No puedes unirte a un negocio existente ni asignarte ese rol; pide una invitación.';
  end if;

  if new.business_id <> old.business_id then
    raise exception 'Solo el supervisor técnico puede mover un usuario a otro negocio.';
  end if;
  if new.role <> old.role and new.role::text in ('supervisor_tecnico', 'soporte') then
    raise exception 'Solo el supervisor técnico puede asignar los roles de plataforma (supervisor técnico y soporte).';
  end if;
  return new;
end;
$$;

drop trigger if exists app_users_cafexis_guard_changes on app_users_cafexis;
create trigger app_users_cafexis_guard_changes
  before insert or update of role, business_id on app_users_cafexis
  for each row execute function guard_app_user_changes_cafexis();

-- Invitaciones a roles de plataforma: solo el supervisor técnico.
create or replace function guard_invitation_role_cafexis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role::text in ('supervisor_tecnico', 'soporte') and auth.uid() is not null and not auth_is_supervisor_cafexis() then
    raise exception 'Solo el supervisor técnico puede invitar a los roles de plataforma.';
  end if;
  if new.role::text = 'cliente' then
    raise exception 'Los clientes no se invitan: entran con Google desde el catálogo.';
  end if;
  return new;
end;
$$;

drop trigger if exists user_invitations_cafexis_guard_role on user_invitations_cafexis;
create trigger user_invitations_cafexis_guard_role
  before insert or update of role on user_invitations_cafexis
  for each row execute function guard_invitation_role_cafexis();

-- b) El perfil solo se crea si hay una invitación pendiente que coincida
-- (negocio, correo y rol). Antes bastaba con que raw_user_meta_data trajera
-- business_id, y eso lo puede escribir cualquiera al registrarse.
create or replace function handle_invited_user_cafexis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_role text;
  v_name text;
begin
  if not (new.raw_user_meta_data ? 'business_id') then
    return new;
  end if;

  begin
    v_business_id := (new.raw_user_meta_data ->> 'business_id')::uuid;
  exception when others then
    return new;
  end;
  v_role := new.raw_user_meta_data ->> 'role';
  v_name := coalesce(new.raw_user_meta_data ->> 'name', new.email);

  if not exists (
    select 1 from user_invitations_cafexis
    where business_id = v_business_id
      and lower(email) = lower(new.email)
      and role::text = v_role
      and status = 'pendiente'
  ) then
    return new;
  end if;

  insert into app_users_cafexis (id, business_id, name, email, role)
  values (new.id, v_business_id, v_name, new.email, v_role::user_role_cafexis)
  on conflict (id) do nothing;

  update user_invitations_cafexis
  set status = 'aceptada'
  where business_id = v_business_id and lower(email) = lower(new.email) and status = 'pendiente';

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Casos de soporte
-- -----------------------------------------------------------------------------

create sequence if not exists support_case_code_seq_cafexis;

create table support_cases_cafexis (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('CS-' || lpad(nextval('support_case_code_seq_cafexis')::text, 4, '0')),
  business_id uuid not null references businesses_cafexis (id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 140),
  description text not null check (char_length(description) between 1 and 5000),
  category text not null default 'otro'
    check (category in ('inventario', 'ventas', 'compras', 'usuarios', 'reportes', 'cuenta', 'otro')),
  priority text not null default 'media' check (priority in ('baja', 'media', 'alta', 'urgente')),
  status text not null default 'abierto'
    check (status in ('abierto', 'en_progreso', 'esperando_cliente', 'resuelto', 'cerrado')),
  opened_by uuid references app_users_cafexis (id) on delete set null,
  assigned_to uuid references app_users_cafexis (id) on delete set null,
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_cases_cafexis_business_idx on support_cases_cafexis (business_id, status);
create index support_cases_cafexis_status_idx on support_cases_cafexis (status, priority, last_activity_at desc);
create index support_cases_cafexis_assigned_idx on support_cases_cafexis (assigned_to) where assigned_to is not null;

create trigger support_cases_cafexis_set_updated_at before update on support_cases_cafexis
  for each row execute function set_updated_at_cafexis();

comment on table support_cases_cafexis is 'Casos de soporte que abre el personal de un negocio y atiende el equipo de plataforma (supervisor técnico y soporte).';

create table support_case_messages_cafexis (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references support_cases_cafexis (id) on delete cascade,
  author_id uuid references app_users_cafexis (id) on delete set null,
  -- mensaje: visible para todos · nota_interna: solo equipo de plataforma ·
  -- evento: cambio de estado/prioridad/asignación (registro automático).
  kind text not null default 'mensaje' check (kind in ('mensaje', 'nota_interna', 'evento')),
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index support_case_messages_cafexis_case_idx on support_case_messages_cafexis (case_id, created_at);

comment on table support_case_messages_cafexis is 'Conversación de un caso de soporte: mensajes, notas internas del equipo y eventos de cambio de estado.';

-- Lectura directa como defensa en profundidad; la app usa las RPC de abajo.
-- Sin políticas de escritura: todo cambio pasa por las RPC.
alter table support_cases_cafexis enable row level security;
alter table support_case_messages_cafexis enable row level security;

create policy support_cases_cafexis_select on support_cases_cafexis for select
  using (business_id = auth_business_id_cafexis() or auth_is_platform_staff_cafexis());

create policy support_case_messages_cafexis_select on support_case_messages_cafexis for select
  using (
    exists (
      select 1 from support_cases_cafexis c
      where c.id = case_id
        and (c.business_id = auth_business_id_cafexis() or auth_is_platform_staff_cafexis())
    )
    and (kind <> 'nota_interna' or auth_is_platform_staff_cafexis())
  );

-- Perfil interno activo de quien llama (personal de negocio o de plataforma).
create or replace function current_app_user_cafexis()
returns app_users_cafexis
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user app_users_cafexis;
begin
  select * into v_user from app_users_cafexis where id = auth.uid() and active;
  if not found then
    raise exception 'Tu usuario no tiene un perfil interno activo.';
  end if;
  return v_user;
end;
$$;

-- El caso, si quien llama puede verlo (su negocio o equipo de plataforma).
create or replace function visible_support_case_cafexis(p_case_id uuid)
returns support_cases_cafexis
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_case support_cases_cafexis;
begin
  select * into v_case from support_cases_cafexis where id = p_case_id;
  if not found or not (v_case.business_id = auth_business_id_cafexis() or auth_is_platform_staff_cafexis()) then
    raise exception 'Caso de soporte no encontrado.';
  end if;
  return v_case;
end;
$$;

-- Abre un caso. El personal de un negocio lo abre para el suyo; el equipo
-- de plataforma puede abrirlo en nombre de cualquier negocio.
create or replace function open_support_case_cafexis(
  p_subject text,
  p_description text,
  p_category text default 'otro',
  p_priority text default 'media',
  p_business_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user app_users_cafexis := current_app_user_cafexis();
  v_business_id uuid := v_user.business_id;
  v_id uuid;
begin
  if p_business_id is not null and p_business_id <> v_user.business_id then
    if not auth_is_platform_staff_cafexis() then
      raise exception 'Solo puedes abrir casos para tu propio negocio.';
    end if;
    if not exists (select 1 from businesses_cafexis where id = p_business_id) then
      raise exception 'Negocio no encontrado.';
    end if;
    v_business_id := p_business_id;
  end if;

  if char_length(trim(coalesce(p_subject, ''))) < 3 then
    raise exception 'Escribe un asunto de al menos 3 caracteres.';
  end if;
  if char_length(trim(coalesce(p_description, ''))) = 0 then
    raise exception 'Describe el problema.';
  end if;

  insert into support_cases_cafexis (business_id, subject, description, category, priority, opened_by)
  values (v_business_id, trim(p_subject), trim(p_description), coalesce(p_category, 'otro'), coalesce(p_priority, 'media'), v_user.id)
  returning id into v_id;

  return v_id;
end;
$$;

-- Responde un caso. Notas internas: solo el equipo de plataforma. Si
-- responde el negocio a un caso "esperando cliente" o "resuelto", se
-- reabre; la primera respuesta pública del equipo pasa "abierto" a "en
-- progreso" y marca el tiempo de primera respuesta.
create or replace function add_support_case_message_cafexis(p_case_id uuid, p_body text, p_internal boolean default false)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user app_users_cafexis := current_app_user_cafexis();
  v_case support_cases_cafexis := visible_support_case_cafexis(p_case_id);
  v_staff boolean := auth_is_platform_staff_cafexis();
  v_id uuid;
begin
  if char_length(trim(coalesce(p_body, ''))) = 0 then
    raise exception 'El mensaje está vacío.';
  end if;
  if p_internal and not v_staff then
    raise exception 'Solo el equipo de soporte puede dejar notas internas.';
  end if;
  if v_case.status = 'cerrado' then
    raise exception 'El caso % está cerrado; abre uno nuevo si el problema continúa.', v_case.code;
  end if;

  insert into support_case_messages_cafexis (case_id, author_id, kind, body)
  values (p_case_id, v_user.id, case when p_internal then 'nota_interna' else 'mensaje' end, trim(p_body))
  returning id into v_id;

  if v_staff and not p_internal then
    update support_cases_cafexis
    set first_response_at = coalesce(first_response_at, now()),
        status = case when status = 'abierto' then 'en_progreso' else status end,
        last_activity_at = now()
    where id = p_case_id;
  elsif not v_staff and v_case.status in ('esperando_cliente', 'resuelto') then
    update support_cases_cafexis
    set status = 'abierto', resolved_at = null, last_activity_at = now()
    where id = p_case_id;
    insert into support_case_messages_cafexis (case_id, author_id, kind, body)
    values (p_case_id, v_user.id, 'evento', 'Reabrió el caso al responder.');
  else
    update support_cases_cafexis set last_activity_at = now() where id = p_case_id;
  end if;

  return v_id;
end;
$$;

-- Cambia estado, prioridad o asignación. El equipo de plataforma puede todo;
-- el negocio solo puede confirmar la solución (resuelto -> cerrado) o
-- reabrir un caso resuelto. Cada cambio queda como evento en la conversación.
create or replace function update_support_case_cafexis(
  p_case_id uuid,
  p_status text default null,
  p_priority text default null,
  p_assigned_to uuid default null,
  p_unassign boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user app_users_cafexis := current_app_user_cafexis();
  v_case support_cases_cafexis := visible_support_case_cafexis(p_case_id);
  v_staff boolean := auth_is_platform_staff_cafexis();
  v_assignee app_users_cafexis;
  v_events text[] := array[]::text[];
  v_label constant jsonb := '{"abierto": "Abierto", "en_progreso": "En progreso", "esperando_cliente": "Esperando al negocio", "resuelto": "Resuelto", "cerrado": "Cerrado", "baja": "Baja", "media": "Media", "alta": "Alta", "urgente": "Urgente"}';
begin
  if not v_staff then
    if p_priority is not null or p_assigned_to is not null or p_unassign then
      raise exception 'Solo el equipo de soporte puede cambiar la prioridad o la asignación.';
    end if;
    if p_status is not null and not (v_case.status = 'resuelto' and p_status in ('cerrado', 'abierto')) then
      raise exception 'Solo puedes confirmar la solución o reabrir un caso resuelto.';
    end if;
  end if;

  if p_status is not null and p_status <> v_case.status then
    if p_status not in ('abierto', 'en_progreso', 'esperando_cliente', 'resuelto', 'cerrado') then
      raise exception 'Estado no válido: %.', p_status;
    end if;
    update support_cases_cafexis
    set status = p_status,
        resolved_at = case when p_status = 'resuelto' then now() when p_status in ('abierto', 'en_progreso', 'esperando_cliente') then null else resolved_at end,
        closed_at = case when p_status = 'cerrado' then now() else null end
    where id = p_case_id;
    v_events := v_events || format('Estado: %s → %s', v_label ->> v_case.status, v_label ->> p_status);
  end if;

  if p_priority is not null and p_priority <> v_case.priority then
    if p_priority not in ('baja', 'media', 'alta', 'urgente') then
      raise exception 'Prioridad no válida: %.', p_priority;
    end if;
    update support_cases_cafexis set priority = p_priority where id = p_case_id;
    v_events := v_events || format('Prioridad: %s → %s', v_label ->> v_case.priority, v_label ->> p_priority);
  end if;

  if p_unassign and v_case.assigned_to is not null then
    update support_cases_cafexis set assigned_to = null where id = p_case_id;
    v_events := v_events || 'Quitó la asignación'::text;
  elsif p_assigned_to is not null and p_assigned_to is distinct from v_case.assigned_to then
    select * into v_assignee from app_users_cafexis
    where id = p_assigned_to and active and role::text in ('supervisor_tecnico', 'soporte');
    if not found then
      raise exception 'Solo se puede asignar a alguien del equipo de soporte.';
    end if;
    update support_cases_cafexis set assigned_to = p_assigned_to where id = p_case_id;
    v_events := v_events || format('Asignado a %s', v_assignee.name);
  end if;

  if array_length(v_events, 1) > 0 then
    update support_cases_cafexis set last_activity_at = now() where id = p_case_id;
    insert into support_case_messages_cafexis (case_id, author_id, kind, body)
    values (p_case_id, v_user.id, 'evento', array_to_string(v_events, ' · '));
  end if;
end;
$$;

-- Lista de casos visibles para quien llama, con nombres ya resueltos (el
-- rol soporte no puede leer businesses_cafexis de otros negocios).
create or replace function list_support_cases_cafexis(
  p_business_id uuid default null,
  p_statuses text[] default null,
  p_assigned_to_me boolean default false
)
returns table (
  id uuid, code text, business_id uuid, business_name text,
  subject text, category text, priority text, status text,
  opened_by_name text, assigned_to uuid, assigned_to_name text,
  messages integer, first_response_at timestamptz, last_activity_at timestamptz, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.code, c.business_id, b.name,
    c.subject, c.category, c.priority, c.status,
    ob.name, c.assigned_to, asg.name,
    (select count(*)::integer from support_case_messages_cafexis m where m.case_id = c.id and m.kind = 'mensaje'),
    c.first_response_at, c.last_activity_at, c.created_at
  from support_cases_cafexis c
  join businesses_cafexis b on b.id = c.business_id
  left join app_users_cafexis ob on ob.id = c.opened_by
  left join app_users_cafexis asg on asg.id = c.assigned_to
  where (c.business_id = auth_business_id_cafexis() or auth_is_platform_staff_cafexis())
    and (p_business_id is null or c.business_id = p_business_id)
    and (p_statuses is null or c.status = any (p_statuses))
    and (not p_assigned_to_me or c.assigned_to = auth.uid())
  order by
    case c.status when 'cerrado' then 2 when 'resuelto' then 1 else 0 end,
    case c.priority when 'urgente' then 0 when 'alta' then 1 when 'media' then 2 else 3 end,
    c.last_activity_at desc;
$$;

-- Caso completo con su conversación (sin notas internas para el negocio).
create or replace function get_support_case_cafexis(p_case_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_case support_cases_cafexis := visible_support_case_cafexis(p_case_id);
  v_staff boolean := auth_is_platform_staff_cafexis();
begin
  return (
    select jsonb_build_object(
      'id', v_case.id,
      'code', v_case.code,
      'business_id', v_case.business_id,
      'business_name', (select name from businesses_cafexis where id = v_case.business_id),
      'subject', v_case.subject,
      'description', v_case.description,
      'category', v_case.category,
      'priority', v_case.priority,
      'status', v_case.status,
      'opened_by_name', (select name from app_users_cafexis where id = v_case.opened_by),
      'assigned_to', v_case.assigned_to,
      'assigned_to_name', (select name from app_users_cafexis where id = v_case.assigned_to),
      'first_response_at', v_case.first_response_at,
      'resolved_at', v_case.resolved_at,
      'closed_at', v_case.closed_at,
      'created_at', v_case.created_at,
      'last_activity_at', v_case.last_activity_at,
      'messages', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', m.id,
          'kind', m.kind,
          'body', m.body,
          'author_name', u.name,
          'author_is_staff', coalesce(u.role::text in ('supervisor_tecnico', 'soporte'), false),
          'created_at', m.created_at
        ) order by m.created_at)
        from support_case_messages_cafexis m
        left join app_users_cafexis u on u.id = m.author_id
        where m.case_id = v_case.id and (m.kind <> 'nota_interna' or v_staff)
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- Equipo de plataforma (para asignar casos).
create or replace function list_support_staff_cafexis()
returns table (id uuid, name text, role text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform require_platform_staff_cafexis();
  return query
  select u.id, u.name, u.role::text from app_users_cafexis u
  where u.active and u.role::text in ('supervisor_tecnico', 'soporte')
  order by u.name;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Consola de plataforma (solo lectura)
-- -----------------------------------------------------------------------------

-- Salud de todos los negocios. "Hoy" en la zona horaria de quien consulta.
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
  select b.id, b.name, b.type::text, b.slug, b.primary_color, b.logo_url, b.created_at,
    (select count(*)::integer from app_users_cafexis u where u.business_id = b.id and u.active),
    (select max(au.last_sign_in_at) from app_users_cafexis u join auth.users au on au.id = u.id where u.business_id = b.id),
    (select max(o.created_at) from orders_cafexis o where o.business_id = b.id),
    (select count(*)::integer from orders_cafexis o where o.business_id = b.id and o.created_at >= v_today),
    (select coalesce(sum(o.total), 0) from orders_cafexis o where o.business_id = b.id and o.created_at >= v_today),
    (select count(*)::integer from orders_cafexis o where o.business_id = b.id and o.created_at >= now() - interval '7 days'),
    (select coalesce(sum(o.total), 0) from orders_cafexis o where o.business_id = b.id and o.created_at >= now() - interval '7 days'),
    (select count(*)::integer from inventory_items_cafexis i where i.business_id = b.id and i.status = 'bajo'),
    (select count(*)::integer from inventory_items_cafexis i where i.business_id = b.id and i.status = 'agotado'),
    (select count(*)::integer from purchase_orders_cafexis po where po.business_id = b.id and po.status = 'propuesta'),
    (select count(*)::integer from support_cases_cafexis c where c.business_id = b.id and c.status not in ('resuelto', 'cerrado')),
    (select count(*)::integer from support_cases_cafexis c where c.business_id = b.id and c.status not in ('resuelto', 'cerrado') and c.priority = 'urgente')
  from businesses_cafexis b
  order by b.name;
end;
$$;

-- Detalle de un negocio para diagnosticar un caso, sin entrar a operarlo.
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
        where o.business_id = p_business_id and o.created_at >= (v_today - 13)::timestamp at time zone p_tz
        group by 1
      ) s on s.day = d.day::date
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Permisos de ejecución
-- -----------------------------------------------------------------------------

do $$
declare
  f text;
  fns text[] := array[
    'open_support_case_cafexis(text, text, text, text, uuid)',
    'add_support_case_message_cafexis(uuid, text, boolean)',
    'update_support_case_cafexis(uuid, text, text, uuid, boolean)',
    'list_support_cases_cafexis(uuid, text[], boolean)',
    'get_support_case_cafexis(uuid)',
    'list_support_staff_cafexis()',
    'platform_business_overview_cafexis(text)',
    'platform_business_detail_cafexis(uuid, text)'
  ];
begin
  foreach f in array fns loop
    execute format('revoke execute on function %s from public, anon;', f);
    execute format('grant execute on function %s to authenticated;', f);
  end loop;
end $$;

-- Helpers internos: no se exponen como RPC.
revoke execute on function current_app_user_cafexis() from public, anon, authenticated;
revoke execute on function visible_support_case_cafexis(uuid) from public, anon, authenticated;
revoke execute on function require_platform_staff_cafexis() from public, anon, authenticated;

notify pgrst, 'reload schema';
