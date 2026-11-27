"use server";

import {
  describeDbError,
  fail,
  requireActor,
  requireAdminActor,
  revalidateApp,
  succeed,
} from "@/lib/action-helpers";
import { deleteImage } from "@/lib/image-storage";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, Item } from "@/lib/types";
import { fieldErrorsFrom, itemSchema, toNumber, toText } from "@/lib/validation";

const ITEM_COLUMNS = "*, category:categories (id, name)";

function parseItemForm(formData: FormData) {
  return itemSchema.safeParse({
    name: toText(formData.get("name")),
    categoryId: toText(formData.get("categoryId")),
    quantity: toNumber(formData.get("quantity")),
    unit: toText(formData.get("unit")),
    description: toText(formData.get("description")),
    imageUrl: toText(formData.get("imageUrl")),
  });
}

export async function createItem(formData: FormData): Promise<ActionResult<Item>> {
  const actor = await requireAdminActor();
  if (!("user" in actor)) return actor;

  const parsed = parseItemForm(formData);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFrom(parsed.error));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("items")
    .insert({
      name: parsed.data.name,
      category_id: parsed.data.categoryId,
      quantity: parsed.data.quantity,
      unit: parsed.data.unit,
      description: parsed.data.description,
      image_url: parsed.data.imageUrl,
    })
    .select(ITEM_COLUMNS)
    .single();

  if (error || !data) return fail(describeDbError(error, "Could not add that item."));

  revalidateApp();
  return succeed(data as Item);
}

export async function updateItem(id: string, formData: FormData): Promise<ActionResult<Item>> {
  const actor = await requireAdminActor();
  if (!("user" in actor)) return actor;

  const parsed = parseItemForm(formData);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFrom(parsed.error));
  }

  const supabase = await createClient();

  // Read the current photo first so a replaced file can be removed from disk
  // once the update succeeds.
  const { data: existing } = await supabase
    .from("items")
    .select("image_url")
    .eq("id", id)
    .maybeSingle();

  // `updated_at` is maintained by the items_set_updated_at trigger, so it stays
  // accurate even for writes that do not come from this action.
  const { data, error } = await supabase
    .from("items")
    .update({
      name: parsed.data.name,
      category_id: parsed.data.categoryId,
      quantity: parsed.data.quantity,
      unit: parsed.data.unit,
      description: parsed.data.description,
      image_url: parsed.data.imageUrl,
    })
    .eq("id", id)
    .select(ITEM_COLUMNS)
    .single();

  if (error || !data) return fail(describeDbError(error, "Could not save your changes."));

  // Only after the write is committed, and only if the photo actually changed.
  if (existing?.image_url && existing.image_url !== parsed.data.imageUrl) {
    await deleteImage(existing.image_url);
  }

  revalidateApp();
  return succeed(data as Item);
}

export async function deleteItem(id: string): Promise<ActionResult<string>> {
  const actor = await requireAdminActor();
  if (!("user" in actor)) return actor;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("items")
    .delete()
    .eq("id", id)
    .select("id, image_url");

  if (error) return fail(describeDbError(error, "Could not delete that item."));
  if (!data || data.length === 0) {
    return fail("That item no longer exists, or you do not have permission to delete it.");
  }

  // The row is gone, so its photo would be orphaned on disk.
  await deleteImage(data[0].image_url);

  revalidateApp();
  return succeed(id);
}

/**
 * The quick +/- control.
 *
 * Delegates to the `adjust_item_quantity` SQL function so the arithmetic and
 * the clamp at zero happen atomically inside the database. Two fast taps can
 * never race each other into a wrong total, and quantity can never go below 0
 * even if `delta` is -5.
 */
export async function adjustQuantity(id: string, delta: number): Promise<ActionResult<Item>> {
  const actor = await requireActor();
  if (!("user" in actor)) return actor;

  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 1000) {
    return fail("That quantity change is not valid.");
  }

  // A viewer records what they have used; only an admin restocks. The same
  // rule is enforced inside `adjust_item_quantity`, which is what actually
  // stops a viewer calling the database directly - this is here so the UI
  // gets a sentence rather than a raw 42501.
  if (delta > 0 && actor.user.role !== "admin") {
    return fail("Only an admin can add stock.");
  }

  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("adjust_item_quantity", {
    p_item_id: id,
    p_delta: delta,
  });

  if (rpcError) return fail(describeDbError(rpcError, "Could not update the quantity."));

  // Re-read through the normal select so the caller gets the joined category
  // in the same shape as every other item in client state.
  const { data, error } = await supabase
    .from("items")
    .select(ITEM_COLUMNS)
    .eq("id", id)
    .single();

  if (error || !data) return fail(describeDbError(error, "Could not update the quantity."));

  revalidateApp();
  return succeed(data as Item);
}
