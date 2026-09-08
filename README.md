# Drawer Inventory

A small personal inventory for the food in your drawer. Two accounts: an
**admin** who manages everything, and a **viewer** who can only look.

Next.js 16 · TypeScript · Tailwind CSS v4 · Supabase (Postgres + Auth + RLS)

---

## Quick start

Pick one of two ways to get a database. **Docker is only needed for option B** —
it runs Supabase on your own machine and has nothing to do with deployment.

### Option A — hosted Supabase (no Docker)

Use this if you are deploying, or if you would rather not install Docker.

1. Create a free project at [supabase.com](https://supabase.com).
2. Copy `.env.example` to `.env.local` and fill in the project URL plus the
   anon and service-role keys from **Project Settings → API**.
3. Apply the schema and sample data:

   ```bash
   npm install
   npx supabase login                         # opens a browser once
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push                       # runs supabase/migrations/
   npm run db:seed-users                      # creates the admin and viewer accounts
   npm run dev                                # http://localhost:3000
   ```

   For the sample items, also run `supabase/seed.sql` in the dashboard's SQL
   editor — `db push` applies migrations only.

4. In **Authentication → URL Configuration**, set the Site URL to your app's
   URL (`http://localhost:3000` while developing).
5. In **Authentication → Sign In / Providers**, turn **off** "Allow new users to
   sign up". The app has no registration page, and this closes the API route
   too. (`supabase/config.toml` does this for the local stack, but that file
   does not apply to a hosted project.)

### Option B — local Supabase (needs Docker)

Everything runs on your machine, nothing leaves it. Good for developing
offline; not used for deployment.

```bash
npm install
cp .env.example .env.local     # then fill in the values printed by the next step
npm run db:start               # starts Postgres + Auth in Docker, applies migrations, seeds data
npm run db:seed-users          # creates the admin and viewer accounts
npm run dev                    # http://localhost:3000
```

`npm run db:start` prints an `API_URL`, `ANON_KEY` and `SERVICE_ROLE_KEY`.
Copy them into `.env.local` before running `db:seed-users`.

### Signing in

Sign in with the credentials in your `.env.local`. The defaults are:

| Role   | Email                 | Password            |
| ------ | --------------------- | ------------------- |
| Admin  | `admin@drawer.local`  | `admin-drawer-2026` |
| Viewer | `viewer@drawer.local` | `viewer-drawer-2026`|

> Change these before using the app anywhere other than your own machine:
> edit `.env.local` and re-run `npm run db:seed-users`.

---

## Environment variables

| Variable                        | Where it is used            | Notes                                            |
| ------------------------------- | --------------------------- | ------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | browser + server            | Safe to expose; RLS protects the data.           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server            | Safe to expose; RLS protects the data.           |
| `SUPABASE_SERVICE_ROLE_KEY`     | `db:seed-users` script only | **Bypasses RLS.** Never imported by app code.    |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME`    | `db:seed-users` | Admin account.   |
| `VIEWER_EMAIL` / `VIEWER_PASSWORD` / `VIEWER_NAME` | `db:seed-users` | Viewer account.  |

Passwords must be at least 8 characters. They are handed to Supabase Auth,
which stores a bcrypt hash — the app never stores a password itself.

---

## How permissions actually work

Hiding buttons is *not* the security model. Every read and write in the request
path uses the signed-in user's JWT with the **anon** key, so Postgres decides
what is allowed. Two layers must both agree:

1. **`GRANT`** (`supabase/migrations/…_grants.sql`) — may this role touch the
   table at all? `anon` is granted nothing.
2. **Row level security** (`…_rls_policies.sql`) — which rows? Writes to
   `items`, `categories` and `app_settings` require `public.is_admin()`.

On top of that:

- `activity_logs` has **no** insert/update/delete policy. History is appended
  only by a `SECURITY DEFINER` trigger on `items`, so it cannot be forged.
- `profiles` has no write policy at all, so no account can promote itself.
  Roles are assigned out-of-band with the service-role key.
- Public sign-up is disabled in `supabase/config.toml`.

`npm run verify:permissions` proves this by talking straight to the Supabase
REST API with real tokens, bypassing the Next.js app entirely — the same thing
someone with the public anon key would do.

---

## Data model

```
profiles(id → auth.users, name, email, role, created_at)
categories(id, name, is_demo, created_at, updated_at)
items(id, name, category_id → categories, quantity, unit,
      description, image_url, is_demo, created_at, updated_at)
app_settings(key, value, updated_at)
activity_logs(id, user_id → profiles, item_id → items, item_name,
              action, field, old_value, new_value, created_at)
```

A few decisions worth knowing:

- **Status is never stored.** `quantity > 0` is Available, `quantity = 0` is
  Finished, derived by `deriveStatus()` and in SQL filters. Quantity and status
  therefore cannot drift apart.
- **Quantity cannot go negative.** A `CHECK (quantity >= 0)` constraint is the
  backstop; `adjust_item_quantity()` clamps at zero; the minus button disables
  at zero.
- **`adjust_item_quantity(item, delta)`** does the arithmetic inside the
  database, so two fast taps cannot race into a wrong total.
- **Categories in use cannot be deleted.** The FK is `ON DELETE RESTRICT`; the
  UI offers a move-the-items-then-delete flow via `delete_category()`.
- **Low stock** means *available but nearly gone* (`0 < quantity <= threshold`),
  so finished items are not counted twice. The threshold lives in
  `app_settings` and is editable from Settings — no code change needed.
- **Sample data** is flagged `is_demo` and can be removed from Settings.
- **Item photos** are uploaded from the camera (on a phone) or the file picker,
  and stored on disk under `public/uploads/`, with `items.image_url` holding
  the path. The browser downscales large photos first, and the server checks
  the file's magic bytes rather than trusting its name or declared type, so a
  script renamed `photo.jpg` is rejected. Files are deleted when the item is
  deleted, when its photo is replaced, and when a half-filled form is
  cancelled.

  > Local files do **not** survive a deploy to a host with an ephemeral
  > filesystem such as Vercel - uploads would disappear on each redeploy.
  > `lib/image-storage.ts` is the only module that touches the filesystem, so
  > moving to Supabase Storage or S3 means reimplementing `saveImage` /
  > `deleteImage` there and changing nothing else.

---

## Scripts

| Command                     | What it does                                             |
| --------------------------- | -------------------------------------------------------- |
| `npm run dev`               | Dev server on http://localhost:3000                       |
| `npm run build`             | Production build                                          |
| `npm run start`             | Serve the production build                                |
| `npm run lint`              | ESLint                                                    |
| `npm run typecheck`         | `tsc --noEmit`                                            |
| `npm run db:start` / `db:stop` | Start/stop the local Supabase stack                    |
| `npm run db:reset`          | Recreate the database from migrations + `seed.sql`        |
| `npm run db:seed-users`     | Create/update the admin and viewer accounts               |
| `npm run verify:permissions`| 20 checks that the database enforces the permission model |
| `npm run test:e2e`          | 59 browser checks (needs the app running)                 |

The two test suites are the ones to run after any change:

```bash
npm run verify:permissions      # app can be stopped; only the database is needed
npm run build && npm run start  # then, in another terminal:
npm run test:e2e
```

---

## Deploying

**GitHub Pages will not work.** It serves static files only, and this app needs
a Node server at request time — sign-in, the server actions behind every
mutation, and the session-cookie refresh in `proxy.ts` all run per request.

So the pieces are: GitHub holds the code, a host runs the app, and Supabase
holds the data.

1. Set up hosted Supabase as in **Option A** above.
2. Push the repo to GitHub. `.env.local` is gitignored, so no keys go with it.
3. Import the repo into [Vercel](https://vercel.com) (Netlify, Render and Fly
   work too — anything that runs a Node server). Next.js needs no extra config.
4. Add the environment variables in the host's dashboard:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
   `SUPABASE_SERVICE_ROLE_KEY`. Mark the service-role key as a secret — it
   bypasses row level security.
5. In the Supabase dashboard, set **Authentication → URL Configuration → Site
   URL** to your deployed domain, or sign-in redirects will bounce back to
   localhost. Confirm public sign-ups are still disabled.
6. Run `npm run db:seed-users` once locally with `.env.local` pointed at the
   hosted project, to create the two accounts. Use strong passwords — these
   are now reachable from the internet.

Docker is not involved anywhere in this list.

---

## Project layout

```
app/
  actions/          server actions - every mutation, validated and role-checked
  (app)/            signed-in pages; (admin)/ inside it is admin-only
  login/            the only public route
components/
  ui/               button, field, modal, toast, badges, skeletons
  inventory/        provider, item card, quantity control, form modal
lib/
  image-storage.ts  the only module that reads/writes uploaded photos
  supabase/         browser / server / proxy clients + generated DB types
  auth.ts           requireUser / requireAdmin route guards
  data.ts           read queries
  status.ts         derived status + low-stock rules
  validation.ts     zod schemas shared by client forms and server actions
supabase/
  migrations/       schema → functions/triggers → RLS → grants
  seed.sql          sample data (flagged is_demo)
scripts/            user provisioning, permission suite, e2e suite
proxy.ts            session refresh + signed-out redirects
```
