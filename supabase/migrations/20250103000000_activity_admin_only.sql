-- ---------------------------------------------------------------------------
-- Restrict the audit trail to admins.
--
-- Viewers previously had read access to `activity_logs`. Hiding the Activity
-- link in the sidebar is cosmetic; this policy is what actually stops a viewer
-- reading the history straight from the database API.
--
-- Still deliberately no INSERT/UPDATE/DELETE policy: the trail is append-only,
-- written solely by the SECURITY DEFINER trigger on `items`.
-- ---------------------------------------------------------------------------
drop policy if exists "activity: read for signed-in users" on public.activity_logs;
drop policy if exists "activity: read for admins" on public.activity_logs;

create policy "activity: read for admins"
  on public.activity_logs for select
  to authenticated
  using (public.is_admin());
