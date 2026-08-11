import { cn } from "@/lib/utils";

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const open = status === "open";
  const label = open ? "Open now" : status === "offline" ? "Offline" : "Closed";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
        open
          ? "bg-mint-soft text-[#2f6a48] dark:bg-leaf/20 dark:text-mint-soft"
          : "bg-[#F1F4F5] text-ink-muted dark:bg-white/5",
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          open ? "bg-leaf" : "bg-ink-muted",
          open && "animate-pulse",
        )}
      />
      {label}
    </span>
  );
}
