const UNITS: Array<[limit: number, seconds: number, label: string]> = [
  [60, 1, "second"],
  [3600, 60, "minute"],
  [86400, 3600, "hour"],
  [604800, 86400, "day"],
  [2629800, 604800, "week"],
  [31557600, 2629800, "month"],
  [Infinity, 31557600, "year"],
];

/** "5 minutes ago" / "just now". Falls back gracefully on an unparseable date. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const seconds = Math.round((now - then) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 0) return "just now";

  for (const [limit, divisor, label] of UNITS) {
    if (seconds < limit) {
      const value = Math.floor(seconds / divisor);
      return `${value} ${label}${value === 1 ? "" : "s"} ago`;
    }
  }
  return "";
}

export function absoluteTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function greeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** "2 packets" / "1 packet" - naive but correct for the common English units. */
export function formatQuantity(quantity: number, unit: string): string {
  const trimmed = unit.trim();
  if (quantity === 1 && trimmed.length > 1 && trimmed.endsWith("s")) {
    return `${quantity} ${trimmed.slice(0, -1)}`;
  }
  return `${quantity} ${trimmed}`;
}

/** Initials-style fallback when an item has no icon or image. */
export function itemInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}
