"use server";

import { fail, requireAdminActor, succeed } from "@/lib/action-helpers";
import { deleteImage, MAX_IMAGE_BYTES, saveImage } from "@/lib/image-storage";
import type { ActionResult } from "@/lib/types";

/**
 * Receives a photo from the camera or the file picker and stores it, returning
 * the URL to put on the item.
 *
 * Admin-only, checked here before a single byte is written - an upload is the
 * one mutation that costs disk space, so it must not be reachable by a viewer.
 */
export async function uploadItemImage(formData: FormData): Promise<ActionResult<string>> {
  const actor = await requireAdminActor();
  if (!("user" in actor)) return actor;

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return fail("No image was received. Please choose a photo and try again.");
  }

  if (file.size > MAX_IMAGE_BYTES) {
    const limitMb = Math.round(MAX_IMAGE_BYTES / (1024 * 1024));
    return fail(`That image is too large. The limit is ${limitMb}MB.`);
  }

  const result = await saveImage(file);
  if (!result.ok) return fail(result.error);

  return succeed(result.url);
}

/**
 * Removes an upload that never made it onto an item - for example when the
 * user picks a photo and then cancels the form. Without this, abandoned files
 * would accumulate on disk.
 */
export async function discardItemImage(url: string): Promise<ActionResult<undefined>> {
  const actor = await requireAdminActor();
  if (!("user" in actor)) return actor;

  // `deleteImage` ignores anything that is not one of our own uploads.
  await deleteImage(url);
  return succeed();
}
