"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Check, Flame, Leaf, SlidersHorizontal } from "lucide-react";
import type { Truck, MenuItem, OrderMod, OrderLine } from "@/lib/types";
import { useStore } from "@/lib/store";
import { DishTile } from "@/components/bits/dish-tile";
import { Chip } from "@/components/bits/chip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { lineTotal } from "@/lib/format";
import { cn } from "@/lib/utils";

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function DishRow({ truck, item }: { truck: Truck; item: MenuItem }) {
  const { addItem, addLine } = useStore();
  const [added, setAdded] = useState(false);
  const [open, setOpen] = useState(false);

  const vegan = item.dietary.includes("vegan");
  const canCustomize = item.add_ons.length > 0 || item.removable.length > 0;

  function quickAdd() {
    if (!item.available) return;
    addItem(truck, item);
    setAdded(true);
    setTimeout(() => setAdded(false), 1100);
  }

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-2xl border border-border bg-card p-3 transition hover:shadow-sky-sm",
        !item.available && "opacity-60",
      )}
    >
      <DishTile emoji={item.emoji} vegan={vegan} size="md" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="truncate font-bold text-petrol dark:text-white">{item.name}</h4>
          {item.dietary.includes("bestseller") && (
            <span className="rounded-full bg-yellow-soft px-2 py-0.5 text-[10px] font-bold text-[#795E0A]">
              ★ Bestseller
            </span>
          )}
        </div>
        {item.description && (
          <p className="mt-0.5 line-clamp-1 text-sm text-ink-secondary">{item.description}</p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {vegan && (
            <Chip variant="success" icon={<Leaf className="size-3" />}>vegan</Chip>
          )}
          {item.dietary.includes("vegetarian") && !vegan && (
            <Chip variant="success">vegetarian</Chip>
          )}
          {item.spice && (
            <Chip variant="warning" icon={<Flame className="size-3" />}>{item.spice}</Chip>
          )}
          {item.protein_g ? (
            <span className="text-xs text-ink-muted">{item.protein_g}g protein</span>
          ) : null}
          {!item.available && (
            <Chip variant="warning">out of stock</Chip>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-2">
        <span className="text-lg font-extrabold text-petrol dark:text-white">
          ${item.price.toFixed(2)}
        </span>
        <div className="flex items-center gap-1.5">
          {canCustomize && item.available && (
            <button
              onClick={() => setOpen(true)}
              className="grid size-9 place-items-center rounded-xl border border-border bg-white text-petrol transition hover:bg-blue-soft dark:bg-white/5 dark:text-white"
              aria-label="Customize"
            >
              <SlidersHorizontal className="size-4" />
            </button>
          )}
          <button
            onClick={quickAdd}
            disabled={!item.available}
            className={cn(
              "inline-flex h-9 items-center gap-1 rounded-xl px-3 font-bold text-white transition",
              added ? "bg-leaf" : "bg-tangerine hover:-translate-y-0.5 hover:bg-tangerine-hover",
              !item.available && "cursor-not-allowed bg-ink-muted",
            )}
          >
            <AnimatePresence mode="wait" initial={false}>
              {added ? (
                <motion.span
                  key="ok"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center gap-1"
                >
                  <Check className="size-4" strokeWidth={3} /> Added
                </motion.span>
              ) : (
                <motion.span key="add" className="inline-flex items-center gap-1">
                  <Plus className="size-4" /> Add
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>

      {canCustomize && (
        <CustomizeDialog
          truck={truck}
          item={item}
          open={open}
          onOpenChange={setOpen}
          onConfirm={(line) => {
            addLine(line);
            setOpen(false);
            setAdded(true);
            setTimeout(() => setAdded(false), 1100);
          }}
        />
      )}
    </div>
  );
}

function CustomizeDialog({
  truck,
  item,
  open,
  onOpenChange,
  onConfirm,
}: {
  truck: Truck;
  item: MenuItem;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (line: OrderLine) => void;
}) {
  const [adds, setAdds] = useState<Set<string>>(new Set());
  const [removes, setRemoves] = useState<Set<string>>(new Set());

  const mods: OrderMod[] = [
    ...item.add_ons
      .filter((a) => adds.has(a.name))
      .map<OrderMod>((a) => ({
        type: "add",
        name: a.name,
        priceDelta: a.price,
        status: "applied",
        reason: `+$${a.price.toFixed(2)}`,
        appliesTo: 1,
      })),
    ...[...removes].map<OrderMod>((r) => ({
      type: "remove",
      name: r,
      priceDelta: 0,
      status: "applied",
      appliesTo: 1,
    })),
  ];
  const total = lineTotal(item.price, 1, mods);

  function toggle(set: Set<string>, key: string, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    setter(next);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <span>{item.emoji}</span> {item.name}
          </DialogTitle>
          <DialogDescription>Customize it your way, then add to your order.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {item.add_ons.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-bold text-petrol dark:text-white">Add extras</p>
              <div className="flex flex-wrap gap-2">
                {item.add_ons.map((a) => {
                  const on = adds.has(a.name);
                  return (
                    <button
                      key={a.name}
                      onClick={() => toggle(adds, a.name, setAdds)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition",
                        on
                          ? "border-tangerine bg-orange-soft text-[#C94D2A]"
                          : "border-border bg-white text-ink-secondary hover:border-tangerine dark:bg-white/5",
                      )}
                    >
                      {on ? <Check className="size-3.5" strokeWidth={3} /> : <Plus className="size-3.5" />}
                      {a.name} <span className="text-xs opacity-70">+${a.price.toFixed(2)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {item.removable.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-bold text-petrol dark:text-white">Remove</p>
              <div className="flex flex-wrap gap-2">
                {item.removable.map((r) => {
                  const on = removes.has(r);
                  return (
                    <button
                      key={r}
                      onClick={() => toggle(removes, r, setRemoves)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm font-semibold capitalize transition",
                        on
                          ? "border-danger bg-[#FFF3F1] text-danger line-through"
                          : "border-border bg-white text-ink-secondary hover:border-danger dark:bg-white/5",
                      )}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-3 sm:justify-between">
          <span className="text-sm text-ink-secondary">
            Total <span className="text-lg font-extrabold text-petrol dark:text-white">${total.toFixed(2)}</span>
          </span>
          <button
            onClick={() =>
              onConfirm({
                id: uid(),
                itemId: item.id,
                truckId: truck.id,
                truckName: truck.name,
                name: item.name,
                emoji: item.emoji,
                basePrice: item.price,
                quantity: 1,
                mods,
              })
            }
            className="inline-flex items-center gap-2 rounded-xl bg-tangerine px-5 py-2.5 font-bold text-white shadow-tangerine transition hover:bg-tangerine-hover"
          >
            <Plus className="size-4" /> Add to order
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
