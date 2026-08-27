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

  const [items, categories, activity, lowStockThreshold] = await Promise.all([
    getItems(),
    getCategories(),
    getRecentActivity(),
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
