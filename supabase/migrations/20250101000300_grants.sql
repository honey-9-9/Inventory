-- =============================================================================
-- Drawer Inventory - table privileges
-- =============================================================================
-- Postgres access control has two independent layers and BOTH must allow an
-- operation:
--
--   1. GRANT  - may this role touch this table at all?      (this file)
--   2. RLS    - which rows may it touch?                    (…_rls_policies.sql)
--
-- Granting INSERT/UPDATE/DELETE to `authenticated` is not a loosening: without
-- a matching RLS policy every one of those statements still affects zero rows.
-- The admin-only policies are what actually decide who may write.
--
-- `anon` is granted nothing, so an unauthenticated request cannot read the
-- inventory even though the anon key is public.
-- =============================================================================

grant usage on schema public to authenticated, service_role;

-- Read-only for every signed-in user; RLS narrows writes to admins.
grant select, insert, update, delete on public.items      to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update          on public.app_settings to authenticated;

-- No write privilege at all: roles are assigned out-of-band, and history is
-- append-only via the SECURITY DEFINER trigger on `items`.
grant select on public.profiles      to authenticated;
grant select on public.activity_logs to authenticated;

-- The service role is used only by scripts/seed-users.ts.
grant select, insert, update, delete
  on public.items, public.categories, public.profiles,
     public.app_settings, public.activity_logs
  to service_role;

grant execute on function public.adjust_item_quantity(uuid, integer) to authenticated, service_role;
grant execute on function public.delete_category(uuid, uuid)         to authenticated, service_role;
grant execute on function public.is_admin()                          to authenticated, service_role;
grant execute on function public.current_app_role()                  to authenticated, service_role;

-- Belt and braces: make sure the anonymous role really has nothing.
revoke all on public.items, public.categories, public.profiles,
              public.app_settings, public.activity_logs
  from anon;

revoke execute on function public.adjust_item_quantity(uuid, integer) from anon;
revoke execute on function public.delete_category(uuid, uuid)         from anon;
