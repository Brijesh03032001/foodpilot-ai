"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DollarSign, ShoppingBag, Receipt, Star, TrendingUp, ArrowRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { scopeData } from "@/lib/data";
import { useSalesSummary } from "@/lib/use-sales";
import { money, compactMoney } from "@/lib/format";
import { OwnerHeader } from "./owner-header";
import { StatTile } from "./stat-tile";
import { SalesChart } from "./sales-chart";
import { SourceBadge } from "@/components/bits/source-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const RANGES = [
  { key: "all", label: "All time", days: 999 },
  { key: "7", label: "Last 7 days", days: 7 },
  { key: "3", label: "Last 3 days", days: 3 },
];

export function OwnerDashboard() {
  const { activeTruckId } = useStore();
  const [rangeKey, setRangeKey] = useState("all");
  const scope = useMemo(() => scopeData(activeTruckId), [activeTruckId]);
  const { sales: salesData, source, loading: salesLoading } =
    useSalesSummary(activeTruckId);

  const range = RANGES.find((r) => r.key === rangeKey)!;
  const series = salesData.sales_by_day.slice(-range.days);

  const revenue = series.reduce((s, d) => s + d.revenue, 0);
  const orders = series.reduce((s, d) => s + d.orders, 0);
  const aov = orders ? revenue / orders : 0;

  // honest delta: second half vs first half of the visible series
  const delta = useMemo(() => {
    if (series.length < 2) return undefined;
    const mid = Math.floor(series.length / 2);
    const a = series.slice(0, mid).reduce((s, d) => s + d.revenue, 0);
    const b = series.slice(mid).reduce((s, d) => s + d.revenue, 0);
    if (a === 0) return undefined;
    const pct = ((b - a) / a) * 100;
    return { value: `${Math.abs(pct).toFixed(0)}%`, positive: pct >= 0 };
  }, [series]);

  const maxItemQty = Math.max(1, ...salesData.top_items.map((t) => t.qty));

  return (
    <div className="app-container py-8">
      <OwnerHeader
        title="Dashboard"
        subtitle={`Business health for ${scope.name} · ${salesData.orders} completed orders`}
        actions={
          <>
            <SourceBadge source={source} loading={salesLoading} />
            <Select value={rangeKey} onValueChange={(v) => v && setRangeKey(v)}>
            <SelectTrigger className="h-10 w-[160px] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => (
                <SelectItem key={r.key} value={r.key}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Revenue" value={money(revenue)} icon={DollarSign} delta={delta} index={0} />
        <StatTile label="Orders" value={String(orders)} icon={ShoppingBag} index={1} />
        <StatTile label="Avg order value" value={money(aov)} icon={Receipt} index={2} />
        <StatTile
          label="Avg rating"
          value={scope.rating ? scope.rating.toFixed(2) : "—"}
          icon={Star}
          index={3}
        />
      </div>

      {/* chart + top items */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-[24px] border border-border bg-card p-5 shadow-sky-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-petrol dark:text-white">
                <TrendingUp className="size-5 text-turquoise" /> Revenue over time
              </h2>
              <p className="text-sm text-ink-muted">{range.label} · {scope.name}</p>
            </div>
            <span className="text-2xl font-extrabold text-petrol dark:text-white">
              {compactMoney(revenue)}
            </span>
          </div>
          <SalesChart data={series} metric="revenue" type="area" />
        </div>

        <div className="rounded-[24px] border border-border bg-card p-5 shadow-sky-sm">
          <h2 className="mb-4 text-lg font-bold text-petrol dark:text-white">Top-selling items</h2>
          {salesData.top_items.length ? (
            <ol className="space-y-3.5">
              {salesData.top_items.map((it, i) => (
                <li key={it.name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="grid size-5 shrink-0 place-items-center rounded-md bg-petrol text-[11px] font-bold text-white">
                        {i + 1}
                      </span>
                      <span className="truncate font-semibold text-petrol dark:text-white">{it.name}</span>
                    </span>
                    <span className="shrink-0 font-bold text-ink-secondary">{money(it.revenue)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-turquoise"
                      style={{ width: `${(it.qty / maxItemQty) * 100}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-xs text-ink-muted">{it.qty} sold</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-8 text-center text-sm text-ink-muted">No orders in scope yet.</p>
          )}
          <Link
            href="/owner/analytics"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-turquoise hover:text-petrol"
          >
            Full sales analytics <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
