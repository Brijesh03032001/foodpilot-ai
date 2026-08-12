"use client";

import { useMemo, useState } from "react";
import { BarChart3, Table2, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { scopeData } from "@/lib/data";
import { useSalesSummary } from "@/lib/use-sales";
import { money, shortDate } from "@/lib/format";
import { OwnerHeader } from "./owner-header";
import { SalesChart } from "./sales-chart";
import { SourceBadge } from "@/components/bits/source-badge";
import { cn } from "@/lib/utils";

type Metric = "revenue" | "orders" | "items";
const METRICS: { key: Metric; label: string }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "orders", label: "Order count" },
  { key: "items", label: "Top items" },
];

export function SalesAnalytics() {
  const { activeTruckId } = useStore();
  const scope = useMemo(() => scopeData(activeTruckId), [activeTruckId]);
  const { sales: salesData, source, loading: salesLoading } =
    useSalesSummary(activeTruckId);
  const [metric, setMetric] = useState<Metric>("revenue");
  const [view, setView] = useState<"chart" | "table">("chart");

  const series = salesData.sales_by_day;

  // this period vs previous (split the series in half)
  const mid = Math.floor(series.length / 2);
  const prev = series.slice(0, mid);
  const curr = series.slice(mid);
  const sum = (arr: typeof series, k: "revenue" | "orders") =>
    arr.reduce((s, d) => s + d[k], 0);
  const revDelta = pctChange(sum(prev, "revenue"), sum(curr, "revenue"));
  const ordDelta = pctChange(sum(prev, "orders"), sum(curr, "orders"));

  const maxQty = Math.max(1, ...salesData.top_items.map((t) => t.qty));

  return (
    <div className="app-container py-8">
      <OwnerHeader
        title="Sales Analytics"
        subtitle={`Deeper slice of the numbers · ${scope.name}`}
        actions={
          <>
          <SourceBadge source={source} loading={salesLoading} />
          <div className="inline-flex rounded-xl border border-border bg-white p-1 dark:bg-white/5">
            {(["chart", "table"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold transition",
                  view === v ? "bg-petrol text-white" : "text-ink-secondary hover:text-petrol dark:hover:text-white",
                )}
              >
                {v === "chart" ? <BarChart3 className="size-4" /> : <Table2 className="size-4" />}
                {v === "chart" ? "Chart" : "Table"}
              </button>
            ))}
          </div>
          </>
        }
      />

      {/* comparison strip */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <CompareTile label="Revenue · this period" value={money(sum(curr, "revenue"))} delta={revDelta} />
        <CompareTile label="Orders · this period" value={String(sum(curr, "orders"))} delta={ordDelta} />
      </div>

      {/* metric switcher */}
      <div className="mb-4 inline-flex flex-wrap gap-1 rounded-full border border-border bg-white p-1 dark:bg-white/5">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-bold transition",
              metric === m.key ? "bg-turquoise text-white" : "text-ink-secondary hover:text-petrol dark:hover:text-white",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="rounded-[24px] border border-border bg-card p-5 shadow-sky-sm">
        {metric === "items" ? (
          <ItemsView items={scope.sales.top_items} maxQty={maxQty} view={view} />
        ) : view === "chart" ? (
          <>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-petrol dark:text-white">
              <TrendingUp className="size-5 text-turquoise" />
              {metric === "revenue" ? "Revenue" : "Orders"} by day
            </h2>
            <SalesChart data={series} metric={metric} type={metric === "orders" ? "bar" : "area"} height={340} />
          </>
        ) : (
          <SalesTable series={series} />
        )}
      </div>
    </div>
  );
}

function pctChange(a: number, b: number) {
  if (a === 0) return undefined;
  const pct = ((b - a) / a) * 100;
  return { value: `${Math.abs(pct).toFixed(0)}%`, positive: pct >= 0 };
}

function CompareTile({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: { value: string; positive: boolean };
}) {
  return (
    <div className="flex items-center justify-between rounded-[20px] border border-border bg-card p-5 shadow-sky-sm">
      <div>
        <p className="text-sm font-medium text-ink-secondary">{label}</p>
        <p className="mt-1 text-2xl font-extrabold text-petrol dark:text-white">{value}</p>
      </div>
      {delta && (
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full px-2.5 py-1 text-sm font-bold",
            delta.positive ? "bg-mint-soft text-leaf" : "bg-[#FDECEA] text-danger",
          )}
        >
          {delta.positive ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
          {delta.value}
          <span className="text-xs font-medium opacity-70">vs prev</span>
        </span>
      )}
    </div>
  );
}

function ItemsView({
  items,
  maxQty,
  view,
}: {
  items: { name: string; qty: number; revenue: number }[];
  maxQty: number;
  view: "chart" | "table";
}) {
  if (view === "table") {
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-ink-muted">
            <th className="pb-2 font-semibold">Item</th>
            <th className="pb-2 text-right font-semibold">Qty</th>
            <th className="pb-2 text-right font-semibold">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.name} className="border-b border-border/60 last:border-0">
              <td className="py-2.5 font-semibold text-petrol dark:text-white">{it.name}</td>
              <td className="py-2.5 text-right text-ink-secondary">{it.qty}</td>
              <td className="py-2.5 text-right font-bold text-petrol dark:text-white">{money(it.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <div className="space-y-4">
      {items.map((it, i) => (
        <div key={it.name}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-semibold text-petrol dark:text-white">
              <span className="grid size-5 place-items-center rounded-md bg-petrol text-[11px] font-bold text-white">
                {i + 1}
              </span>
              {it.name}
            </span>
            <span className="font-bold text-ink-secondary">{it.qty} sold · {money(it.revenue)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-turquoise" style={{ width: `${(it.qty / maxQty) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SalesTable({ series }: { series: { date: string; revenue: number; orders: number }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-ink-muted">
            <th className="pb-2 font-semibold">Date</th>
            <th className="pb-2 text-right font-semibold">Orders</th>
            <th className="pb-2 text-right font-semibold">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {series.map((d) => (
            <tr key={d.date} className="border-b border-border/60 last:border-0">
              <td className="py-2.5 font-semibold text-petrol dark:text-white">{shortDate(d.date)}</td>
              <td className="py-2.5 text-right text-ink-secondary">{d.orders}</td>
              <td className="py-2.5 text-right font-bold text-petrol dark:text-white">{money(d.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
