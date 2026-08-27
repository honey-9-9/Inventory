import type { InventorySummary, Item, ItemStatus } from "./types";

/**
 * Fallback used when the `low_stock_threshold` setting cannot be read.
 * The live value lives in the `app_settings` table and is editable from the
 * Settings page, so changing it never requires a code change.
 */
export const DEFAULT_LOW_STOCK_THRESHOLD = 1;

/**
 * Status is a pure function of quantity and is never persisted, so the two can
 * never drift apart: dropping to 0 finishes an item and going back to 1
 * revives it, with no extra bookkeeping.
 */
export function deriveStatus(quantity: number): ItemStatus {
  return quantity > 0 ? "available" : "finished";
}

/**
 * "Low stock" means *still available but nearly gone*. Finished items are
 * excluded on purpose - they already have their own status and section, and
 * counting them twice would make the dashboard totals confusing.
 */
export function isLowStock(quantity: number, threshold: number): boolean {
  return quantity > 0 && quantity <= threshold;
}

export function summarise(items: Item[], threshold: number): InventorySummary {
  return items.reduce<InventorySummary>(
    (summary, item) => {
      summary.total += 1;
      if (deriveStatus(item.quantity) === "available") {
        summary.available += 1;
        if (isLowStock(item.quantity, threshold)) summary.lowStock += 1;
      } else {
        summary.finished += 1;
      }
      return summary;
    },
    { total: 0, available: 0, finished: 0, lowStock: 0 },
  );
}
