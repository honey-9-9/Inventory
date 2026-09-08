import { z } from "zod";

/**
 * Server-side validation. The client forms use the same schemas so the rules
 * cannot drift, but these are enforced again in every server action - a
 * hand-crafted POST never reaches the database unvalidated.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .default(null);

/**
 * An item photo is either a file this app stored (`/uploads/<uuid>.jpg`) or an
 * external http(s) URL.
 *
 * Everything else is rejected, which is what stops a `javascript:` or `data:`
 * URL being persisted and later rendered into an image src. The local form is
 * pinned to a UUID filename so a crafted path cannot point somewhere else.
 */
const UPLOAD_PATH = /^\/uploads\/[a-f0-9-]{36}\.(jpg|png|webp|gif)$/i;

const imageUrl = z
  .string()
  .trim()
  .max(2048, "That URL is too long")
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .default(null)
  .refine(
    (value) => {
      if (value === null) return true;
      if (UPLOAD_PATH.test(value)) return true;
      try {
        const { protocol } = new URL(value);
        return protocol === "http:" || protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "That image could not be used. Upload a photo or paste an http(s) URL." },
  );

export const itemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Item name is required")
    .max(80, "Item name must be 80 characters or fewer"),
  categoryId: z.string().uuid("Choose a category"),
  quantity: z
    .number({ message: "Quantity must be a number" })
    .int("Quantity must be a whole number")
    .min(0, "Quantity cannot be negative")
    .max(1_000_000, "That quantity is unrealistically large"),
  unit: z
    .string()
    .trim()
    .min(1, "Unit is required")
    .max(30, "Unit must be 30 characters or fewer"),
  description: optionalText(500),
  imageUrl,
});

export type ItemInput = z.infer<typeof itemSchema>;

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Category name is required")
    .max(40, "Category name must be 40 characters or fewer"),
});

export const lowStockThresholdSchema = z.object({
  threshold: z
    .number({ message: "Threshold must be a number" })
    .int("Threshold must be a whole number")
    .min(0, "Threshold cannot be negative")
    .max(1000, "Threshold is too large"),
});

export const credentialsSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

/** Collapses a ZodError into the `{ field: message }` shape the forms render. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in result)) {
      result[key] = issue.message;
    }
  }
  return result;
}

/** FormData values arrive as strings; keep the coercion in one place. */
export function toNumber(value: FormDataEntryValue | null): number {
  if (value === null) return Number.NaN;
  const text = String(value).trim();
  if (text === "") return Number.NaN;
  return Number(text);
}

export function toText(value: FormDataEntryValue | null): string {
  return value === null ? "" : String(value);
}
