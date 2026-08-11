"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Clock, MapPin, Utensils } from "lucide-react";
import type { Truck } from "@/lib/types";
import { Rating } from "./rating";
import { StatusBadge } from "./status-badge";
import { Chip } from "./chip";
import { TruckPhoto } from "./truck-photo";
import { titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Deterministic pseudo-distance so cards feel located without real geo. */
function distanceOf(id: string): string {
  const h = Array.from(id).reduce((a, c) => a + c.charCodeAt(0), 0);
  return (0.1 + (h % 22) / 10).toFixed(1);
}

export function TruckCard({
  truck,
  reason,
  className,
  index = 0,
}: {
  truck: Truck;
  reason?: string;
  className?: string;
  index?: number;
}) {
  const wait = truck.queue_min ?? truck.prep_min ?? null;
  const topDish = truck.menu[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.4) }}
      whileHover={{ y: -4 }}
      className={cn("group h-full", className)}
    >
      <Link
        href={`/trucks/${truck.id}`}
        className="flex h-full flex-col overflow-hidden rounded-[20px] border border-border bg-card shadow-sky-sm transition-shadow hover:shadow-sky-md"
      >
        <div className="relative">
          <TruckPhoto truck={truck} className="aspect-[16/10]" />
          <div className="absolute left-3 top-3">
            <StatusBadge status={truck.status} />
          </div>
          <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-petrol shadow-sm backdrop-blur">
            {truck.price_tier}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-[17px] font-bold leading-tight text-petrol dark:text-white">
                {truck.name}
              </h3>
              <p className="mt-0.5 truncate text-sm text-ink-secondary">
                {truck.cuisines.slice(0, 2).map(titleCase).join(" · ")}
              </p>
            </div>
            <Rating value={truck.rating} className="shrink-0 text-sm" />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-ink-secondary">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5 text-turquoise" />
              {distanceOf(truck.id)} mi
            </span>
            {wait != null && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5 text-turquoise" />~{wait} min
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Utensils className="size-3.5 text-turquoise" />
              {truck.menu.length} items
            </span>
          </div>

          {reason ? (
            <Chip variant="ai" className="w-fit max-w-full">
              <span className="truncate">✨ {reason}</span>
            </Chip>
          ) : (
            topDish && (
              <div className="mt-auto flex items-center justify-between rounded-xl bg-[#F7FBFB] px-3 py-2 text-sm dark:bg-white/5">
                <span className="truncate text-ink-secondary">
                  {topDish.emoji} {topDish.name}
                </span>
                <span className="font-bold text-petrol dark:text-white">
                  ${topDish.price.toFixed(2)}
                </span>
              </div>
            )
          )}
        </div>
      </Link>
    </motion.div>
  );
}
