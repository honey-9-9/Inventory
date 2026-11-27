-- ---------------------------------------------------------------------------
-- Let a viewer take things out of the drawer.
--
-- A viewer is the person actually eating the snacks, so they need to be able
-- to record what they used. They still must not be able to add stock, rename,
-- edit, delete, or touch categories and settings.
--
-- RLS alone cannot express "may change this one column, in one direction", so
-- `items` stays admin-only for direct writes and this function becomes the
-- single, narrow opening: SECURITY DEFINER so it can update the row, with the
-- rule checked explicitly inside. It takes only an item id and a delta, and
-- touches nothing but `quantity`.
--
-- `search_path` is pinned so a caller cannot shadow the tables it resolves.
-- `auth.uid()` still reads the caller's JWT under SECURITY DEFINER, so the
-- audit trigger keeps attributing the change to the viewer who made it.
-- ---------------------------------------------------------------------------
create or replace function public.adjust_item_quantity(p_item_id uuid, p_delta integer)
returns public.items
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.items;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to change a quantity'
      using errcode = '42501';
  end if;

  -- The whole point of the function: viewers may only ever decrease.
  if p_delta >= 0 and not public.is_admin() then
    raise exception 'Only an admin can add stock'
      using errcode = '42501';
  end if;

  update public.items
     set quantity = greatest(0, quantity + p_delta)
   where id = p_item_id
  returning * into updated;

  if updated.id is null then
    raise exception 'Item not found' using errcode = '42501';
  end if;

  return updated;
end;
$$;

-- SECURITY DEFINER functions run as the owner, so execute must be granted
-- deliberately and never to anon.
revoke all on function public.adjust_item_quantity(uuid, integer) from public, anon;
grant execute on function public.adjust_item_quantity(uuid, integer) to authenticated;
