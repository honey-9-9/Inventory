import { AppShell } from "@/components/app-shell";
import { InventoryProvider } from "@/components/inventory/inventory-provider";
import { requireUser } from "@/lib/auth";
import { getCategories, getItems, getLowStockThreshold, getRecentActivity } from "@/lib/data";

/**
 * Every signed-in page shares this layout, so the inventory is fetched once
 * and handed to a client provider. That is what lets a +/- tap on the
 * dashboard update the totals, the cards and the Finished section at once.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  // The audit trail is admin-only, so a viewer's request never asks for it and
  // no history ever reaches their browser payload.
  const [items, categories, activity, lowStockThreshold] = await Promise.all([
    getItems(),
    getCategories(),
    user.role === "admin" ? getRecentActivity() : Promise.resolve([]),
    getLowStockThreshold(),
  ]);

  return (
    <AppShell user={user}>
      <InventoryProvider
        role={user.role}
        initialItems={items}
        initialCategories={categories}
        initialActivity={activity}
        lowStockThreshold={lowStockThreshold}
      >
        {children}
      </InventoryProvider>
    </AppShell>
  );
}
