import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/lib/types";

/**
 * Resolves the signed-in user and their role.
 *
 * Uses `getUser()` rather than `getSession()`: the former revalidates the JWT
 * with the auth server, so a tampered cookie cannot fabricate a session.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, email, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role,
  };
}

/** Route guard for any signed-in page. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Route guard for admin-only pages. A viewer who types an admin URL directly
 * is sent back to their dashboard rather than shown an error page.
 *
 * This is a UX guard on top of - never instead of - the RLS policies, which
 * are what stop a viewer hitting the database API directly.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}
