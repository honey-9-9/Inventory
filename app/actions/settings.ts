"use server";

import {
  describeDbError,
  fail,
  requireAdminActor,
  revalidateApp,
  succeed,
} from "@/lib/action-helpers";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import { fieldErrorsFrom, lowStockThresholdSchema, toNumber } from "@/lib/validation";

export async function updateLowStockThreshold(
  formData: FormData,
): Promise<ActionResult<number>> {
  const actor = await requireAdminActor();
  if (!("user" in actor)) return actor;

  const parsed = lowStockThresholdSchema.safeParse({
    threshold: toNumber(formData.get("threshold")),
  });
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFrom(parsed.error));
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { key: "low_stock_threshold", value: parsed.data.threshold },
      { onConflict: "key" },
    );

  if (error) return fail(describeDbError(error, "Could not save that setting."));

  revalidateApp();
  return succeed(parsed.data.threshold);
}

/**
 * Removes the rows created by supabase/seed.sql.
 *
 * Items go first so the categories are then unreferenced; any demo category
 * that the user has since put a real item into is kept, because the FK will
 * refuse to delete it and we filter those out up front.
 */
export async function removeDemoData(): Promise<ActionResult<{ items: number; categories: number }>> {
  const actor = await requireAdminActor();
  if (!("user" in actor)) return actor;

  const supabase = await createClient();

  const { data: deletedItems, error: itemsError } = await supabase
    .from("items")
    .delete()
    .eq("is_demo", true)
    .select("id");

  if (itemsError) return fail(describeDbError(itemsError, "Could not remove the demo items."));

  const { data: demoCategories, error: categoriesError } = await supabase
    .from("categories")
    .select("id, items (id)")
    .eq("is_demo", true);

  if (categoriesError) {
    return fail(describeDbError(categoriesError, "Could not remove the demo categories."));
  }

  const emptyDemoCategoryIds = (demoCategories ?? [])
    .filter((category) => !Array.isArray(category.items) || category.items.length === 0)
    .map((category) => category.id);

  let removedCategories = 0;
  if (emptyDemoCategoryIds.length > 0) {
    const { data: deletedCategories, error: deleteError } = await supabase
      .from("categories")
      .delete()
      .in("id", emptyDemoCategoryIds)
      .select("id");

    if (deleteError) {
      return fail(describeDbError(deleteError, "Could not remove the demo categories."));
    }
    removedCategories = deletedCategories?.length ?? 0;
  }

  revalidateApp();
  return succeed({
    items: deletedItems?.length ?? 0,
    categories: removedCategories,
  });
}
