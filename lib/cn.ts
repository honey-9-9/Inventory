/**
 * Joins class names, dropping falsy values.
 *
 * Deliberately tiny: this app never needs Tailwind-aware class merging, so a
 * dependency like clsx/tailwind-merge would not earn its place.
 */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
