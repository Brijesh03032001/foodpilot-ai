import type { ParsedQuery, Truck, MenuItem } from "./types";
import { trucks, CUISINES } from "./data";

/**
 * A lightweight stand-in for the Phase-1 structured-extraction LLM call.
 * Turns "a cheap vegan lunch near me" into a FoodQuery-shaped object so the
 * parsed-intent chips can make the extraction visible.
 */
export function parseQuery(text: string): ParsedQuery {
  const q = text.toLowerCase();
  const out: ParsedQuery = {};

  if (/\bvegan\b/.test(q)) out.diet = "vegan";
  else if (/\bvegetarian|veggie\b/.test(q)) out.diet = "vegetarian";

  if (/\bspicy|hot\b/.test(q)) out.spice_level = "spicy";
  else if (/\bmild\b/.test(q)) out.spice_level = "mild";

  // price: "under $12", "$10", "cheap", "budget"
  const priceMatch = q.match(/(?:under|below|less than|<=?|\$)\s*\$?\s*(\d+(?:\.\d+)?)/);
  if (priceMatch) out.max_price = parseFloat(priceMatch[1]);
  else if (/\bcheap|budget|affordable\b/.test(q)) out.max_price = 12;

  for (const c of CUISINES) {
    if (q.includes(c.replace(/_/g, " ")) || q.includes(c)) {
      out.cuisine = c;
      break;
    }
  }
  // common aliases
  if (!out.cuisine) {
    if (/\btaco|burrito|mexican\b/.test(q)) out.cuisine = "mexican";
    else if (/\bpoke|hawaiian|bowl\b/.test(q)) out.cuisine = "poke";
    else if (/\bburger\b/.test(q)) out.cuisine = "american";
    else if (/\bgyro|kebab|greek\b/.test(q)) out.cuisine = "greek";
  }

  if (/\bbreakfast\b/.test(q)) out.meal = "breakfast";
  else if (/\blunch\b/.test(q)) out.meal = "lunch";
  else if (/\bdinner\b/.test(q)) out.meal = "dinner";

  const waitMatch = q.match(/(\d+)\s*min/);
  if (waitMatch) out.max_wait_min = parseInt(waitMatch[1], 10);

  if (/\bopen now|open\b/.test(q)) out.open_now = true;

  return out;
}

function itemMatchesDiet(item: MenuItem, diet?: string | null): boolean {
  if (!diet) return true;
  if (diet === "vegan") return item.dietary.includes("vegan");
  if (diet === "vegetarian")
    return item.dietary.includes("vegan") || item.dietary.includes("vegetarian");
  return true;
}

export interface Recommendation {
  truck: Truck;
  reason: string;
  score: number;
  matchDish?: MenuItem;
}

/** Rank featured trucks against a parsed query (Phase-2 retrieval stand-in). */
export function recommend(query: ParsedQuery): Recommendation[] {
  const recs: Recommendation[] = [];

  for (const truck of trucks) {
    let score = 0;
    const reasons: string[] = [];

    // cuisine
    if (query.cuisine) {
      if (truck.cuisines.some((c) => c.includes(query.cuisine!))) {
        score += 5;
        reasons.push(`${query.cuisine} spot`);
      } else {
        score -= 3;
      }
    }

    // diet — find a qualifying, affordable dish
    const candidateDishes = truck.menu.filter(
      (m) =>
        itemMatchesDiet(m, query.diet) &&
        (query.max_price == null || m.price <= query.max_price),
    );
    let matchDish: MenuItem | undefined;
    if (query.diet) {
      if (candidateDishes.length) {
        score += 4;
        matchDish = candidateDishes[0];
        reasons.push(`${query.diet} options`);
      } else {
        score -= 4;
      }
    } else if (candidateDishes.length) {
      matchDish = candidateDishes.sort((a, b) => b.popularity - a.popularity)[0];
    }

    // price
    if (query.max_price != null) {
      const cheapest = Math.min(...truck.menu.map((m) => m.price));
      if (cheapest <= query.max_price) {
        score += 3;
        reasons.push(`under $${query.max_price}`);
      } else {
        score -= 2;
      }
    }

    // open now / wait
    if (query.open_now && truck.status === "open") {
      score += 2;
      reasons.push("open now");
    }
    if (query.max_wait_min != null) {
      const wait = truck.queue_min ?? truck.prep_min ?? 99;
      if (wait <= query.max_wait_min) {
        score += 2;
        reasons.push(`~${wait} min wait`);
      }
    }

    // gentle baseline from rating so results are never empty/arbitrary
    score += (truck.rating ?? 4) - 4;
    if (truck.status === "open") score += 0.5;

    const reason =
      reasons.length > 0
        ? `Matched: ${reasons.slice(0, 3).join(", ")}`
        : `Highly rated ${truck.cuisines[0]?.replace(/_/g, " ") ?? "food"} near you`;

    recs.push({ truck, reason, score, matchDish });
  }

  return recs.sort((a, b) => b.score - a.score);
}
