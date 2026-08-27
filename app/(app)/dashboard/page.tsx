import type { Metadata } from "next";

import { DashboardView } from "@/components/dashboard/dashboard-view";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Dashboard · Drawer Inventory",
};

export default async function DashboardPage() {
  const user = await requireUser();
  return <DashboardView userName={user.name} />;
}
