"use client";

/* eslint-disable @next/next/no-img-element -- image_url is an arbitrary
   user-supplied host, so next/image's allow-list would reject it. */

import { useState } from "react";

import { Pencil, Trash2 } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { RelativeTime } from "@/components/ui/relative-time";
import { formatQuantity, itemInitial } from "@/lib/format";
import { deriveStatus } from "@/lib/status";
import type { Item } from "@/lib/types";

import { useInventory } from "./inventory-provider";
import { QuantityControl } from "./quantity-control";

type ItemCardProps = {
  item: Item;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
};

function ItemAvatar({ item }: { item: Item }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (item.image_url && !imageFailed) {
    return (
      <img
        src={item.image_url}
        alt={`Photo of ${item.name}`}
        loading="lazy"
        // A broken or removed file falls back to the letter avatar rather than
        // leaving a torn image icon on the card.
        onError={() => setImageFailed(true)}
        className="size-12 shrink-0 rounded-2xl object-cover"
      />
    );
  }

  return (
    <div
      aria-hidden
      className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-canvas text-2xl font-bold text-ink-soft"
    >
      {itemInitial(item.name)}
    </div>
  );
}

export function ItemCard({ item, onEdit, onDelete }: ItemCardProps) {
  const { isAdmin, lowStockThreshold } = useInventory();
  const finished = deriveStatus(item.quantity) === "finished";

  return (
    <article
      className={`group flex flex-col rounded-2xl border bg-surface p-5 shadow-sm shadow-black/[0.03] transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/[0.06] ${
        finished ? "border-line/80 opacity-90" : "border-line"
      }`}
    >
      <div className="flex items-start gap-3">
        <ItemAvatar item={item} />

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold text-ink" title={item.name}>
            {item.name}
          </h3>
          <p className="truncate text-sm text-ink-soft">{item.category?.name ?? "Uncategorised"}</p>
        </div>

        {isAdmin ? (
          <div className="flex shrink-0 gap-0.5 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
            <button
              type="button"
              onClick={() => onEdit(item)}
              aria-label={`Edit ${item.name}`}
              className="cursor-pointer rounded-lg p-1.5 text-ink-soft transition hover:bg-canvas hover:text-ink"
            >
              <Pencil className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => onDelete(item)}
              aria-label={`Delete ${item.name}`}
              className="cursor-pointer rounded-lg p-1.5 text-ink-soft transition hover:bg-finished-bg hover:text-finished-fg"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
        ) : null}
      </div>

      {item.description ? (
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-soft">
          {item.description}
        </p>
      ) : null}

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Quantity</p>
          <p className="mt-0.5 text-lg font-bold text-ink">
            {finished ? (
              <span className="text-finished-fg">Finished</span>
            ) : (
              formatQuantity(item.quantity, item.unit)
            )}
          </p>
        </div>
        <StatusBadge quantity={item.quantity} lowStockThreshold={lowStockThreshold} />
      </div>

      {isAdmin ? (
        <div className="mt-4">
          <QuantityControl item={item} />
        </div>
      ) : (
        <p className="mt-4 border-t border-line pt-3 text-xs text-ink-soft">
          {item.unit}
          {item.is_demo ? " · sample item" : ""}
        </p>
      )}

      <p className="mt-3 text-xs text-ink-soft/80">
        Updated <RelativeTime iso={item.updated_at} />
      </p>
    </article>
  );
}
