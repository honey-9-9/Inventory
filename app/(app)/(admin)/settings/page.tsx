import type { Metadata } from "next";

import { SettingsView } from "@/components/settings/settings-view";
import { requireAdmin } from "@/lib/auth";
import { getItems, getLowStockThreshold } from "@/lib/data";

export const metadata: Metadata = {
  title: "Settings · Drawer Inventory",
};

export default async function SettingsPage() {
  const [user, items, lowStockThreshold] = await Promise.all([
    requireAdmin(),
    getItems(),
    getLowStockThreshold(),
  ]);

  return (
    <SettingsView
      user={user}
      lowStockThreshold={lowStockThreshold}
      demoItemCount={items.filter((item) => item.is_demo).length}
    />
  );
}
