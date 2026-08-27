import "server-only";

import { createClient } from "@/lib/supabase/server";
import { DEFAULT_LOW_STOCK_THRESHOLD } from "@/lib/status";
import type { ActivityEntry, CategoryRow, CategoryWithUsage, Item } from "@/lib/types";

/**
 * Read-side queries. Each one runs through the request-scoped Supabase client,
 * so it returns exactly what the signed-in user is allowed to see.
 */

const ITEM_COLUMNS = "*, category:categories (id, name)";

export async function getItems(): Promise<Item[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("items")
    .select(ITEM_COLUMNS)
    .order("name", { ascending: true });

  if (error) throw new Error(`Could not load inventory: ${error.message}`);
  return (data ?? []) as Item[];
}

export async function getCategories(): Promise<CategoryRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw new Error(`Could not load categories: ${error.message}`);
  return data ?? [];
}

/**
 * Categories with their item counts, so the UI can warn before a delete and
 * offer to reassign instead.
 */
export async function getCategoriesWithUsage(): Promise<CategoryWithUsage[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("*, items (id)")
    .order("name", { ascending: true });

  if (error) throw new Error(`Could not load categories: ${error.message}`);

  return (data ?? []).map(({ items, ...category }) => ({
    ...category,
    itemCount: Array.isArray(items) ? items.length : 0,
  }));
}

export async function getRecentActivity(limit = 12): Promise<ActivityEntry[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activity_logs")
    .select("*, user:profiles (id, name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Could not load activity: ${error.message}`);
  return (data ?? []) as ActivityEntry[];
}

/**
 * Reads the low-stock threshold from `app_settings`, falling back to the
 * default if the row is missing or malformed rather than failing the page.
 */
export async function getLowStockThreshold(): Promise<number> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "low_stock_threshold")
    .maybeSingle();

  if (error || !data) return DEFAULT_LOW_STOCK_THRESHOLD;

  const parsed = Number(data.value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : DEFAULT_LOW_STOCK_THRESHOLD;
}
