"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Plus,
  Minus,
  Trash2,
  Check,
  X,
  ArrowRight,
  Wand2,
  Info,
  ChevronDown,
  Flame,
  SlidersHorizontal,
} from "lucide-react";
import { trucks, getTruck } from "@/lib/data";
import { useStore } from "@/lib/store";
import { parseOrder, exampleOrderPrompt } from "@/lib/order-parser";
import { api } from "@/lib/api";
import { SourceBadge } from "@/components/bits/source-badge";
import type { Source } from "@/lib/use-sales";
import type { OrderLine, OrderMod, MenuItem } from "@/lib/types";
import { money, lineTotal, titleCase } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const TAX_RATE = 0.0863;
const trucksWithAddons = trucks.filter((t) => t.menu.some((m) => m.add_ons.length));

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function OrderBuilder() {
  const { order, setOrder, updateQty, removeLine, clearOrder, orderSubtotal } = useStore();

  const initialTruck =
    (order[0] && getTruck(order[0].truckId)) ??
    trucksWithAddons[0] ??
    trucks[0];
  const [truckId, setTruckId] = useState(initialTruck.id);
  const truck = getTruck(truckId) ?? initialTruck;

  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [source, setSource] = useState<Source>("mock");

  const example = useMemo(() => exampleOrderPrompt(truck), [truck]);

  async function handleParse(raw?: string) {
    const input = (raw ?? text).trim();
    if (!input) return;
    setParsing(true);
    setUnmatched([]);
    try {
      // real Phase-6 pipeline via the Spring Boot gateway → Python
      const r = await api.resolveOrder(input);
      if (r.matched) {
        const mi = trucks.flatMap((t) => t.menu).find((m) => m.id === r.itemId);
        const line: OrderLine = {
          id: uid(),
          itemId: r.itemId ?? "api",
          truckId: r.truckId ?? truck.id,
          truckName: r.truckName ?? truck.name,
          name: r.resolvedName ?? r.item,
          emoji: mi?.emoji ?? "🍽️",
          basePrice: r.basePrice ?? 0,
          quantity: r.quantity,
          mods: (r.mods ?? []).map((m) => ({
            type: m.type,
            name: m.name,
            priceDelta: m.priceDelta,
            status: m.status,
            reason: m.reason,
            appliesTo: m.appliesTo,
          })),
        };
        setOrder([...order, line]);
      } else {
        setUnmatched([input]);
      }
      setSource("live");
    } catch {
      // gateway/AI down → local mock parser
      const { lines, unmatched } = parseOrder(input, truck);
      if (lines.length) setOrder([...order, ...lines]);
      setUnmatched(unmatched);
      setSource("mock");
    } finally {
      setParsing(false);
      // keep the text in the box so the user can tweak & re-parse
    }
  }

  function addDish(m: MenuItem, mods: OrderMod[] = []) {
    setOrder([
      ...order,
      {
        id: uid(),
        itemId: m.id,
        truckId: truck.id,
        truckName: truck.name,
        name: m.name,
        emoji: m.emoji,
        basePrice: m.price,
        quantity: 1,
        mods,
      },
    ]);
  }

  const tax = orderSubtotal * TAX_RATE;
  const total = orderSubtotal + tax;

  return (
    <div className="app-container py-8">
      <header className="mb-6">
        <h1 className="font-display text-[clamp(28px,4vw,40px)] leading-tight tracking-tight text-petrol dark:text-white">
          Order <span className="brush-underline text-tangerine">Builder</span>
        </h1>
        <p className="mt-2 max-w-2xl text-ink-secondary">
          Type a messy, multi-part request in plain language. FoodPilot parses it into
          structured lines, resolves each modification against real prices, and flags
          anything it can&apos;t apply.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(360px,420px)]">
        {/* Left — natural-language input */}
        <div className="space-y-5">
          <div className="rounded-[24px] border border-border bg-card p-5 shadow-sky-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-bold text-petrol dark:text-white">
                <Wand2 className="size-4 text-turquoise" /> Ordering from
                <SourceBadge
                  source={source}
                  loading={parsing}
                  liveLabel="Live · LangChain"
                  className="ml-1"
                />
              </div>
              <Select value={truckId} onValueChange={(v) => v && setTruckId(v)}>
                <SelectTrigger className="h-9 w-[220px] bg-white">
                  <span className="truncate">
                    {truck.emoji} {truck.name}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {trucks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.emoji} {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p className="mb-2 text-xs text-ink-muted">
              Pick the truck you want to order from (an order is for one truck) — then
              describe what you want below.
            </p>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder={`e.g. ${example}`}
              className="w-full resize-none rounded-2xl border border-input bg-white p-4 text-[15px] text-ink outline-none transition placeholder:text-ink-muted focus:border-turquoise focus:ring-4 focus:ring-turquoise/12 dark:bg-white/5"
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => setText(example)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold text-ink-secondary transition hover:border-turquoise hover:text-petrol dark:bg-white/5"
              >
                <Sparkles className="size-3.5 text-turquoise" /> Try an example
              </button>
              <button
                onClick={() => handleParse()}
                disabled={parsing || !text.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-petrol px-5 py-2.5 font-bold text-white transition hover:bg-petrol-deep disabled:opacity-50"
              >
                {parsing ? "Parsing…" : "Parse & add"}
                {!parsing && <Sparkles className="size-4" />}
              </button>
            </div>

            <AnimatePresence>
              {unmatched.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 flex items-start gap-2 rounded-xl bg-orange-soft p-3 text-sm text-[#C94D2A]"
                >
                  <Info className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Couldn&apos;t match: {unmatched.map((u) => `"${u}"`).join(", ")}. Try naming a
                    menu item from {truck.name}.
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Full menu — every dish, with its real upgrades & removals */}
          <div className="rounded-[24px] border border-border bg-card p-5 shadow-sky-sm">
            <div className="mb-1 flex flex-wrap items-end justify-between gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wide text-ink-muted">
                Menu · {truck.name}
              </h3>
              <span className="text-xs font-semibold text-ink-muted">
                {truck.menu.length} items
              </span>
            </div>
            <p className="mb-4 text-xs text-ink-muted">
              Tap <span className="font-semibold text-petrol dark:text-white">Add</span>, or open{" "}
              <span className="font-semibold text-petrol dark:text-white">Customize</span> to see
              exactly what you can add or remove on each dish.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {truck.menu.map((m) => (
                <MenuDishCard key={m.id} dish={m} onAdd={addDish} />
              ))}
            </div>
          </div>
        </div>

        {/* Right — persistent order panel */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-[24px] border border-border bg-card shadow-sky-md">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-lg font-bold text-petrol dark:text-white">Your order</h2>
              {order.length > 0 && (
                <button
                  onClick={clearOrder}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted transition hover:text-danger"
                >
                  <Trash2 className="size-3.5" /> Clear
                </button>
              )}
            </div>

            {order.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-blue-soft text-3xl">
                  🧾
                </div>
                <p className="font-bold text-petrol dark:text-white">Nothing here yet</p>
                <p className="mx-auto mt-1 max-w-[24ch] text-sm text-ink-secondary">
                  Describe your order on the left, or tap items to add.
                </p>
              </div>
            ) : (
              <>
                <div className="max-h-[46vh] space-y-3 overflow-y-auto p-4">
                  <AnimatePresence initial={false}>
                    {order.map((line) => (
                      <OrderLineRow
                        key={line.id}
                        line={line}
                        onQty={(q) => updateQty(line.id, q)}
                        onRemove={() => removeLine(line.id)}
                      />
                    ))}
                  </AnimatePresence>
                </div>

                <div className="space-y-2 border-t border-border p-5">
                  <Row label="Subtotal" value={money(orderSubtotal)} />
                  <Row label={`Est. tax (${(TAX_RATE * 100).toFixed(2)}%)`} value={money(tax)} muted />
                  <div className="my-2 h-px bg-border" />
                  <div className="flex items-center justify-between rounded-2xl bg-petrol px-4 py-3 text-white">
                    <span className="font-bold">Total</span>
                    <span className="text-xl font-extrabold">{money(total)}</span>
                  </div>
                  <Link
                    href="/order/review"
                    className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-tangerine py-3.5 font-bold text-white shadow-tangerine transition hover:-translate-y-0.5 hover:bg-tangerine-hover"
                  >
                    Proceed to review <ArrowRight className="size-5" />
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const SPICE_META: Record<string, { label: string; dots: number }> = {
  mild: { label: "Mild", dots: 1 },
  medium: { label: "Medium", dots: 2 },
  spicy: { label: "Spicy", dots: 3 },
};

/** One dish in the full menu: price, badges, and an inline Customize panel that
 *  exposes the dish's real add-ons (+$) and removable ingredients as toggles. */
function MenuDishCard({
  dish,
  onAdd,
}: {
  dish: MenuItem;
  onAdd: (m: MenuItem, mods: OrderMod[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const [addOns, setAddOns] = useState<Record<string, boolean>>({});
  const [removed, setRemoved] = useState<Record<string, boolean>>({});

  const hasCustom = dish.add_ons.length > 0 || dish.removable.length > 0;
  const soldOut = dish.available === false;

  const extra = dish.add_ons
    .filter((a) => addOns[a.name])
    .reduce((s, a) => s + a.price, 0);
  const changeCount =
    Object.values(addOns).filter(Boolean).length +
    Object.values(removed).filter(Boolean).length;
  const previewPrice = dish.price + extra;

  const spice = dish.spice ? SPICE_META[dish.spice] : null;

  function handleAdd() {
    const mods: OrderMod[] = [
      ...dish.add_ons
        .filter((a) => addOns[a.name])
        .map((a) => ({
          type: "add" as const,
          name: a.name,
          priceDelta: a.price,
          status: "applied" as const,
          appliesTo: 1,
        })),
      ...dish.removable
        .filter((r) => removed[r])
        .map((r) => ({
          type: "remove" as const,
          name: r,
          priceDelta: 0,
          status: "applied" as const,
          appliesTo: 1,
        })),
    ];
    onAdd(dish, mods);
    setAddOns({});
    setRemoved({});
    setOpen(false);
    setAdded(true);
    setTimeout(() => setAdded(false), 1100);
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border border-border bg-white p-3.5 transition dark:bg-white/5",
        soldOut ? "opacity-60" : "hover:border-turquoise/60",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-orange-soft to-blue-soft text-2xl">
          {dish.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold leading-tight text-petrol dark:text-white">{dish.name}</p>
            <span className="shrink-0 font-extrabold text-petrol dark:text-white">
              {money(dish.price)}
            </span>
          </div>

          {/* badges: dietary + spice + protein */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {dish.dietary.map((d) => (
              <span
                key={d}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold capitalize",
                  d === "bestseller"
                    ? "bg-tangerine/12 text-tangerine"
                    : "bg-muted text-ink-secondary",
                )}
              >
                {d}
              </span>
            ))}
            {spice && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-soft px-2 py-0.5 text-[10px] font-bold text-[#C94D2A]">
                <Flame className="size-2.5" /> {spice.label}
              </span>
            )}
            {dish.protein_g != null && (
              <span className="rounded-full bg-blue-soft px-2 py-0.5 text-[10px] font-bold text-petrol">
                {dish.protein_g}g protein
              </span>
            )}
          </div>

          {dish.description && (
            <p className="mt-1.5 line-clamp-2 text-xs text-ink-secondary">{dish.description}</p>
          )}
        </div>
      </div>

      {/* action row */}
      <div className="mt-3 flex items-center gap-2">
        {hasCustom && (
          <button
            onClick={() => setOpen((v) => !v)}
            disabled={soldOut}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50",
              open
                ? "border-turquoise bg-turquoise/10 text-petrol dark:text-white"
                : "border-border bg-white text-ink-secondary hover:border-turquoise hover:text-petrol dark:bg-white/5",
            )}
          >
            <SlidersHorizontal className="size-3.5 text-turquoise" />
            Customize
            {changeCount > 0 && (
              <span className="rounded-full bg-turquoise px-1.5 text-[10px] font-bold text-white">
                {changeCount}
              </span>
            )}
            <ChevronDown
              className={cn("size-3.5 transition-transform", open && "rotate-180")}
            />
          </button>
        )}
        <button
          onClick={handleAdd}
          disabled={soldOut}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-petrol px-4 py-1.5 text-xs font-bold text-white transition hover:bg-petrol-deep disabled:opacity-50"
        >
          {soldOut ? (
            "Sold out"
          ) : added ? (
            <>
              <Check className="size-3.5" strokeWidth={3} /> Added
            </>
          ) : (
            <>
              <Plus className="size-3.5" /> Add {changeCount > 0 && `· ${money(previewPrice)}`}
            </>
          )}
        </button>
      </div>

      {/* customize panel */}
      <AnimatePresence initial={false}>
        {open && hasCustom && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-3 border-t border-dashed border-border pt-3">
              {dish.add_ons.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                    Add extras
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {dish.add_ons.map((a) => {
                      const on = !!addOns[a.name];
                      return (
                        <button
                          key={a.name}
                          onClick={() =>
                            setAddOns((s) => ({ ...s, [a.name]: !s[a.name] }))
                          }
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize transition",
                            on
                              ? "border-leaf bg-leaf/10 text-leaf"
                              : "border-border bg-white text-ink-secondary hover:border-leaf dark:bg-white/5",
                          )}
                        >
                          {on ? (
                            <Check className="size-3" strokeWidth={3} />
                          ) : (
                            <Plus className="size-3" />
                          )}
                          {a.name}
                          <span className="text-ink-muted">+{money(a.price)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {dish.removable.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                    Remove
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {dish.removable.map((r) => {
                      const on = !!removed[r];
                      return (
                        <button
                          key={r}
                          onClick={() => setRemoved((s) => ({ ...s, [r]: !s[r] }))}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize transition",
                            on
                              ? "border-danger bg-danger/10 text-danger line-through"
                              : "border-border bg-white text-ink-secondary hover:border-danger dark:bg-white/5",
                          )}
                        >
                          <X className="size-3" strokeWidth={3} />
                          {r}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function OrderLineRow({
  line,
  onQty,
  onRemove,
  readOnly = false,
}: {
  line: OrderLine;
  onQty?: (q: number) => void;
  onRemove?: () => void;
  readOnly?: boolean;
}) {
  const total = lineTotal(line.basePrice, line.quantity, line.mods);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -12 }}
      className="rounded-2xl border border-border bg-white p-3 dark:bg-white/5"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-orange-soft to-blue-soft text-2xl">
          {line.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold text-petrol dark:text-white">{line.name}</p>
            <span className="font-extrabold text-petrol dark:text-white">{money(total)}</span>
          </div>
          <p className="text-xs text-ink-muted">
            {money(line.basePrice)} each · {line.truckName}
          </p>

          {/* quantity + remove */}
          {!readOnly && (
            <div className="mt-2 flex items-center gap-3">
              <div className="inline-flex items-center rounded-full border border-border bg-white dark:bg-white/5">
                <button
                  onClick={() => onQty?.(line.quantity - 1)}
                  className="grid size-7 place-items-center rounded-full text-petrol hover:bg-muted dark:text-white"
                  aria-label="Decrease"
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="w-6 text-center text-sm font-bold text-petrol dark:text-white">
                  {line.quantity}
                </span>
                <button
                  onClick={() => onQty?.(line.quantity + 1)}
                  className="grid size-7 place-items-center rounded-full text-petrol hover:bg-muted dark:text-white"
                  aria-label="Increase"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
              <button
                onClick={onRemove}
                className="text-xs font-semibold text-ink-muted transition hover:text-danger"
              >
                Remove
              </button>
            </div>
          )}
          {readOnly && (
            <p className="mt-1 text-xs font-semibold text-ink-secondary">Qty {line.quantity}</p>
          )}
        </div>
      </div>

      {/* modifications */}
      {line.mods.length > 0 && (
        <div className="mt-3 space-y-1.5 pl-1">
          {line.mods.map((mod, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start gap-2 rounded-lg border-l-[3px] py-1.5 pl-2.5 pr-2 text-xs",
                mod.status === "applied"
                  ? "border-leaf bg-[#F7FCF8] dark:bg-leaf/10"
                  : "border-danger bg-[#FFF8F7] dark:bg-danger/10",
              )}
            >
              <span className="mt-0.5">
                {mod.status === "applied" ? (
                  <Check className="size-3.5 text-leaf" strokeWidth={3} />
                ) : (
                  <X className="size-3.5 text-danger" strokeWidth={3} />
                )}
              </span>
              <div className="flex-1">
                <span className="font-semibold capitalize text-ink dark:text-white/90">
                  {mod.type === "add" ? "Add" : "Remove"} {mod.name}
                  {mod.appliesTo > 1 && (
                    <span className="text-ink-muted"> ×{mod.appliesTo}</span>
                  )}
                </span>
                {mod.reason && (
                  <span
                    className={cn(
                      "ml-1.5",
                      mod.status === "applied" ? "text-leaf" : "text-danger",
                    )}
                  >
                    {mod.reason}
                  </span>
                )}
                {mod.condition && (
                  <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-yellow-soft px-2 py-0.5 text-[10px] font-bold text-[#795E0A]">
                    {mod.status === "applied" && <Check className="size-2.5" strokeWidth={4} />}
                    {mod.condition} {mod.status === "applied" ? "met" : "not met"}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={muted ? "text-ink-muted" : "text-ink-secondary"}>{label}</span>
      <span className={cn("font-semibold", muted ? "text-ink-secondary" : "text-petrol dark:text-white")}>
        {value}
      </span>
    </div>
  );
}
