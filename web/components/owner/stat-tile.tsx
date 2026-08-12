"use client";

import { motion } from "motion/react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  icon: Icon,
  delta,
  index = 0,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  delta?: { value: string; positive: boolean };
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className="rounded-[20px] border border-border bg-card p-5 shadow-sky-sm"
    >
      <div className="flex items-center justify-between">
        <span className="grid size-9 place-items-center rounded-xl bg-blue-soft text-turquoise">
          <Icon className="size-[18px]" />
        </span>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold",
              delta.positive
                ? "bg-mint-soft text-leaf"
                : "bg-[#FDECEA] text-danger",
            )}
          >
            {delta.positive ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {delta.value}
          </span>
        )}
      </div>
      <p className="mt-4 text-[32px] font-extrabold leading-none tracking-tight text-petrol dark:text-white">
        {value}
      </p>
      <p className="mt-1.5 text-sm font-medium text-ink-secondary">{label}</p>
    </motion.div>
  );
}
