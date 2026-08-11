"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { money } from "@/lib/format";

/** Sticky order affordance — appears above the mobile bottom nav when non-empty. */
export function OrderBar() {
  const { orderCount, orderSubtotal } = useStore();

  return (
    <AnimatePresence>
      {orderCount > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="fixed inset-x-0 bottom-24 z-40 px-4 md:bottom-6"
        >
          <Link
            href="/order"
            className="mx-auto flex max-w-lg items-center justify-between gap-4 rounded-2xl bg-petrol px-4 py-3 text-white shadow-sky-lg transition hover:bg-petrol-deep"
          >
            <span className="flex items-center gap-3">
              <span className="relative grid size-10 place-items-center rounded-xl bg-white/10">
                <ShoppingBag className="size-5" />
                <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-tangerine px-1 text-[10px] font-bold">
                  {orderCount}
                </span>
              </span>
              <span>
                <span className="block text-xs text-white/70">
                  {orderCount} {orderCount === 1 ? "item" : "items"}
                </span>
                <span className="block text-base font-extrabold">{money(orderSubtotal)}</span>
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-tangerine px-4 py-2.5 text-sm font-bold">
              Review order <ArrowRight className="size-4" />
            </span>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
