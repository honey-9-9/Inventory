"use server";

import { redirect } from "next/navigation";

import { fail } from "@/lib/action-helpers";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import { credentialsSchema, fieldErrorsFrom, toText } from "@/lib/validation";

/**
 * There is no public sign-up: accounts are provisioned by
 * `npm run db:seed-users`, and signups are disabled in supabase/config.toml.
 */
export async function signIn(formData: FormData): Promise<ActionResult<string>> {
  const parsed = credentialsSchema.safeParse({
    email: toText(formData.get("email")),
    password: toText(formData.get("password")),
  });

  if (!parsed.success) {
    return fail("Please check your details.", fieldErrorsFrom(parsed.error));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  // Deliberately vague: distinguishing "no such account" from "wrong password"
  // would let anyone probe which email addresses exist.
  if (error || !data.user) {
    return fail("That email and password combination did not work.");
  }

  return { ok: true, data: "/dashboard" };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
