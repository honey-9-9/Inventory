-- =============================================================================
-- Drawer Inventory - row level security
-- =============================================================================
-- The application never uses the service-role key at request time; every read
-- and write is made with the signed-in user's JWT. These policies - not the
-- hidden buttons in the UI - are what actually stops a viewer from mutating
-- data, including via a hand-crafted request to the REST API.
-- =============================================================================

alter table public.profiles      enable row level security;
alter table public.categories    enable row level security;
alter table public.items         enable row level security;
alter table public.app_settings  enable row level security;
alter table public.activity_logs enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists "profiles: read own or admin reads all" on public.profiles;
create policy "profiles: read own or admin reads all"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

-- No INSERT/UPDATE/DELETE policies: roles are assigned out-of-band with the
-- service-role key, so nobody can promote themselves to admin through the API.

-- ---------------------------------------------------------------------------
-- categories - everyone signed in reads, only admins write
-- ---------------------------------------------------------------------------
drop policy if exists "categories: read for signed-in users" on public.categories;
create policy "categories: read for signed-in users"
  on public.categories for select
  to authenticated
  using (true);

drop policy if exists "categories: admin inserts" on public.categories;
create policy "categories: admin inserts"
  on public.categories for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "categories: admin updates" on public.categories;
create policy "categories: admin updates"
  on public.categories for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "categories: admin deletes" on public.categories;
create policy "categories: admin deletes"
  on public.categories for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- items - everyone signed in reads, only admins write
-- ---------------------------------------------------------------------------
drop policy if exists "items: read for signed-in users" on public.items;
create policy "items: read for signed-in users"
  on public.items for select
  to authenticated
  using (true);

drop policy if exists "items: admin inserts" on public.items;
create policy "items: admin inserts"
  on public.items for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "items: admin updates" on public.items;
create policy "items: admin updates"
  on public.items for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "items: admin deletes" on public.items;
create policy "items: admin deletes"
  on public.items for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- app_settings - readable by all signed-in users, writable by admins
-- ---------------------------------------------------------------------------
drop policy if exists "settings: read for signed-in users" on public.app_settings;
create policy "settings: read for signed-in users"
  on public.app_settings for select
  to authenticated
  using (true);

drop policy if exists "settings: admin upserts" on public.app_settings;
create policy "settings: admin upserts"
  on public.app_settings for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "settings: admin updates" on public.app_settings;
create policy "settings: admin updates"
  on public.app_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- activity_logs - read-only for every signed-in user.
--
-- Deliberately no INSERT/UPDATE/DELETE policy: the audit trail can only be
-- appended by the SECURITY DEFINER trigger on `items`.
-- ---------------------------------------------------------------------------
drop policy if exists "activity: read for signed-in users" on public.activity_logs;
create policy "activity: read for signed-in users"
  on public.activity_logs for select
  to authenticated
  using (true);

-- Table-level privileges (the GRANT layer these policies sit on top of) are
-- applied in 20250101000300_grants.sql.
