import type { Database } from "./supabase/database.types";

export type UserRole = Database["public"]["Enums"]["user_role"];

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
export type ItemRow = Database["public"]["Tables"]["items"]["Row"];
export type ActivityRow = Database["public"]["Tables"]["activity_logs"]["Row"];

/** An item with its category joined in, as returned by the inventory queries. */
export type Item = ItemRow & {
  category: Pick<CategoryRow, "id" | "name"> | null;
};

/** A category plus the number of items pointing at it (drives the delete flow). */
export type CategoryWithUsage = CategoryRow & {
  itemCount: number;
};

export type ActivityEntry = ActivityRow & {
  user: Pick<ProfileRow, "id" | "name"> | null;
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

/** Derived from `quantity` - never stored. See lib/status.ts. */
export type ItemStatus = "available" | "finished";

export type InventoryFilter = "all" | "available" | "finished" | "low-stock";

export type InventorySummary = {
  total: number;
  available: number;
  finished: number;
  lowStock: number;
};

/** Discriminated result used by every server action. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
