"use client";

import { cn } from "@/lib/utils";
import type { Source } from "@/lib/use-sales";

/** Tiny indicator: is this data live from the backend, or the local sample? */
export function SourceBadge({
  source,
  loading,
  liveLabel = "Live · Java + SQL",
  className,
}: {
  source: Source;
  loading?: boolean;
  liveLabel?: string;
  className?: string;
}) {
  const live = source === "live";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
        live ? "bg-mint-soft text-leaf" : "bg-yellow-soft text-[#795E0A]",
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          loading ? "bg-turquoise animate-pulse" : live ? "bg-leaf animate-pulse" : "bg-warning",
        )}
      />
      {loading ? "Connecting…" : live ? liveLabel : "Sample data"}
    </span>
  );
}
