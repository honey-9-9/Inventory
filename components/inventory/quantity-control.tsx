"use client";

import { Minus, Plus } from "lucide-react";

import { useInventory } from "./inventory-provider";
import type { Item } from "@/lib/types";

/**
 * The app's most-used control, so it is built for speed: one tap changes the
 * number immediately, the request goes out in the background, and nothing
 * reloads.
 *
 * Only rendered for admins - and even if it were rendered for a viewer, the
 * underlying RPC is refused by row level security.
 */
export function QuantityControl({ item }: { item: Item }) {
  const { adjust, busyItemIds } = useInventory();
  const busy = busyItemIds.has(item.id);
  const canDecrease = item.quantity > 0;

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-canvas p-1">
      <button
        type="button"
        onClick={() => adjust(item, -1)}
        // Disabled at zero so the UI never even suggests a negative quantity.
        disabled={!canDecrease || busy}
        aria-label={`Use one ${item.name}`}
        className="flex size-9 cursor-pointer items-center justify-center rounded-lg bg-surface text-ink shadow-sm transition hover:bg-white hover:text-finished-fg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-ink"
      >
        <Minus className="size-4" aria-hidden />
      </button>

      <output
        // `polite` so the running total is announced without stealing focus.
        aria-live="polite"
        aria-label={`${item.name} quantity`}
        className="min-w-10 text-center text-base font-bold tabular-nums text-ink"
      >
        {item.quantity}
      </output>

      <button
        type="button"
        onClick={() => adjust(item, 1)}
        disabled={busy}
        aria-label={`Add one ${item.name}`}
        className="flex size-9 cursor-pointer items-center justify-center rounded-lg bg-surface text-ink shadow-sm transition hover:bg-white hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
