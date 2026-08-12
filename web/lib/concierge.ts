import { trucks } from "./data";
import { parseQuery, recommend, type Recommendation } from "./query-parser";

export interface ToolCall {
  name: string;
  detail: string;
}

export interface ConciergeReply {
  text: string;
  tools: ToolCall[];
  recommendations?: Recommendation[];
  cta?: { label: string; href: string };
}

/**
 * A canned stand-in for the Phase-5 FEED ME agent: routes a message to a
 * "tool", returns a grounded reply plus the tool trace (teaching value).
 */
export function conciergeReply(message: string): ConciergeReply {
  const q = message.toLowerCase();

  // cheapest option across the market
  if (/cheapest|cheap|budget|least expensive/.test(q) && /option|dish|food|eat|thing/.test(q)) {
    const all = trucks.flatMap((t) =>
      t.menu.filter((m) => m.category !== "drink").map((m) => ({ t, m })),
    );
    const cheapest = all.sort((a, b) => a.m.price - b.m.price).slice(0, 3);
    const top = cheapest[0];
    return {
      text: `The cheapest bite near you is the **${top.m.name}** at **${top.t.name}** for $${top.m.price.toFixed(2)}. A couple more wallet-friendly picks: ${cheapest
        .slice(1)
        .map((c) => `${c.m.name} ($${c.m.price.toFixed(2)}) at ${c.t.name}`)
        .join(", ")}.`,
      tools: [
        { name: "search_menu", detail: "scanned 10 trucks · sorted by price" },
      ],
      recommendations: [{ truck: top.t, reason: `Cheapest: ${top.m.name} $${top.m.price.toFixed(2)}`, score: 10 }],
    };
  }

  // wait time
  if (/wait|how long|busy|queue|ready/.test(q)) {
    const named = trucks.find((t) => q.includes(t.name.toLowerCase().split(" ")[0]));
    const t = named ?? trucks.find((x) => x.status === "open") ?? trucks[0];
    const wait = t.queue_min ?? t.prep_min ?? 10;
    return {
      text: `**${t.name}** is ${t.status === "open" ? "open" : "currently " + t.status} with about a **${wait}-minute** wait right now. It's roughly ${(0.1 + (t.name.length % 20) / 10).toFixed(1)} mi away.`,
      tools: [{ name: "check_wait", detail: `${t.name} → ~${wait} min` }],
      recommendations: [{ truck: t, reason: `~${wait} min wait · ${t.status}`, score: 8 }],
    };
  }

  // build an order
  if (/build|order|checkout|cart|add to order/.test(q)) {
    return {
      text: `Happy to help you build an order! Tell me the truck and what you want — even messy requests like *"3 Spam Musubi, remove onion from 2, add avocado to 1 only if avocado ≤ $2"*. I'll parse it into a clean, priced order and flag anything that can't be applied.`,
      tools: [{ name: "route", detail: "→ Order Builder" }],
      cta: { label: "Open Order Builder", href: "/order" },
    };
  }

  // recommendation flow (diet / cuisine / price)
  const parsed = parseQuery(message);
  const hasIntent =
    parsed.diet || parsed.cuisine || parsed.max_price != null || parsed.meal || parsed.spice_level;
  if (hasIntent) {
    const recs = recommend(parsed).slice(0, 3);
    const bits: string[] = [];
    if (parsed.diet) bits.push(parsed.diet);
    if (parsed.max_price != null) bits.push(`under $${parsed.max_price}`);
    if (parsed.cuisine) bits.push(parsed.cuisine);
    if (parsed.meal) bits.push(parsed.meal);
    return {
      text: `Got it — looking for ${bits.join(", ") || "a good meal"}. Here are my top picks near you:`,
      tools: [
        { name: "parse_request", detail: JSON.stringify(parsed).replace(/"/g, "") },
        { name: "search_trucks", detail: `ranked ${trucks.length} trucks · returned ${recs.length}` },
      ],
      recommendations: recs,
    };
  }

  // fallback / greeting
  return {
    text: `Hi! I'm your FoodPilot concierge 🤖 Tell me what you're craving — try *"a cheap vegan lunch"*, *"spicy tacos under $10"*, or ask *"what's the cheapest option?"* I can also check wait times and build your order.`,
    tools: [],
    recommendations: trucks
      .filter((t) => t.status === "open")
      .slice(0, 3)
      .map((t) => ({ truck: t, reason: `Popular near you`, score: 1 })),
  };
}

export const CONCIERGE_SUGGESTIONS = [
  "A cheap vegan lunch",
  "Spicy tacos under $10",
  "What's the cheapest option?",
  "How long is the wait at Poke Delish?",
  "Build my order",
];
