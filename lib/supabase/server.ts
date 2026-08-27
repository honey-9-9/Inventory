import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

import type { Database } from "./database.types";

/**
 * Server-side Supabase client bound to the caller's session cookies.
 *
 * Note this deliberately uses the *anon* key, not the service role key: every
 * query made on behalf of a request runs as that signed-in user, so the RLS
 * policies are what decide whether a write is allowed. Nothing in the request
 * path can escalate to a privileged connection.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The middleware refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}
