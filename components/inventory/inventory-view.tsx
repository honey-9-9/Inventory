"use client";

import { useMemo, useState } from "react";

import { Plus, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { deriveStatus, isLowStock } from "@/lib/status";
import type { InventoryFilter, Item } from "@/lib/types";

import { useInventory } from "./inventory-provider";
import { ItemCard } from "./item-card";
import { ItemFormModal } from "./item-form-modal";
import { SummaryCards } from "./summary-cards";

const FILTERS: Array<{ key: InventoryFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "available", label: "Available" },
  { key: "finished", label: "Finished" },
  { key: "low-stock", label: "Low stock" },
];

const ALL_CATEGORIES = "all";

export function InventoryView() {
  const { items, categories, isAdmin, summary, lowStockThreshold, remove } = useInventory();
  const { notify } = useToast();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InventoryFilter>("all");
  const [categoryId, setCategoryId] = useState<string>(ALL_CATEGORIES);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Item | null>(null);

  /**
   * Search and filters compose: the category select, the status filter and the
   * text query all narrow the same list rather than overriding each other.
   */
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return items.filter((item) => {
      if (categoryId !== ALL_CATEGORIES && item.category_id !== categoryId) return false;

      const status = deriveStatus(item.quantity);
      if (filter === "available" && status !== "available") return false;
      if (filter === "finished" && status !== "finished") return false;
      if (filter === "low-stock" && !isLowStock(item.quantity, lowStockThreshold)) return false;

      if (needle.length === 0) return true;

      // Matches item name or category name, as a substring, so "choc" finds
      // both "Chocolate" and "Chocolate Biscuits".
      return (
        item.name.toLowerCase().includes(needle) ||
        (item.category?.name.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [items, query, filter, categoryId, lowStockThreshold]);

  const available = visible.filter((item) => deriveStatus(item.quantity) === "available");
  const finished = visible.filter((item) => deriveStatus(item.quantity) === "finished");

  const isSearching = query.trim().length > 0;
  const isFiltering = filter !== "all" || categoryId !== ALL_CATEGORIES;

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(item: Item) {
    setEditing(item);
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    const result = await remove(target);
    setPendingDelete(null);
    notify(
      result.ok ? `Deleted "${target.name}".` : result.error,
      result.ok ? "success" : "error",
    );
  }

  function clearFilters() {
    setQuery("");
    setFilter("all");
    setCategoryId(ALL_CATEGORIES);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">Inventory</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Everything in your drawer, available and finished.
          </p>
        </div>
        {isAdmin ? (
          <Button onClick={openAdd}>
            <Plus className="size-4" aria-hidden />
            Add item
          </Button>
        ) : null}
      </div>

      <SummaryCards summary={summary} activeFilter={filter} onSelect={setFilter} />

      <div className="space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-sm shadow-black/[0.03]">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-soft"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search inventory..."
              aria-label="Search inventory by item or category name"
              className="w-full rounded-xl border border-line bg-canvas py-2.5 pl-10 pr-9 text-sm text-ink transition placeholder:text-ink-soft/70 focus:border-brand-500 focus:bg-surface focus:outline-none"
            />
            {isSearching ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1 text-ink-soft transition hover:bg-line/60 hover:text-ink"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </div>

          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            aria-label="Filter by category"
            className="cursor-pointer rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-sm font-medium text-ink transition focus:border-brand-500 focus:bg-surface focus:outline-none sm:w-52"
          >
            <option value={ALL_CATEGORIES}>All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={cn(
                "cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
                filter === key
                  ? "bg-brand-600 text-white shadow-sm shadow-brand-600/25"
                  : "bg-canvas text-ink-soft hover:bg-line/60 hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}

          {isSearching || isFiltering ? (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto cursor-pointer text-sm font-semibold text-ink-soft underline-offset-4 transition hover:text-ink hover:underline"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {visible.length === 0 ? (
        isSearching || isFiltering ? (
          <EmptyState
            icon="🔍"
            title="No items found"
            message="Try a different search term or clear the filters."
            action={
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon="🥣"
            title="Nothing available"
            message="Your drawer is empty."
            action={
              isAdmin ? (
                <Button onClick={openAdd}>
                  <Plus className="size-4" aria-hidden />
                  Add your first item
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <div className="space-y-8">
          {filter !== "finished" ? (
            <Section
              title="Available"
              count={available.length}
              items={available}
              onEdit={openEdit}
              onDelete={setPendingDelete}
              empty={
                <EmptyState
                  icon="🥣"
                  title="Nothing available"
                  message={
                    isSearching || isFiltering
                      ? "No available items match these filters."
                      : "Your drawer is empty."
                  }
                />
              }
            />
          ) : null}

          {filter !== "available" && filter !== "low-stock" ? (
            <Section
              title="Finished"
              count={finished.length}
              items={finished}
              onEdit={openEdit}
              onDelete={setPendingDelete}
              empty={
                <EmptyState
                  icon="🎉"
                  title="Nothing finished"
                  message="Everything is currently available."
                />
              }
            />
          ) : null}
        </div>
      )}

      {isAdmin ? (
        <>
          <ItemFormModal open={formOpen} item={editing} onClose={() => setFormOpen(false)} />
          <ConfirmDialog
            open={pendingDelete !== null}
            title={`Delete "${pendingDelete?.name ?? ""}"?`}
            message="This action cannot be undone."
            confirmLabel="Delete"
            onConfirm={confirmDelete}
            onCancel={() => setPendingDelete(null)}
          />
        </>
      ) : null}
    </div>
  );
}

type SectionProps = {
  title: string;
  count: number;
  items: Item[];
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
  empty: React.ReactNode;
};

function Section({ title, count, items, onEdit, onDelete, empty }: SectionProps) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-ink">
        {title}
        <span className="rounded-full bg-canvas px-2 py-0.5 text-sm font-semibold text-ink-soft">
          {count}
        </span>
      </h2>

      {count === 0 ? (
        empty
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </section>
  );
}
