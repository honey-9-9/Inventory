"use client";

import { useEffect, useState } from "react";

import { absoluteTime, relativeTime } from "@/lib/format";

const REFRESH_INTERVAL_MS = 30_000;

/**
 * Shows "5 minutes ago" and keeps it current.
 *
 * The label is derived during render rather than pushed into state from an
 * effect; the interval just bumps a counter to schedule the next render.
 *
 * Server and browser format from clocks a moment apart, so hydration warnings
 * are suppressed on this one element rather than papered over globally.
 */
export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((tick) => tick + 1), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <time
      dateTime={iso}
      title={absoluteTime(iso)}
      className={className}
      suppressHydrationWarning
    >
      {relativeTime(iso)}
    </time>
  );
}
