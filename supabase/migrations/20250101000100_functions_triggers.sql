-- =============================================================================
-- Drawer Inventory - functions & triggers
-- =============================================================================

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists items_set_updated_at on public.items;
create trigger items_set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Role helpers
--
-- SECURITY DEFINER so that RLS policies on `profiles` do not recurse when a
-- policy on another table needs to read the caller's role.
-- ---------------------------------------------------------------------------
create or replace function public.current_app_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- Provision a profile whenever an auth user is created.
--
-- The role comes from the user's metadata, which is only writable with the
-- service-role key (see scripts/seed-users.ts). Anything else defaults to the
-- least-privileged role.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data ->> 'role', 'viewer');
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    new.email,
    case when requested_role = 'admin' then 'admin'::public.user_role else 'viewer'::public.user_role end
  )
  on conflict (id) do update
    set name  = excluded.name,
        email = excluded.email,
        role  = excluded.role;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Activity log
--
-- Written only by this trigger (SECURITY DEFINER). `activity_logs` has no
-- INSERT/UPDATE/DELETE policy at all, so no client can forge or tamper with
-- history - it is append-only from the database's point of view.
-- ---------------------------------------------------------------------------
create or replace function public.log_item_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  -- Guard the FK: seed/SQL-console writes have no authenticated actor.
  if actor is not null and not exists (select 1 from public.profiles where id = actor) then
    actor := null;
  end if;

  if tg_op = 'INSERT' then
    insert into public.activity_logs (user_id, item_id, item_name, action, field, new_value)
    values (actor, new.id, new.name, 'created', 'quantity', new.quantity::text);
    return new;

  elsif tg_op = 'DELETE' then
    insert into public.activity_logs (user_id, item_id, item_name, action)
    values (actor, null, old.name, 'deleted');
    return old;

  elsif tg_op = 'UPDATE' then
    if new.quantity is distinct from old.quantity then
      insert into public.activity_logs (user_id, item_id, item_name, action, field, old_value, new_value)
      values (actor, new.id, new.name, 'quantity_changed', 'quantity', old.quantity::text, new.quantity::text);
    end if;

    -- A single "updated" entry covers all non-quantity edits so a form save
    -- does not spam the history with one row per field.
    if (new.name, new.category_id, new.unit, new.description, new.image_url, new.icon)
       is distinct from
       (old.name, old.category_id, old.unit, old.description, old.image_url, old.icon)
    then
      insert into public.activity_logs (user_id, item_id, item_name, action)
      values (actor, new.id, new.name, 'updated');
    end if;

    return new;
  end if;

  return null;
end;
$$;

drop trigger if exists items_log_activity on public.items;
create trigger items_log_activity
  after insert or update or delete on public.items
  for each row execute function public.log_item_activity();

-- ---------------------------------------------------------------------------
-- adjust_item_quantity: atomic +/- used by the quick quantity controls.
--
-- SECURITY INVOKER (the default) on purpose: the UPDATE below runs under the
-- caller's RLS policies, so a viewer's call matches zero rows and raises.
-- Doing the arithmetic in SQL avoids a read-modify-write race between two
-- rapid taps and keeps the CHECK (quantity >= 0) authoritative.
-- ---------------------------------------------------------------------------
create or replace function public.adjust_item_quantity(p_item_id uuid, p_delta integer)
returns public.items
language plpgsql
set search_path = public
as $$
declare
  updated public.items;
begin
  update public.items
     set quantity = greatest(0, quantity + p_delta)
   where id = p_item_id
  returning * into updated;

  if updated.id is null then
    raise exception 'Item not found, or you do not have permission to change it'
      using errcode = '42501';
  end if;

  return updated;
end;
$$;

-- ---------------------------------------------------------------------------
-- delete_category: the safe way to remove a category that is still in use.
--
-- Pass p_reassign_to to move the affected items to another category first.
-- Without it, the FK's ON DELETE RESTRICT blocks the delete and we surface a
-- readable error instead of a raw constraint violation.
-- ---------------------------------------------------------------------------
create or replace function public.delete_category(p_category_id uuid, p_reassign_to uuid default null)
returns void
language plpgsql
set search_path = public
as $$
declare
  in_use integer;
  moved  integer;
  gone   integer;
begin
  if p_reassign_to is not null then
    if p_reassign_to = p_category_id then
      raise exception 'Cannot reassign a category to itself';
    end if;

    if not exists (select 1 from public.categories where id = p_reassign_to) then
      raise exception 'The replacement category does not exist';
    end if;

    update public.items
       set category_id = p_reassign_to
     where category_id = p_category_id;

    get diagnostics moved = row_count;
  end if;

  select count(*) into in_use from public.items where category_id = p_category_id;

  if in_use > 0 then
    raise exception 'This category still has % item(s). Reassign them first.', in_use;
  end if;

  delete from public.categories where id = p_category_id;
  get diagnostics gone = row_count;

  if gone = 0 then
    raise exception 'Category not found, or you do not have permission to delete it'
      using errcode = '42501';
  end if;
end;
$$;
