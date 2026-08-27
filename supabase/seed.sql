-- =============================================================================
-- Drawer Inventory - starter data
-- =============================================================================
-- Everything inserted here is flagged `is_demo = true`. Settings -> "Remove
-- demo data" deletes exactly these rows, so the sample content is easy to
-- clear once you have added your own.
-- =============================================================================

-- Tunables live in the database rather than in code so they can be changed
-- without a redeploy. `low_stock_threshold` drives the Low Stock card/filter.
insert into public.app_settings (key, value)
values ('low_stock_threshold', '1'::jsonb)
on conflict (key) do nothing;

insert into public.categories (name, is_demo)
values
  ('Snacks',       true),
  ('Drinks',       true),
  ('Chocolate',    true),
  ('Biscuits',     true),
  ('Instant Food', true),
  ('Other',        true)
on conflict do nothing;

insert into public.items (name, category_id, quantity, unit, description, icon, is_demo)
select v.name, c.id, v.quantity, v.unit, v.description, v.icon, true
from (values
  ('Biscuits',  'Snacks',       2, 'packets', 'Chocolate biscuits',        '🍪'),
  ('Chocolate', 'Chocolate',    1, 'bar',     'Dark chocolate, 70%',       '🍫'),
  ('Peanuts',   'Snacks',       3, 'packets', 'Roasted and salted',        '🥜'),
  ('Chips',     'Snacks',       0, 'packets', 'Ran out - restock these',   '🥔'),
  ('Juice',     'Drinks',       0, 'bottles', 'Orange juice',              '🧃'),
  ('Maggi',     'Instant Food', 4, 'packets', 'Two-minute noodles',        '🍜')
) as v(name, category, quantity, unit, description, icon)
join public.categories c on lower(c.name) = lower(v.category)
where not exists (
  select 1 from public.items i where lower(i.name) = lower(v.name)
);
