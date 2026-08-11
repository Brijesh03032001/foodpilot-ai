export function money(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export function compactMoney(n: number): string {
  if (n >= 1000)
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  return money(n);
}

export function pct(n: number): string {
  return `${n.toFixed(0)}%`;
}

export function titleCase(s: string): string {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function shortDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function weekday(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

/** Compute the priced total of an order line, honoring applied mods only. */
export function lineTotal(
  basePrice: number,
  quantity: number,
  mods: { priceDelta: number; status: string; appliesTo: number }[],
): number {
  const modSum = mods
    .filter((m) => m.status === "applied")
    .reduce((s, m) => s + m.priceDelta * m.appliesTo, 0);
  return basePrice * quantity + modSum;
}
