"use client";

import { useState } from "react";

import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";

import { ActivityFeed } from "@/components/activity-feed";
import { useInventory } from "@/components/inventory/inventory-provider";
import { ItemFormModal } from "@/components/inventory/item-form-modal";
import { QuantityControl } from "@/components/inventory/quantity-control";
import { SummaryCards } from "@/components/inventory/summary-cards";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatQuantity, greeting, itemInitial } from "@/lib/format";
import { deriveStatus, isLowStock } from "@/lib/status";
import type { Item } from "@/lib/types";

/* eslint-disable @next/next/no-img-element -- item photos are arbitrary local
   or external URLs, which next/image's allow-list would reject. */

/**
 * Small square photo for the compact dashboard rows, falling back to a letter
 * avatar when an item has no picture or the file has gone missing.
 */
function ItemThumbnail({ item, dimmed = false }: { item: Item; dimmed?: boolean }) {
  const [failed, setFailed] = useState(false);
  const shell = `flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-canvas text-sm font-bold text-ink-soft${dimmed ? " opacity-60" : ""}`;

  if (item.image_url && !failed) {
    return (
      <span className={shell}>
        <img
          src={item.image_url}
          alt={`Photo of ${item.name}`}
          loading="lazy"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      </span>
    );
  }

  return (
    <span className={shell} aria-hidden>
      {itemInitial(item.name)}
    </span>
  );
}

/** How many rows the dashboard's compact lists show before linking onward. */
const PREVIEW_LIMIT = 6;

export function DashboardView({ userName }: { userName: string }) {
  const { items, activity, summary, isAdmin, lowStockThreshold } = useInventory();
  const [formOpen, setFormOpen] = useState(false);

  const available = items.filter((item) => deriveStatus(item.quantity) === "available");
  const finished = items.filter((item) => deriveStatus(item.quantity) === "finished");
  const lowStock = available.filter((item) => isLowStock(item.quantity, lowStockThreshold));

  const firstName = userName.split(" ")[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {/* Computed in the browser so it matches the reader's local time. */}
          <h1 className="text-2xl font-bold text-ink sm:text-3xl" suppressHydrationWarning>
            {greeting()}, {firstName} 👋
          </h1>
          <p className="mt-1 text-sm text-ink-soft">Here&rsquo;s what&rsquo;s in your drawer.</p>
        </div>
        {isAdmin ? (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Add item
          </Button>
        ) : null}
      </div>

      <SummaryCards summary={summary} />

      {lowStock.length > 0 ? (
        <div className="rounded-2xl border border-low-fg/20 bg-low-bg/60 px-4 py-3">
          <p className="text-sm font-semibold text-low-fg">
            Running low on {lowStock.map((item) => item.name).join(", ")}.
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <section className={isAdmin ? "lg:col-span-3" : "lg:col-span-5"}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-ink">
              Available{" "}
              <span className="rounded-full bg-canvas px-2 py-0.5 text-sm font-semibold text-ink-soft">
                {available.length}
              </span>
            </h2>
            <Link
              href="/inventory"
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 underline-offset-4 transition hover:underline"
            >
              View all
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>

          {available.length === 0 ? (
            <EmptyState icon="🥣" title="Nothing available" message="Your drawer is empty." />
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-sm shadow-black/[0.03]">
              {available.slice(0, PREVIEW_LIMIT).map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <ItemThumbnail item={item} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{item.name}</p>
                    <p className="truncate text-xs text-ink-soft">
                      {formatQuantity(item.quantity, item.unit)}
                    </p>
                  </div>
                  <QuantityControl item={item} />
                </li>
              ))}
            </ul>
          )}

          <h2 className="mb-3 mt-8 text-lg font-bold text-ink">
            Finished{" "}
            <span className="rounded-full bg-canvas px-2 py-0.5 text-sm font-semibold text-ink-soft">
              {finished.length}
            </span>
          </h2>

          {finished.length === 0 ? (
            <EmptyState
              icon="🎉"
              title="Nothing finished"
              message="Everything is currently available."
            />
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-sm shadow-black/[0.03]">
              {finished.slice(0, PREVIEW_LIMIT).map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <ItemThumbnail item={item} dimmed />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{item.name}</p>
                    <p className="truncate text-xs text-ink-soft">{item.category?.name}</p>
                  </div>
                  {isAdmin ? (
                    <QuantityControl item={item} />
                  ) : (
                    <StatusBadge
                      quantity={item.quantity}
                      lowStockThreshold={lowStockThreshold}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {isAdmin ? (
          <section className="lg:col-span-2">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-ink">Recently updated</h2>
              <Link
                href="/activity"
                className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 underline-offset-4 transition hover:underline"
              >
                History
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-3 shadow-sm shadow-black/[0.03]">
              <ActivityFeed entries={activity.slice(0, 6)} />
            </div>
          </section>
        ) : null}
      </div>

      {isAdmin ? (
        <ItemFormModal open={formOpen} item={null} onClose={() => setFormOpen(false)} />
      ) : null}
    </div>
  );
}
