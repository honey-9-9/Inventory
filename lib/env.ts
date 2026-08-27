/**
 * Centralised environment access.
 *
 * Reading through these helpers (instead of `process.env.X!` sprinkled around)
 * means a missing variable fails loudly at the point of use with a message that
 * says what to do, rather than surfacing later as a confusing auth error.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in ` +
        `(run \`npm run db:start\` to get local Supabase credentials).`,
    );
  }
  return value;
}

/** Safe to expose to the browser - all access is still gated by row level security. */
export const supabaseUrl = () =>
  required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);

export const supabaseAnonKey = () =>
  required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/**
 * Bypasses row level security - server-side scripts only, never in a module
 * that can be reached from a client component.
 */
export const supabaseServiceRoleKey = () =>
  required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
