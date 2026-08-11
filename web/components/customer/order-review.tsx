"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowLeft, ShieldCheck, ChefHat, Lock } from "lucide-react";
import { useStore } from "@/lib/store";
import { getTruck } from "@/lib/data";
import { money, lineTotal } from "@/lib/format";
import { OrderLineRow } from "./order-builder";
import { cn } from "@/lib/utils";

const TAX_RATE = 0.0863;
const TIPS = [0, 0.1, 0.15, 0.2];

export function OrderReview() {
  const router = useRouter();
  const { order, orderSubtotal, setConfirmedOrder, clearOrder } = useStore();
  const [tipPct, setTipPct] = useState(0.15);
  const [sending, setSending] = useState(false);

  if (order.length === 0) {
    return (
      <div className="app-container py-20 text-center">
        <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-blue-soft text-4xl">
          🧾
        </div>
        <h1 className="text-2xl font-bold text-petrol dark:text-white">Nothing to review yet</h1>
        <p className="mx-auto mt-2 max-w-sm text-ink-secondary">
          Build an order first, then come back to review and send it to the kitchen.
        </p>
        <Link
          href="/order"
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-tangerine px-6 py-3 font-bold text-white shadow-tangerine transition hover:bg-tangerine-hover"
        >
          Go to Order Builder
        </Link>
      </div>
    );
  }

  const tax = orderSubtotal * TAX_RATE;
  const tip = orderSubtotal * tipPct;
  const total = orderSubtotal + tax + tip;
  const truck = getTruck(order[0].truckId);
  const eta = (truck?.prep_min ?? 12) + (truck?.queue_min ?? 5);

  function sendToKitchen() {
    setSending(true);
    setTimeout(() => {
      const id = "FP-" + Math.random().toString(36).slice(2, 7).toUpperCase();
      setConfirmedOrder({
        id,
        lines: order,
        subtotal: orderSubtotal,
        tax,
        tip,
        total,
        truckId: truck?.id ?? order[0].truckId,
        truckName: truck?.name ?? order[0].truckName,
        placedAt: new Date().toISOString(),
        etaMin: eta,
        pickup: truck?.address ?? null,
      });
      clearOrder();
      router.push("/order/confirmation");
    }, 1100);
  }

  return (
    <div className="app-container max-w-2xl py-8">
      <Link
        href="/order"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-secondary transition hover:text-petrol dark:hover:text-white"
      >
        <ArrowLeft className="size-4" /> Back to edit
      </Link>

      <h1 className="font-display text-[clamp(28px,4vw,40px)] leading-tight tracking-tight text-petrol dark:text-white">
        Review &amp; confirm
      </h1>

      {/* approval-gate note */}
      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-turquoise/25 bg-blue-soft/60 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-turquoise" />
        <p className="text-sm text-ink-secondary">
          <span className="font-bold text-petrol dark:text-white">You approve before anything is cooked.</span>{" "}
          This is the deliberate human-in-the-loop pause — nothing is sent to the kitchen until you
          confirm below.
        </p>
      </div>

      {/* itemized summary */}
      <div className="mt-6 rounded-[24px] border border-border bg-card p-5 shadow-sky-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-petrol dark:text-white">{truck?.name}</h2>
          <span className="text-sm text-ink-muted">Pickup · ~{eta} min</span>
        </div>
        <div className="space-y-3">
          {order.map((line) => (
            <OrderLineRow key={line.id} line={line} readOnly />
          ))}
        </div>
      </div>

      {/* tip */}
      <div className="mt-5 rounded-[24px] border border-border bg-card p-5 shadow-sky-sm">
        <h3 className="mb-3 text-sm font-bold text-petrol dark:text-white">Add a tip</h3>
        <div className="grid grid-cols-4 gap-2">
          {TIPS.map((t) => (
            <button
              key={t}
              onClick={() => setTipPct(t)}
              className={cn(
                "rounded-xl border py-2.5 text-sm font-bold transition",
                tipPct === t
                  ? "border-tangerine bg-orange-soft text-[#C94D2A]"
                  : "border-border bg-white text-ink-secondary hover:border-tangerine dark:bg-white/5",
              )}
            >
              {t === 0 ? "None" : `${t * 100}%`}
              {t > 0 && <span className="block text-[11px] font-medium opacity-70">{money(orderSubtotal * t)}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* totals */}
      <div className="mt-5 space-y-2 rounded-[24px] border border-border bg-card p-5 shadow-sky-sm">
        <TotalRow label="Subtotal" value={money(orderSubtotal)} />
        <TotalRow label={`Tax (${(TAX_RATE * 100).toFixed(2)}%)`} value={money(tax)} muted />
        <TotalRow label="Tip" value={money(tip)} muted />
        <div className="my-2 h-px bg-border" />
        <TotalRow label="Total" value={money(total)} big />
      </div>

      {/* confirm */}
      <motion.button
        whileTap={{ scale: 0.99 }}
        onClick={sendToKitchen}
        disabled={sending}
        className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-tangerine py-4 text-lg font-extrabold text-white shadow-tangerine-lg transition hover:-translate-y-0.5 hover:bg-tangerine-hover disabled:opacity-70"
      >
        {sending ? (
          <>
            <span className="size-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Sending…
          </>
        ) : (
          <>
            <ChefHat className="size-5" /> Send to Kitchen · {money(total)}
          </>
        )}
      </motion.button>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-muted">
        <Lock className="size-3.5" /> This is the irreversible step — you won&apos;t be charged in this demo.
      </p>
    </div>
  );
}

function TotalRow({
  label,
  value,
  muted,
  big,
}: {
  label: string;
  value: string;
  muted?: boolean;
  big?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn(big ? "text-base font-bold text-petrol dark:text-white" : "text-sm", muted ? "text-ink-muted" : "text-ink-secondary")}>
        {label}
      </span>
      <span
        className={cn(
          big ? "text-2xl font-extrabold text-petrol dark:text-white" : "text-sm font-semibold",
          !big && (muted ? "text-ink-secondary" : "text-petrol dark:text-white"),
        )}
      >
        {value}
      </span>
    </div>
  );
}
