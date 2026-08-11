"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** AI thinking indicator: turquoise → butter → turquoise (never purple). */
export function Thinking({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) {
  const dots = ["#2A9D9A", "#FFD76A", "#2A9D9A"];
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="inline-flex items-center gap-1">
        {dots.map((c, i) => (
          <motion.span
            key={i}
            className="size-1.5 rounded-full"
            style={{ background: c }}
            animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
            transition={{
              duration: 0.9,
              repeat: Infinity,
              delay: i * 0.15,
              ease: "easeInOut",
            }}
          />
        ))}
      </span>
      {label && (
        <span className="text-sm font-medium text-ink-secondary">{label}</span>
      )}
    </span>
  );
}
