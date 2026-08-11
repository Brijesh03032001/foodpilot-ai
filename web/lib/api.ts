// Client for the FoodPilot Spring Boot gateway (which proxies the Python AI
// service). Every call throws on failure so screens can fall back to their
// local mock and keep working when the backend is down.

import type { Truck } from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

async function req<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 20000, ...rest } = init;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...rest,
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", ...(rest.headers ?? {}) },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${res.status} ${text.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function post<T>(path: string, body: unknown, timeoutMs?: number) {
  return req<T>(path, { method: "POST", body: JSON.stringify(body), timeoutMs });
}

// ---- response shapes (mirror the gateway / python service) ------------------
export interface ApiFoodQuery {
  diet: "vegetarian" | "vegan" | "none";
  spice_level: "mild" | "medium" | "spicy" | null;
  max_price: number | null;
  cuisine: string | null;
  max_wait_min: number | null;
  min_protein_g: number | null;
}

export interface ApiResolvedMod {
  type: "add" | "remove";
  name: string;
  priceDelta: number;
  status: "applied" | "rejected";
  reason: string;
  appliesTo: number;
}

export interface ApiResolvedOrder {
  matched: boolean;
  item: string;
  resolvedName?: string;
  itemId?: string;
  quantity: number;
  truckId?: string | null;
  truckName?: string | null;
  basePrice?: number;
  total?: number;
  mods?: ApiResolvedMod[];
}

export interface ApiToolCall {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}

export interface ApiCopilot {
  answer: string;
  trace: ApiToolCall[];
}

export interface ApiRecommendation {
  truckId: string;
  truckName: string | null;
  cuisines: string[];
  rating: number | null;
  itemId: string | null;
  itemName: string | null;
  price: number | null;
  protein: number | null;
  waitMin: number | null;
}

export interface ApiChat {
  reply: string;
  trace: ApiToolCall[];
  recommendation: ApiRecommendation | null;
}

export interface ApiReport {
  counts: { positive: number; neutral: number; negative: number };
  total: number;
  negative: number;
  failures: number;
  complaints: { topic: string; count: number; pct: number }[];
}

export interface ApiSales {
  truckId: string | null;
  revenue: number;
  orders: number;
  aov: number;
  top_items: { name: string; qty: number; revenue: number }[];
  sales_by_day: { date: string; revenue: number; orders: number }[];
}

export const api = {
  health: () => req<{ gateway: string; ai: unknown }>("/health", { timeoutMs: 6000 }),
  parse: (text: string) => post<{ query: ApiFoodQuery }>("/parse", { text }, 30000),
  resolveOrder: (text: string) =>
    post<ApiResolvedOrder>("/order/resolve", { text }, 60000),
  chat: (message: string) => post<ApiChat>("/chat", { message }, 360000),
  copilot: (question: string, truck?: string | null) =>
    post<ApiCopilot>("/copilot", { question, truck: truck ?? undefined }, 360000),
  reviewsReport: (truck?: string | null) =>
    post<ApiReport>("/reviews/report", { truck: truck ?? undefined }, 240000),
  salesSummary: (truck?: string | null) =>
    req<ApiSales>(
      `/sales/summary?truck=${encodeURIComponent(truck ?? "all")}`,
      { timeoutMs: 10000 },
    ),
  getTruck: (id: string) =>
    req<Truck>(`/trucks/${encodeURIComponent(id)}`, { timeoutMs: 10000 }),
};
