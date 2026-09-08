import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Item photo storage.
 *
 * Files are written to `public/uploads/`, which Next serves directly, so a
 * saved photo is reachable at `/uploads/<id>.<ext>`.
 *
 * This is the ONLY module that touches the filesystem. Swapping to Supabase
 * Storage (or S3) later means reimplementing `saveImage` / `deleteImage` here
 * and changing nothing else - note that local files do not survive a deploy to
 * a host with an ephemeral filesystem, such as Vercel.
 */

export const UPLOADS_URL_PREFIX = "/uploads/";

/** Generous ceiling; the client downscales before uploading. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

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

export type SaveImageResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Writes an uploaded image and returns the URL to store on the item.
 *
 * The filename is a fresh UUID, never anything the client supplied, so a name
 * like `../../server.js` cannot escape the uploads directory.
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

  await mkdir(UPLOADS_DIR, { recursive: true });

  const filename = `${randomUUID()}.${signature.ext}`;
  await writeFile(path.join(UPLOADS_DIR, filename), bytes);

  return { ok: true, url: `${UPLOADS_URL_PREFIX}${filename}` };
}

/** True when the URL points at a file this app owns and may delete. */
export function isManagedUpload(url: string | null | undefined): boolean {
  if (!url || !url.startsWith(UPLOADS_URL_PREFIX)) return false;

  const filename = url.slice(UPLOADS_URL_PREFIX.length);
  // Only a bare UUID-style filename, so nothing can be coaxed into deleting a
  // file elsewhere on disk.
  return /^[a-f0-9-]{36}\.(jpg|png|webp|gif)$/i.test(filename);
}

/**
 * Deletes a previously uploaded file. External URLs and anything that fails
 * the ownership check are ignored, and a missing file is not an error - the
 * goal is simply that it is gone.
 */
export async function deleteImage(url: string | null | undefined): Promise<void> {
  if (!isManagedUpload(url)) return;

  const filename = url!.slice(UPLOADS_URL_PREFIX.length);

  try {
    await unlink(path.join(UPLOADS_DIR, filename));
  } catch {
    // Already deleted, or never written. Nothing to do.
  }
}
