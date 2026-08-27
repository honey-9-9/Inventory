import { ArrowRight, PackagePlus, PackageX, Pencil, Sigma } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { RelativeTime } from "@/components/ui/relative-time";
import type { ActivityEntry } from "@/lib/types";

const ACTION_META: Record<
  ActivityEntry["action"],
  { icon: typeof PackagePlus; styles: string }
> = {
  created: { icon: PackagePlus, styles: "bg-available-bg text-available-fg" },
  quantity_changed: { icon: Sigma, styles: "bg-brand-50 text-brand-700" },
  updated: { icon: Pencil, styles: "bg-canvas text-ink-soft" },
  deleted: { icon: PackageX, styles: "bg-finished-bg text-finished-fg" },
};

/** Renders the log row as a sentence, using the old/new values when present. */
function describe(entry: ActivityEntry): React.ReactNode {
  switch (entry.action) {
    case "created":
      return "Added to inventory";
    case "deleted":
      return "Deleted from inventory";
    case "updated":
      return "Details updated";
    case "quantity_changed":
      return (
        <span className="inline-flex items-center gap-1.5">
          Quantity changed from
          <span className="font-semibold text-ink">{entry.old_value}</span>
          <ArrowRight className="size-3.5 text-ink-soft" aria-hidden />
          <span className="font-semibold text-ink">{entry.new_value}</span>
        </span>
      );
  }
}

export function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon="🕓"
        title="No activity yet"
        message="Changes to your inventory will show up here."
      />
    );
  }

  return (
    <ol className="space-y-1">
      {entries.map((entry) => {
        const { icon: Icon, styles } = ACTION_META[entry.action];
        return (
          <li key={entry.id} className="flex items-start gap-3 rounded-xl px-1 py-2.5">
            <span
              aria-hidden
              className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl ${styles}`}
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink">{entry.item_name}</p>
              <p className="text-sm text-ink-soft">{describe(entry)}</p>
              <p className="mt-0.5 text-xs text-ink-soft/80">
                <RelativeTime iso={entry.created_at} />
                {entry.user ? ` · ${entry.user.name}` : " · sample data"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
