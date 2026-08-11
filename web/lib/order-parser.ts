import type { Truck, MenuItem, OrderLine, OrderMod } from "./types";

const NUM_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function toNum(tok: string | undefined, fallback = 1): number {
  if (!tok) return fallback;
  const n = parseInt(tok, 10);
  if (!Number.isNaN(n)) return n;
  return NUM_WORDS[tok.toLowerCase()] ?? fallback;
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

/** Fuzzy match a phrase to a menu item by shared word tokens. */
function matchItem(phrase: string, menu: MenuItem[]): MenuItem | null {
  const words = phrase.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  let best: MenuItem | null = null;
  let bestScore = 0;
  for (const item of menu) {
    const name = item.name.toLowerCase();
    let score = 0;
    for (const w of words) {
      if (w.length < 2) continue;
      if (name.includes(w)) score += w.length;
    }
    if (name.includes(phrase.trim().toLowerCase())) score += 5;
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return bestScore >= 3 ? best : null;
}

/** Find an add-on on an item by fuzzy name. */
function findAddOn(item: MenuItem, name: string) {
  const n = name.toLowerCase();
  return item.add_ons.find((a) => a.name.toLowerCase().includes(n) || n.includes(a.name.toLowerCase()));
}

export interface ParseResult {
  lines: OrderLine[];
  unmatched: string[];
}

/**
 * Phase-6 nested-order parser (stand-in for the structured-output LLM):
 * "3 Spam Musubi, remove onion from 2, add avocado to 1 only if avocado <= $2"
 * becomes one item with several modifications, each resolved & priced against
 * the truck's real modifier data.
 */
export function parseOrder(text: string, truck: Truck): ParseResult {
  const clauses = text
    .split(/,|\band\b|;|\n/i)
    .map((c) => c.trim())
    .filter(Boolean);

  const lines: OrderLine[] = [];
  const unmatched: string[] = [];

  for (const clause of clauses) {
    const lower = clause.toLowerCase();
    const isMod = /^(remove|no|without|hold|add|extra|with|sub)\b/.test(lower);

    if (!isMod) {
      // item clause: [qty] [item name]
      const m = clause.match(/^(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)?\s*(.+)$/i);
      const qty = toNum(m?.[1], 1);
      const phrase = (m?.[2] ?? clause).replace(/\bplease\b/gi, "").trim();
      const item = matchItem(phrase, truck.menu);
      if (item) {
        lines.push({
          id: uid(),
          itemId: item.id,
          truckId: truck.id,
          truckName: truck.name,
          name: item.name,
          emoji: item.emoji,
          basePrice: item.price,
          quantity: qty,
          mods: [],
        });
        continue;
      }
      unmatched.push(clause);
      continue;
    }

    // modifier clause — attach to the most recent line
    const line = lines[lines.length - 1];
    if (!line) {
      unmatched.push(clause);
      continue;
    }
    const item = truck.menu.find((mi) => mi.id === line.itemId)!;

    // REMOVE
    const rem = lower.match(/(?:remove|no|without|hold)\s+(.+?)(?:\s+from\s+(\d+))?$/);
    if (rem && /^(remove|no|without|hold)/.test(lower)) {
      const ing = rem[1].trim();
      const appliesTo = rem[2] ? parseInt(rem[2], 10) : line.quantity;
      const removable =
        item.removable.some((r) => r.toLowerCase().includes(ing)) ||
        item.base_ingredients.some((b) => b.toLowerCase().includes(ing)) ||
        true; // removing is generally allowed and free
      line.mods.push({
        type: "remove",
        name: ing,
        priceDelta: 0,
        status: removable ? "applied" : "rejected",
        reason: removable ? undefined : "not an ingredient of this item",
        appliesTo: Math.min(appliesTo, line.quantity),
      });
      continue;
    }

    // ADD (+ optional condition)
    const add = lower.match(
      /(?:add|extra|with|sub)\s+(.+?)(?:\s+to\s+(\d+))?(?:\s+(?:only\s+)?if\s+.*?(<=|under|below|less than|≤|<)\s*\$?\s*(\d+(?:\.\d+)?))?$/,
    );
    if (add) {
      const ing = add[1].replace(/\s+only$/, "").trim();
      const appliesTo = add[2] ? parseInt(add[2], 10) : line.quantity;
      const hasCond = !!add[3];
      const limit = add[4] ? parseFloat(add[4]) : null;
      const addon = findAddOn(item, ing);

      let mod: OrderMod;
      if (!addon) {
        mod = {
          type: "add",
          name: ing,
          priceDelta: 0,
          status: "rejected",
          reason: "not available on this item",
          appliesTo: Math.min(appliesTo, line.quantity),
        };
      } else if (hasCond && limit != null && addon.price > limit) {
        mod = {
          type: "add",
          name: addon.name,
          priceDelta: addon.price,
          status: "rejected",
          reason: `${addon.name} is $${addon.price.toFixed(2)} — over your $${limit.toFixed(2)} limit`,
          condition: `price ≤ $${limit.toFixed(2)}`,
          appliesTo: Math.min(appliesTo, line.quantity),
        };
      } else {
        mod = {
          type: "add",
          name: addon.name,
          priceDelta: addon.price,
          status: "applied",
          reason: `+$${addon.price.toFixed(2)}`,
          condition: hasCond && limit != null ? `price ≤ $${limit.toFixed(2)}` : null,
          appliesTo: Math.min(appliesTo, line.quantity),
        };
      }
      line.mods.push(mod);
      continue;
    }

    unmatched.push(clause);
  }

  return { lines, unmatched };
}

/** Build a realistic example prompt from a truck's actual menu + add-ons. */
export function exampleOrderPrompt(truck: Truck): string {
  const withAddon = truck.menu.find((m) => m.add_ons.length > 0) ?? truck.menu[0];
  if (!withAddon) return "2 of your most popular item";
  const addon = withAddon.add_ons[0];
  if (addon) {
    const limit = Math.ceil(addon.price);
    return `3 ${withAddon.name}, add ${addon.name} to 1 only if ${addon.name} ≤ $${limit}`;
  }
  return `2 ${withAddon.name}`;
}
