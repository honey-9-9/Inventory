-- =============================================================================
-- Replace the emoji `icon` with real images
-- =============================================================================
-- Items are now illustrated with a photo instead of an emoji. `image_url`
-- already existed for external URLs; it now also holds app-relative paths like
-- `/uploads/<id>.jpg` for files uploaded from a camera or the file picker.
--
-- Items with no picture fall back to a letter avatar in the UI, so nothing
-- needs a placeholder value here.
-- =============================================================================

alter table public.items drop column if exists icon;

-- The activity trigger listed `icon` among the fields that count as an edit,
-- so it has to be redefined without it. Everything else is unchanged.
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
    if (new.name, new.category_id, new.unit, new.description, new.image_url)
       is distinct from
       (old.name, old.category_id, old.unit, old.description, old.image_url)
    then
      insert into public.activity_logs (user_id, item_id, item_name, action)
      values (actor, new.id, new.name, 'updated');
    end if;

    return new;
  end if;

  return null;
end;
$$;
