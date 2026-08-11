import { cn } from "@/lib/utils";

/**
 * A quiet gradient tile carrying a food emoji — stands in for dish photography
 * (menu items have no photos in the dataset) while keeping the UI airy.
 */
export function DishTile({
  emoji,
  vegan = false,
  className,
  size = "md",
}: {
  emoji: string;
  vegan?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dims =
    size === "sm" ? "size-12 text-2xl" : size === "lg" ? "size-full text-6xl" : "size-16 text-3xl";
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-2xl border border-border/70",
        vegan
          ? "bg-gradient-to-br from-mint-soft to-[#f4fbf6]"
          : "bg-gradient-to-br from-[#FFF6ED] via-white to-blue-soft",
        dims,
        className,
      )}
      aria-hidden
    >
      <span className="drop-shadow-sm">{emoji}</span>
    </span>
  );
}
