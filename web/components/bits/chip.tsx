import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type ChipVariant =
  | "normal"
  | "success"
  | "ai"
  | "reward"
  | "warning"
  | "petrol";

const styles: Record<ChipVariant, string> = {
  normal:
    "bg-[#F5FAFA] text-ink-secondary border-border dark:bg-white/5 dark:text-white/70",
  success: "bg-mint-soft text-[#356D4B] border-transparent dark:bg-leaf/20 dark:text-mint-soft",
  ai: "bg-blue-soft text-petrol border-transparent dark:bg-turquoise/20 dark:text-blue-soft",
  reward: "bg-yellow-soft text-[#795E0A] border-transparent dark:bg-butter/20 dark:text-butter",
  warning: "bg-orange-soft text-[#C94D2A] border-transparent dark:bg-tangerine/20 dark:text-orange-soft",
  petrol: "bg-petrol text-white border-transparent",
};

export function Chip({
  children,
  variant = "normal",
  className,
  icon,
}: {
  children: ReactNode;
  variant?: ChipVariant;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
        styles[variant],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
