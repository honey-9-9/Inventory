import "server-only";

import { randomUUID } from "node:crypto";

import { createClient } from "@/lib/supabase/server";

/**
 * Item photo storage.
 *
 * Photos live in the `item-images` bucket of the same Supabase project as the
 * data. The bucket is public-read, so a stored photo is reachable at a plain
 * URL with nothing to sign and nothing to expire.
 *
 * This is the ONLY module that knows where photos are kept. It previously
 * wrote to `public/uploads`, which needs a host with a real, persistent disk -
 * on Vercel the filesystem is read-only and saving a photo fails outright.
 *
 * Uploading and deleting go through the caller's own session, so the policies
 * on `storage.objects` apply: only an admin can write here, and that holds
 * even for someone calling the Storage API directly.
 */

export const BUCKET = "item-images";

/** Generous ceiling; the client downscales before uploading. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Accepted formats, keyed by the magic bytes that actually start the file.
 *
 * The declared MIME type and the filename both come from the client and can
 * say anything, so the file's own header is what decides. This is what stops
 * a script being uploaded as "photo.jpg".
 */
const SIGNATURES: Array<{ ext: string; mime: string; matches: (bytes: Uint8Array) => boolean }> = [
  {
    ext: "jpg",
    mime: "image/jpeg",
    matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    ext: "png",
    mime: "image/png",
    matches: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    ext: "webp",
    mime: "image/webp",
    matches: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
  {
    ext: "gif",
    mime: "image/gif",
    matches: (b) =>
      b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38,
  },
];

export const ACCEPTED_MIME_TYPES = SIGNATURES.map((entry) => entry.mime);

/**
 * A URL this app owns and may delete: the public URL of an object in our
 * bucket, whose name is a bare UUID. Anything else - an external URL someone
 * pasted, or a crafted path - fails to match and is left alone.
 */
const MANAGED_URL =
  /\/storage\/v1\/object\/public\/item-images\/([a-f0-9-]{36}\.(?:jpg|png|webp|gif))(?:\?.*)?$/i;

export type SaveImageResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Stores an uploaded image and returns the URL to put on the item.
 *
 * The object name is a fresh UUID, never anything the client supplied, so a
 * name like `../../secret` cannot escape the bucket.
 */
export async function saveImage(file: File): Promise<SaveImageResult> {
  if (file.size === 0) return { ok: false, error: "That file is empty." };

  if (file.size > MAX_IMAGE_BYTES) {
    const limitMb = Math.round(MAX_IMAGE_BYTES / (1024 * 1024));
    return { ok: false, error: `That image is too large. The limit is ${limitMb}MB.` };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = SIGNATURES.find((entry) => entry.matches(bytes));

  if (!signature) {
    return { ok: false, error: "That file is not a JPEG, PNG, WebP or GIF image." };
  }

  const supabase = await createClient();
  const objectName = `${randomUUID()}.${signature.ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(objectName, bytes, {
    // Trust the sniffed type, not the one the browser declared.
    contentType: signature.mime,
    upsert: false,
  });

  if (error) {
    return { ok: false, error: "That image could not be saved. Please try again." };
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectName);
  return { ok: true, url: data.publicUrl };
}

/** True when the URL points at an object this app owns and may delete. */
export function isManagedUpload(url: string | null | undefined): boolean {
  return Boolean(url) && MANAGED_URL.test(url!);
}

/**
 * Deletes a previously uploaded photo. External URLs and anything that fails
 * the ownership check are ignored, and an object that is already gone is not
 * an error - the goal is simply that it is no longer there.
 */
export async function deleteImage(url: string | null | undefined): Promise<void> {
  const match = url?.match(MANAGED_URL);
  if (!match) return;

  try {
    const supabase = await createClient();
    await supabase.storage.from(BUCKET).remove([match[1]]);
  } catch {
    // Already deleted, or never stored. Nothing to do.
  }
}
