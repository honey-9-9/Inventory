import type { Metadata } from "next";

import { ActivityFeed } from "@/components/activity-feed";
import { requireUser } from "@/lib/auth";
import { getRecentActivity } from "@/lib/data";

export const metadata: Metadata = {
  title: "Activity · Drawer Inventory",
};

/**
 * History is readable by both roles but writable by neither: rows are appended
 * only by the database trigger on `items`.
 */
export default async function ActivityPage() {
  await requireUser();
  const entries = await getRecentActivity(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Activity</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Every change to the inventory, newest first.
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-3 shadow-sm shadow-black/[0.03] sm:p-4">
        <ActivityFeed entries={entries} />
      </div>
    </div>
  );
}
