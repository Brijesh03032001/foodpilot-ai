"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Clock,
  MapPin,
  Phone,
  MessageCircle,
  CreditCard,
  ShoppingBag,
  Star,
} from "lucide-react";
import type { Truck } from "@/lib/types";
import { TruckPhoto } from "@/components/bits/truck-photo";
import { StatusBadge } from "@/components/bits/status-badge";
import { Rating } from "@/components/bits/rating";
import { Chip } from "@/components/bits/chip";
import { DishRow } from "./dish-row";
import { OrderBar } from "./order-bar";
import { titleCase } from "@/lib/format";

function groupMenu(truck: Truck) {
  const groups = new Map<string, typeof truck.menu>();
  for (const item of truck.menu) {
    const cat = titleCase(item.category);
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(item);
  }
  return [...groups.entries()];
}

export function TruckDetail({ truck }: { truck: Truck }) {
  const groups = groupMenu(truck);
  const wait = truck.queue_min ?? truck.prep_min;

  return (
    <div className="app-container py-6 sm:py-8">
      <Link
        href="/discover"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-secondary transition hover:text-petrol dark:hover:text-white"
      >
        <ArrowLeft className="size-4" /> Back to Discover
      </Link>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-[28px] border border-border shadow-sky-md"
      >
        <TruckPhoto truck={truck} className="aspect-[21/9] min-h-[220px]" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-petrol-deep/85 via-petrol-deep/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 p-5 sm:p-7">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <StatusBadge status={truck.status} />
              <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-petrol">
                {truck.price_tier}
              </span>
            </div>
            <h1 className="font-display text-4xl leading-none text-white drop-shadow sm:text-5xl">
              {truck.name}
            </h1>
            <p className="mt-2 text-sm font-medium text-white/85">
              {truck.cuisines.map(titleCase).join(" · ")}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-white/95 px-4 py-2.5 shadow-sky-sm">
            <Star className="size-5 fill-butter text-butter" />
            <div>
              <p className="text-lg font-extrabold leading-none text-petrol">
                {(truck.rating ?? 0).toFixed(1)}
              </p>
              <p className="text-xs text-ink-muted">{truck.review_count?.toLocaleString()} reviews</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* meta row */}
      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-ink-secondary">
        {truck.address && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4 text-turquoise" /> {truck.address}
          </span>
        )}
        {wait != null && (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-4 text-turquoise" /> ~{wait} min wait
          </span>
        )}
        {truck.phone && (
          <span className="inline-flex items-center gap-1.5">
            <Phone className="size-4 text-turquoise" /> {truck.phone}
          </span>
        )}
      </div>

      {truck.amenities.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {truck.amenities.map((a) => (
            <Chip key={a} variant="normal">
              {titleCase(a)}
            </Chip>
          ))}
        </div>
      )}

      {/* body: menu + info rail */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-petrol dark:text-white">Menu</h2>
            <Link
              href="/concierge"
              className="inline-flex items-center gap-1.5 rounded-xl border border-petrol bg-white px-3 py-1.5 text-sm font-bold text-petrol transition hover:bg-blue-soft dark:bg-transparent dark:text-white"
            >
              <MessageCircle className="size-4" /> Ask about this truck
            </Link>
          </div>

          <div className="space-y-8">
            {groups.map(([cat, items]) => (
              <section key={cat}>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-muted">
                  {cat}
                </h3>
                <div className="space-y-3">
                  {items.map((item) => (
                    <DishRow key={item.id} truck={truck} item={item} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Reviews */}
          {truck.reviews.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-4 text-2xl font-bold text-petrol dark:text-white">
                What people say
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {truck.reviews.slice(0, 4).map((r) => (
                  <div key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-sky-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-petrol dark:text-white">{r.author}</span>
                      <Rating value={r.rating} size={13} />
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                      &ldquo;{r.text}&rdquo;
                    </p>
                    {r.topics.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {r.topics.map((t) => (
                          <Chip
                            key={t}
                            variant={r.sentiment === "negative" ? "warning" : "success"}
                          >
                            {titleCase(t)}
                          </Chip>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Info rail */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-[24px] border border-border bg-card shadow-sky-sm">
            <div className="relative aspect-[4/3] bg-blue-soft">
              <Image
                src="/images/gps-truck.png"
                alt="Map location"
                fill
                sizes="320px"
                className="object-contain p-4"
              />
              <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-petrol shadow-sm">
                📍 {truck.neighborhood}
              </span>
            </div>
            <div className="space-y-3 p-4">
              {truck.hours_today && (
                <Row icon={<Clock className="size-4 text-turquoise" />} label="Today">
                  {truck.hours_today}
                </Row>
              )}
              <Row icon={<CreditCard className="size-4 text-turquoise" />} label="Payment">
                {truck.payment_methods.map(titleCase).join(", ")}
              </Row>
              <Row icon={<ShoppingBag className="size-4 text-turquoise" />} label="Order">
                {truck.order_type.map(titleCase).join(", ")}
              </Row>
            </div>
          </div>
        </aside>
      </div>

      <OrderBar />
    </div>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <span className="mt-0.5">{icon}</span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
        <p className="font-medium text-ink dark:text-white/90">{children}</p>
      </div>
    </div>
  );
}
