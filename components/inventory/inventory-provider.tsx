"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { adjustQuantity, createItem, deleteItem, updateItem } from "@/app/actions/items";
import { useToast } from "@/components/ui/toast";
import { summarise } from "@/lib/status";
import type {
  ActionResult,
  ActivityEntry,
  CategoryRow,
  Item,
  UserRole,
} from "@/lib/types";

type InventoryContextValue = {
  items: Item[];
  categories: CategoryRow[];
  activity: ActivityEntry[];
  lowStockThreshold: number;
  role: UserRole;
  isAdmin: boolean;
  summary: ReturnType<typeof summarise>;
  /** Item ids with a quantity change in flight - used to disable the +/- pair. */
  busyItemIds: ReadonlySet<string>;
  adjust: (item: Item, delta: number) => Promise<void>;
  add: (formData: FormData) => Promise<ActionResult<Item>>;
  edit: (id: string, formData: FormData) => Promise<ActionResult<Item>>;
  remove: (item: Item) => Promise<ActionResult<string>>;
};

const InventoryContext = createContext<InventoryContextValue | null>(null);

type ProviderProps = {
  role: UserRole;
  initialItems: Item[];
  initialCategories: CategoryRow[];
  initialActivity: ActivityEntry[];
  lowStockThreshold: number;
  children: React.ReactNode;
};

function sortItems(items: Item[]): Item[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

/**
 * Holds the inventory in client state so the whole app - dashboard totals,
 * the Available and Finished sections, the summary cards - reacts to a single
 * +/- tap immediately, with no page reload and no waiting on a round trip.
 *
 * The server stays the source of truth: every change is still written through
 * a server action, and `router.refresh()` reconciles the server-rendered parts
 * (like the activity feed) afterwards.
 */
export function InventoryProvider({
  role,
  initialItems,
  initialCategories,
  initialActivity,
  lowStockThreshold,
  children,
}: ProviderProps) {
  const router = useRouter();
  const { notify } = useToast();

  const [items, setItems] = useState<Item[]>(() => sortItems(initialItems));
  const [busyItemIds, setBusyItemIds] = useState<ReadonlySet<string>>(() => new Set());

  // Counts quantity changes still in flight per item. While an item has any,
  // a slower response (or a background refresh) must not overwrite the newer
  // optimistic value the user is already looking at.
  const inFlight = useRef(new Map<string, number>());

  const beginAdjust = useCallback((id: string) => {
    inFlight.current.set(id, (inFlight.current.get(id) ?? 0) + 1);
    setBusyItemIds(new Set(inFlight.current.keys()));
  }, []);

  const endAdjust = useCallback((id: string) => {
    const remaining = (inFlight.current.get(id) ?? 1) - 1;
    if (remaining <= 0) inFlight.current.delete(id);
    else inFlight.current.set(id, remaining);
    setBusyItemIds(new Set(inFlight.current.keys()));
    return remaining <= 0;
  }, []);

  // Re-sync when the server sends fresh data (router.refresh, navigation),
  // but never while the user has an unresolved optimistic change pending.
  useEffect(() => {
    if (inFlight.current.size > 0) return;
    setItems(sortItems(initialItems));
  }, [initialItems]);

  const replaceItem = useCallback((updated: Item) => {
    setItems((current) =>
      sortItems(current.map((item) => (item.id === updated.id ? updated : item))),
    );
  }, []);

  const adjust = useCallback(
    async (item: Item, delta: number) => {
      // Clamped locally too, so the optimistic number shown can never be
      // negative even for a moment.
      const optimisticQuantity = Math.max(0, item.quantity + delta);
      if (optimisticQuantity === item.quantity) return;

      beginAdjust(item.id);
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, quantity: optimisticQuantity } : entry,
        ),
      );

      const result = await adjustQuantity(item.id, delta);
      const settled = endAdjust(item.id);

      if (!result.ok) {
        // Put the real value back and tell the user why nothing happened.
        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id ? { ...entry, quantity: item.quantity } : entry,
          ),
        );
        notify(result.error, "error");
        router.refresh();
        return;
      }

      if (settled) replaceItem(result.data);
      router.refresh();
    },
    [beginAdjust, endAdjust, notify, replaceItem, router],
  );

  const add = useCallback(
    async (formData: FormData) => {
      const result = await createItem(formData);
      if (result.ok) {
        setItems((current) => sortItems([...current, result.data]));
        router.refresh();
      }
      return result;
    },
    [router],
  );

  const edit = useCallback(
    async (id: string, formData: FormData) => {
      const result = await updateItem(id, formData);
      if (result.ok) {
        replaceItem(result.data);
        router.refresh();
      }
      return result;
    },
    [replaceItem, router],
  );

  const remove = useCallback(
    async (item: Item) => {
      const result = await deleteItem(item.id);
      if (result.ok) {
        setItems((current) => current.filter((entry) => entry.id !== item.id));
        router.refresh();
      }
      return result;
    },
    [router],
  );

  const value = useMemo<InventoryContextValue>(
    () => ({
      items,
      categories: initialCategories,
      activity: initialActivity,
      lowStockThreshold,
      role,
      isAdmin: role === "admin",
      summary: summarise(items, lowStockThreshold),
      busyItemIds,
      adjust,
      add,
      edit,
      remove,
    }),
    [
      items,
      initialCategories,
      initialActivity,
      lowStockThreshold,
      role,
      busyItemIds,
      adjust,
      add,
      edit,
      remove,
    ],
  );

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (!context) throw new Error("useInventory must be used inside an InventoryProvider");
  return context;
}
