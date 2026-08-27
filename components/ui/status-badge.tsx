import { cn } from "@/lib/cn";
import { deriveStatus, isLowStock } from "@/lib/status";

type StatusBadgeProps = {
  quantity: number;
  lowStockThreshold: number;
  className?: string;
};

/**
 * Renders the derived status. Low stock is shown in place of "Available" when
 * it applies, because a nearly-empty item is the thing worth noticing.
 */
export function StatusBadge({ quantity, lowStockThreshold, className }: StatusBadgeProps) {
  const status = deriveStatus(quantity);
  const low = isLowStock(quantity, lowStockThreshold);

  const { label, dot, styles } =
    status === "finished"
      ? { label: "Finished", dot: "bg-finished-fg", styles: "bg-finished-bg text-finished-fg" }
      : low
        ? { label: "Low stock", dot: "bg-low-fg", styles: "bg-low-bg text-low-fg" }
        : { label: "Available", dot: "bg-available-fg", styles: "bg-available-bg text-available-fg" };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        styles,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", dot)} aria-hidden />
      {label}
    </span>
  );
}
