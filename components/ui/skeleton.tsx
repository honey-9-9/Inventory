import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-line/70", className)} aria-hidden />;
}

export function SummarySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="rounded-2xl border border-line bg-surface p-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-3 h-8 w-12" />
        </div>
      ))}
    </div>
  );
}

export function ItemGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-2xl border border-line bg-surface p-5">
          <Skeleton className="size-12 rounded-2xl" />
          <Skeleton className="mt-4 h-5 w-28" />
          <Skeleton className="mt-2 h-4 w-20" />
          <Skeleton className="mt-5 h-4 w-24" />
          <Skeleton className="mt-4 h-11 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <SummarySkeleton />
      <ItemGridSkeleton />
    </div>
  );
}
