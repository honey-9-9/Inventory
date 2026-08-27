"use client";

import { Boxes, PackageCheck, PackageX, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/cn";
import type { InventoryFilter, InventorySummary } from "@/lib/types";

type Tile = {
  key: InventoryFilter;
  label: string;
  value: number;
  icon: typeof Boxes;
  styles: string;
};

type SummaryCardsProps = {
  summary: InventorySummary;
  /** When provided the tiles act as filter shortcuts. */
  activeFilter?: InventoryFilter;
  onSelect?: (filter: InventoryFilter) => void;
};

export function SummaryCards({ summary, activeFilter, onSelect }: SummaryCardsProps) {
  const tiles: Tile[] = [
    {
      key: "all",
      label: "Total items",
      value: summary.total,
      icon: Boxes,
      styles: "bg-canvas text-ink-soft",
    },
    {
      key: "available",
      label: "Available",
      value: summary.available,
      icon: PackageCheck,
      styles: "bg-available-bg text-available-fg",
    },
    {
      key: "finished",
      label: "Finished",
      value: summary.finished,
      icon: PackageX,
      styles: "bg-finished-bg text-finished-fg",
    },
    {
      key: "low-stock",
      label: "Low stock",
      value: summary.lowStock,
      icon: TriangleAlert,
      styles: "bg-low-bg text-low-fg",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map(({ key, label, value, icon: Icon, styles }) => {
        const interactive = Boolean(onSelect);
        const active = interactive && activeFilter === key;

        const content = (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</p>
              <span className={cn("flex size-8 items-center justify-center rounded-xl", styles)}>
                <Icon className="size-4" aria-hidden />
              </span>
            </div>
            <p className="mt-2 text-3xl font-bold tabular-nums text-ink">{value}</p>
          </>
        );

        const shell = cn(
          "rounded-2xl border bg-surface p-4 text-left shadow-sm shadow-black/[0.03] transition",
          active ? "border-brand-500 ring-1 ring-brand-500" : "border-line",
          interactive && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/[0.06]",
        );

        return interactive ? (
          <button
            key={key}
            type="button"
            onClick={() => onSelect?.(key)}
            aria-pressed={active}
            className={shell}
          >
            {content}
          </button>
        ) : (
          <div key={key} className={shell}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
