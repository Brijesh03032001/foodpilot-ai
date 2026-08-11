"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** The FoodPilot robot mascot with a tiny floating movement. */
export function Mascot({
  variant = "logo",
  size = 56,
  float = true,
  className,
}: {
  variant?: "logo" | "hi";
  size?: number;
  float?: boolean;
  className?: string;
}) {
  void variant; // brand logo used for all mascot variants
  const src = "/images/logo.png";
  return (
    <motion.div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      animate={float ? { y: [0, -6, 0] } : undefined}
      transition={
        float
          ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" }
          : undefined
      }
    >
      <Image
        src={src}
        alt="FoodPilot assistant"
        fill
        sizes={`${size}px`}
        className="object-contain drop-shadow-[0_8px_18px_rgba(18,60,74,0.18)]"
      />
    </motion.div>
  );
}
