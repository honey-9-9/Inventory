import "server-only";

import { revalidatePath } from "next/cache";

import { getSessionUser } from "@/lib/auth";
import type { ActionResult, SessionUser } from "@/lib/types";

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export function succeed(): ActionResult<undefined>;
export function succeed<T>(data: T): ActionResult<T>;
export function succeed<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

type DbError = { message: string; code?: string | null } | null;

/**
 * Turns a Postgres/PostgREST error into something a person can act on.
 *
 * 42501 is the interesting one: it is what a row level security policy raises
 * when a viewer attempts a write, so it is the database - not the UI - telling
 * us the action was not permitted.
 */
export function describeDbError(error: DbError, fallback: string): string {
  if (!error) return fallback;

  switch (error.code) {
    case "42501":
      return "You do not have permission to make that change.";
    case "23505":
      return "Something with that name already exists.";
    case "23514":
      return "That value is out of range. Quantity can never be negative.";
    case "23503":
      return "That category is still in use, or the item no longer exists.";
    case "PGRST116":
      return "That item no longer exists. It may have already been deleted.";
    default:
      return error.message || fallback;
  }
}

/**
 * Server-side re-check of the caller's role before any mutation.
 *
 * The RLS policies already make an unauthorised write impossible; this exists
 * so the UI gets a clear message instead of a raw constraint error, and so the
 * permission rule is stated in the code path too.
 */
export async function requireAdminActor(): Promise<
  { ok: true; user: SessionUser } | ActionResult<never>
> {
  const user = await getSessionUser();

  if (!user) return fail("Your session has expired. Please sign in again.");
  if (user.role !== "admin") return fail("Only an admin can change the inventory.");

  return { ok: true, user };
}

/**
 * For the one thing a viewer may also do: record that they used something up.
 * The caller still has to enforce the direction of the change; this only
 * establishes who is asking.
 */
export async function requireActor(): Promise<
  { ok: true; user: SessionUser } | ActionResult<never>
> {
  const user = await getSessionUser();
  if (!user) return fail("Your session has expired. Please sign in again.");
  return { ok: true, user };
}

const APP_PATHS = ["/dashboard", "/inventory", "/categories", "/activity", "/settings"];

/** Keeps every server-rendered view in step after a mutation. */
export function revalidateApp() {
  for (const path of APP_PATHS) revalidatePath(path);
}
