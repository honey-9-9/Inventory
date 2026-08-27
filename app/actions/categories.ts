"use server";

import {
  describeDbError,
  fail,
  requireAdminActor,
  revalidateApp,
  succeed,
} from "@/lib/action-helpers";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, CategoryRow } from "@/lib/types";
import { categorySchema, fieldErrorsFrom, toText } from "@/lib/validation";

export async function createCategory(formData: FormData): Promise<ActionResult<CategoryRow>> {
  const actor = await requireAdminActor();
  if (!("user" in actor)) return actor;

  const parsed = categorySchema.safeParse({ name: toText(formData.get("name")) });
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFrom(parsed.error));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .insert({ name: parsed.data.name })
    .select("*")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return fail(`A category called "${parsed.data.name}" already exists.`, {
        name: "That name is already taken",
      });
    }
    return fail(describeDbError(error, "Could not create that category."));
  }

  revalidateApp();
  return succeed(data);
}

export async function renameCategory(
  id: string,
  formData: FormData,
): Promise<ActionResult<CategoryRow>> {
  const actor = await requireAdminActor();
  if (!("user" in actor)) return actor;

  const parsed = categorySchema.safeParse({ name: toText(formData.get("name")) });
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFrom(parsed.error));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .update({ name: parsed.data.name })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return fail(`A category called "${parsed.data.name}" already exists.`, {
        name: "That name is already taken",
      });
    }
    return fail(describeDbError(error, "Could not rename that category."));
  }

  revalidateApp();
  return succeed(data);
}

/**
 * Deletes a category, optionally moving its items somewhere else first.
 *
 * The `delete_category` SQL function does the move and the delete in one
 * transaction, and the FK's ON DELETE RESTRICT is the real backstop: a
 * category that still has items cannot be removed by any code path.
 */
export async function deleteCategory(
  id: string,
  reassignToId: string | null,
): Promise<ActionResult<string>> {
  const actor = await requireAdminActor();
  if (!("user" in actor)) return actor;

  if (reassignToId !== null && reassignToId === id) {
    return fail("Choose a different category to move the items into.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_category", {
    p_category_id: id,
    // The generated arg type is optional (the SQL default is null), so omit it
    // entirely rather than sending an explicit null.
    p_reassign_to: reassignToId ?? undefined,
  });

  if (error) return fail(describeDbError(error, "Could not delete that category."));

  revalidateApp();
  return succeed(id);
}
