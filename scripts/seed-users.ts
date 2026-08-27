/**
 * Provisions the two accounts the app ships with.
 *
 * This is the only place the service-role key is used. Passwords are handed to
 * Supabase Auth (GoTrue), which stores a bcrypt hash - the app never sees or
 * stores a password itself.
 *
 * Safe to re-run: an existing account has its name, role and password reset to
 * whatever .env.local currently says.
 *
 *   npm run db:seed-users
 */
import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

type SeedUser = {
  label: string;
  email: string;
  password: string;
  name: string;
  role: "admin" | "viewer";
};

const MIN_PASSWORD_LENGTH = 8;

function readSeedUsers(): SeedUser[] {
  const definitions: Array<{ label: string; prefix: string; role: "admin" | "viewer" }> = [
    { label: "Admin", prefix: "ADMIN", role: "admin" },
    { label: "Viewer", prefix: "VIEWER", role: "viewer" },
  ];

  return definitions.map(({ label, prefix, role }) => {
    const email = process.env[`${prefix}_EMAIL`];
    const password = process.env[`${prefix}_PASSWORD`];

    if (!email || !password) {
      throw new Error(
        `Missing ${prefix}_EMAIL / ${prefix}_PASSWORD in .env.local (see .env.example).`,
      );
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(
        `${prefix}_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
    }

    return {
      label,
      email,
      password,
      name: process.env[`${prefix}_NAME`] ?? label,
      role,
    };
  });
}

async function findUserByEmail(admin: SupabaseClient, email: string) {
  // The admin API has no direct get-by-email, so page through until we match.
  // Two accounts means this never goes past the first page in practice.
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;

    const match = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function upsertUser(admin: SupabaseClient, seed: SeedUser) {
  const metadata = { name: seed.name, role: seed.role };
  const existing = await findUserByEmail(admin, seed.email);

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: seed.password,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error) throw error;

    // updateUserById does not fire the on_auth_user_created trigger, so keep
    // the profile row in step explicitly.
    const { error: profileError } = await admin
      .from("profiles")
      .upsert(
        { id: existing.id, name: seed.name, email: seed.email, role: seed.role },
        { onConflict: "id" },
      );
    if (profileError) throw profileError;

    return { created: false, id: existing.id };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: seed.email,
    password: seed.password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error) throw error;

  return { created: true, id: data.user.id };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const seeds = readSeedUsers();

  console.log("Provisioning accounts...\n");
  for (const seed of seeds) {
    const { created } = await upsertUser(admin, seed);
    console.log(
      `  ${created ? "created" : "updated"}  ${seed.label.padEnd(6)}  ${seed.email}  (role: ${seed.role})`,
    );
  }

  console.log("\nDone. Sign in at http://localhost:3000/login");
}

main().catch((error: unknown) => {
  console.error("\nSeeding failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
