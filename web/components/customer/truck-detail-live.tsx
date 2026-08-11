"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import type { Truck } from "@/lib/types";
import { TruckDetail } from "./truck-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { Thinking } from "@/components/bits/thinking";

/**
 * Renders a truck that isn't in the curated featured set by fetching its full
 * record from the gateway (`GET /api/trucks/{id}` → Python catalog). Lets the
 * concierge link to any of the 107 trucks.
 */
export function TruckDetailLive({ id }: { id: string }) {
  const [truck, setTruck] = useState<Truck | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .getTruck(id)
      .then((t) => alive && setTruck(t))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [id]);

  if (truck) return <TruckDetail truck={truck} />;

  if (error) {
    return (
      <div className="app-container py-20 text-center">
        <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-orange-soft text-3xl">
          🚚
        </div>
        <h1 className="text-xl font-bold text-petrol dark:text-white">Truck not found</h1>
        <p className="mx-auto mt-1 max-w-sm text-sm text-ink-secondary">
          We couldn&apos;t load this truck. It may be offline, or the backend isn&apos;t running.
        </p>
        <Link
          href="/discover"
          className="mt-5 inline-flex items-center gap-2 rounded-xl border border-petrol bg-white px-4 py-2 text-sm font-bold text-petrol transition hover:bg-blue-soft dark:bg-transparent dark:text-white"
        >
          <ArrowLeft className="size-4" /> Back to Discover
        </Link>
      </div>
    );
  }

  return (
    <div className="app-container py-6 sm:py-8">
      <div className="mb-4">
        <Thinking label="Loading truck…" />
      </div>
      <Skeleton className="aspect-[21/9] w-full rounded-[28px]" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-[24px]" />
      </div>
    </div>
  );
}
