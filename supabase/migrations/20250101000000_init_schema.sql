-- =============================================================================
-- Drawer Inventory - core schema
-- =============================================================================
-- Design notes:
--  * `status` (Available / Finished) is intentionally NOT stored. It is a pure
--    function of `items.quantity` (> 0 => available, = 0 => finished) and is
--    derived in SQL filters and in the TypeScript `deriveStatus()` helper.
--  * `quantity` is guarded by a CHECK constraint so it can never go negative,
--    even if a client tries to write a negative value directly.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('admin', 'viewer');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- profiles: application-level data for each auth.users row
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null check (length(btrim(name)) > 0),
  email      text not null,
  role       public.user_role not null default 'viewer',
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_email_key on public.profiles (lower(email));
create index if not exists profiles_role_idx on public.profiles (role);

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) > 0),
  -- `is_demo` marks rows created by the sample-data seed so they are easy to
  -- identify and bulk-delete later (see Settings -> Remove demo data).
  is_demo    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists categories_name_key on public.categories (lower(btrim(name)));

-- ---------------------------------------------------------------------------
-- items
-- ---------------------------------------------------------------------------
create table if not exists public.items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) > 0),
  -- `on delete restrict`: a category that still has items cannot be deleted.
  -- The UI offers a reassign-then-delete flow via public.delete_category().
  category_id uuid not null references public.categories (id) on delete restrict,
  quantity    integer not null default 0 check (quantity >= 0),
  unit        text not null check (length(btrim(unit)) > 0),
  description text,
  image_url   text,
  icon        text,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists items_category_id_idx on public.items (category_id);
create index if not exists items_quantity_idx on public.items (quantity);
create index if not exists items_updated_at_idx on public.items (updated_at desc);
-- Supports case-insensitive "search by name" without a full scan.
create index if not exists items_name_lower_idx on public.items (lower(name));

-- ---------------------------------------------------------------------------
-- app_settings: small key/value store so tunables are not hard-coded
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- activity_logs: append-only audit trail, written exclusively by triggers
-- ---------------------------------------------------------------------------
create table if not exists public.activity_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete set null,
  item_id    uuid references public.items (id) on delete set null,
  -- Name is snapshotted so the log stays readable after an item is deleted.
  item_name  text not null,
  action     text not null check (action in ('created', 'updated', 'quantity_changed', 'deleted')),
  field      text,
  old_value  text,
  new_value  text,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_created_at_idx on public.activity_logs (created_at desc);
create index if not exists activity_logs_item_id_idx on public.activity_logs (item_id);
create index if not exists activity_logs_user_id_idx on public.activity_logs (user_id);
