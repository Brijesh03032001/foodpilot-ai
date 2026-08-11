"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Check, Clock, MapPin, ChefHat, PackageCheck, Receipt } from "lucide-react";
import { useStore } from "@/lib/store";
import { money, lineTotal } from "@/lib/format";

const STEPS = [
  { label: "Received", icon: Check, state: "done" },
  { label: "Preparing", icon: ChefHat, state: "active" },
  { label: "Ready for pickup", icon: PackageCheck, state: "pending" },
] as const;

export function OrderConfirmation() {
  const router = useRouter();
  const { confirmedOrder } = useStore();

  useEffect(() => {
    if (confirmedOrder === null) {
      const t = setTimeout(() => router.replace("/discover"), 2500);
      return () => clearTimeout(t);
    }
  }, [confirmedOrder, router]);

  if (!confirmedOrder) {
    return (
      <div className="app-container py-24 text-center">
        <p className="text-ink-secondary">No recent order — taking you back to Discover…</p>
      </div>
    );
  }

  const o = confirmedOrder;

  return (
    <div className="app-container max-w-2xl py-10">
      {/* success */}
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="mx-auto grid size-20 place-items-center rounded-full bg-mint-soft"
        >
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
          >
            <Check className="size-10 text-leaf" strokeWidth={3} />
          </motion.span>
        </motion.div>
        <h1 className="mt-5 font-display text-4xl leading-tight text-petrol dark:text-white">
          Order sent to the kitchen!
        </h1>
        <p className="mt-2 text-ink-secondary">
          {o.truckName} got your order. Order{" "}
          <span className="font-bold text-petrol dark:text-white">#{o.id}</span>
        </p>
      </div>

      {/* progress */}
      <div className="mt-8 rounded-[24px] border border-border bg-card p-6 shadow-sky-sm">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s.label} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <span className={i === 0 ? "flex-1" : "h-0.5 flex-1 " + (s.state !== "pending" ? "bg-leaf" : "bg-border")} />
                <motion.span
                  initial={{ scale: 0.6 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1 * i }}
                  className={
                    "grid size-10 place-items-center rounded-full " +
                    (s.state === "done"
                      ? "bg-leaf text-white"
                      : s.state === "active"
                        ? "bg-tangerine text-white shadow-tangerine"
                        : "bg-muted text-ink-muted")
                  }
                >
                  <s.icon className="size-5" />
                </motion.span>
                <span className={i === STEPS.length - 1 ? "flex-1" : "h-0.5 flex-1 " + (STEPS[i + 1]?.state !== "pending" ? "bg-leaf" : "bg-border")} />
              </div>
              <span className="mt-2 text-center text-xs font-semibold text-petrol dark:text-white">
                {s.label}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-orange-soft py-2.5 text-sm font-bold text-[#C94D2A]">
          <Clock className="size-4" /> Ready in about {o.etaMin} minutes
        </div>
      </div>

      {/* pickup */}
      <div className="mt-5 grid gap-5 sm:grid-cols-[1fr_auto]">
        <div className="rounded-[24px] border border-border bg-card p-5 shadow-sky-sm">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-petrol dark:text-white">
            <MapPin className="size-4 text-turquoise" /> Pickup location
          </h3>
          <p className="font-semibold text-petrol dark:text-white">{o.truckName}</p>
          {o.pickup && <p className="text-sm text-ink-secondary">{o.pickup}</p>}
        </div>
        <div className="relative hidden aspect-square w-40 overflow-hidden rounded-[24px] border border-border bg-blue-soft sm:block">
          <Image src="/images/gps-truck.png" alt="Map" fill sizes="160px" className="object-contain p-2" />
        </div>
      </div>

      {/* receipt */}
      <div className="mt-5 rounded-[24px] border border-border bg-card p-5 shadow-sky-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-petrol dark:text-white">
          <Receipt className="size-4 text-turquoise" /> Receipt
        </h3>
        <div className="space-y-2">
          {o.lines.map((line) => (
            <div key={line.id} className="flex items-center justify-between text-sm">
              <span className="text-ink-secondary">
                <span className="font-semibold text-petrol dark:text-white">{line.quantity}×</span>{" "}
                {line.emoji} {line.name}
              </span>
              <span className="font-semibold text-petrol dark:text-white">
                {money(lineTotal(line.basePrice, line.quantity, line.mods))}
              </span>
            </div>
          ))}
          <div className="my-2 h-px bg-border" />
          <ReceiptRow label="Subtotal" value={money(o.subtotal)} />
          <ReceiptRow label="Tax" value={money(o.tax)} />
          <ReceiptRow label="Tip" value={money(o.tip)} />
          <div className="my-1 h-px bg-border" />
          <div className="flex items-center justify-between">
            <span className="font-bold text-petrol dark:text-white">Total paid</span>
            <span className="text-xl font-extrabold text-petrol dark:text-white">{money(o.total)}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/discover"
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-tangerine py-3.5 font-bold text-white shadow-tangerine transition hover:bg-tangerine-hover"
        >
          Order something else
        </Link>
        <Link
          href={`/trucks/${o.truckId}`}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-petrol bg-white py-3.5 font-bold text-petrol transition hover:bg-blue-soft dark:bg-transparent dark:text-white"
        >
          View {o.truckName}
        </Link>
      </div>
    </div>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className="text-ink-secondary">{value}</span>
    </div>
  );
}
