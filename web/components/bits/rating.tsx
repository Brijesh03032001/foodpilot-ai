import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Rating({
  value,
  count,
  size = 14,
  className,
}: {
  value: number | null;
  count?: number | null;
  size?: number;
  className?: string;
}) {
  if (value == null) return null;
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <Star
        className="fill-butter text-butter"
        style={{ width: size, height: size }}
      />
      <span className="font-bold text-petrol dark:text-white">
        {value.toFixed(1)}
      </span>
      {count != null && (
        <span className="text-ink-muted">({count.toLocaleString()})</span>
      )}
    </span>
  );
}
