"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import * as d3 from "d3";
import type { SalesByDay } from "@/lib/types";
import { shortDate, money } from "@/lib/format";

const TURQUOISE = "#2A9D9A";
const TANGERINE = "#FF7043";
const GRID = "#E6EFF0";
const MUTED = "#82979D";

type Metric = "revenue" | "orders";

/** Responsive width via ResizeObserver. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(720);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width;
      if (cw) setW(cw);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function SalesChart({
  data,
  metric = "revenue",
  type = "area",
  height = 300,
}: {
  data: SalesByDay[];
  metric?: Metric;
  type?: "area" | "bar";
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const color = metric === "revenue" ? TURQUOISE : TANGERINE;
  const m = { top: 14, right: 16, bottom: 26, left: 46 };
  const iw = Math.max(10, width - m.left - m.right);
  const ih = Math.max(10, height - m.top - m.bottom);

  const points = useMemo(
    () =>
      data.map((d, i) => ({
        i,
        label: shortDate(d.date),
        value: metric === "revenue" ? d.revenue : d.orders,
        raw: d,
      })),
    [data, metric],
  );

  const { x, xBand, y, linePath, areaPath, yTicks, xTickIdx } = useMemo(() => {
    const maxV = d3.max(points, (p) => p.value) ?? 1;
    const y = d3.scaleLinear().domain([0, maxV * 1.18]).nice().range([ih, 0]);
    const x = d3
      .scalePoint<number>()
      .domain(points.map((p) => p.i))
      .range([0, iw]);
    const xBand = d3
      .scaleBand<number>()
      .domain(points.map((p) => p.i))
      .range([0, iw])
      .padding(0.35);

    const line = d3
      .line<(typeof points)[number]>()
      .x((p) => x(p.i) ?? 0)
      .y((p) => y(p.value))
      .curve(d3.curveMonotoneX);
    const area = d3
      .area<(typeof points)[number]>()
      .x((p) => x(p.i) ?? 0)
      .y0(ih)
      .y1((p) => y(p.value))
      .curve(d3.curveMonotoneX);

    const yTicks = y.ticks(4);
    // thin out x labels to avoid crowding
    const every = Math.ceil(points.length / Math.max(4, Math.floor(iw / 70)));
    const xTickIdx = points.filter((_, i) => i % every === 0).map((p) => p.i);

    return {
      x,
      xBand,
      y,
      linePath: line(points) ?? "",
      areaPath: area(points) ?? "",
      yTicks,
      xTickIdx,
    };
  }, [points, iw, ih]);

  if (!data.length) {
    return (
      <div
        style={{ height }}
        className="grid place-items-center rounded-2xl border border-dashed border-border text-sm text-ink-muted"
      >
        No sales in this range yet.
      </div>
    );
  }

  const hp = hover != null ? points[hover] : null;
  const hx = hp ? (type === "bar" ? (xBand(hp.i) ?? 0) + xBand.bandwidth() / 2 : x(hp.i) ?? 0) : 0;

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    let nearest = 0;
    let best = Infinity;
    points.forEach((p) => {
      const px = type === "bar" ? (xBand(p.i) ?? 0) + xBand.bandwidth() / 2 : x(p.i) ?? 0;
      const dist = Math.abs(px - mx);
      if (dist < best) {
        best = dist;
        nearest = p.i;
      }
    });
    setHover(nearest);
  }

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      <svg width={width} height={height} className="overflow-visible">
        <g transform={`translate(${m.left},${m.top})`}>
          {/* gridlines + y labels */}
          {yTicks.map((t) => (
            <g key={t} transform={`translate(0,${y(t)})`}>
              <line x1={0} x2={iw} stroke={GRID} />
              <text x={-10} dy="0.32em" textAnchor="end" fontSize={11} fill={MUTED}>
                {metric === "revenue" ? `$${t}` : t}
              </text>
            </g>
          ))}

          {/* x labels */}
          {xTickIdx.map((i) => {
            const px = type === "bar" ? (xBand(i) ?? 0) + xBand.bandwidth() / 2 : x(i) ?? 0;
            return (
              <text
                key={i}
                x={px}
                y={ih + 18}
                textAnchor="middle"
                fontSize={11}
                fill={MUTED}
              >
                {points[i].label}
              </text>
            );
          })}

          {type === "area" ? (
            <>
              <defs>
                <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <motion.path
                d={areaPath}
                fill={`url(#grad-${metric})`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.3 }}
              />
              <motion.path
                d={linePath}
                fill="none"
                stroke={color}
                strokeWidth={2.5}
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1, ease: "easeInOut" }}
              />
              {points.map((p) => (
                <motion.circle
                  key={p.i}
                  cx={x(p.i) ?? 0}
                  cy={y(p.value)}
                  r={hover === p.i ? 5 : 3}
                  fill={color}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + p.i * 0.02 }}
                />
              ))}
            </>
          ) : (
            points.map((p) => (
              <motion.rect
                key={p.i}
                x={xBand(p.i) ?? 0}
                width={xBand.bandwidth()}
                rx={5}
                initial={{ height: 0, y: ih }}
                animate={{ height: ih - y(p.value), y: y(p.value) }}
                transition={{ duration: 0.6, delay: p.i * 0.03, ease: [0.22, 1, 0.36, 1] }}
                fill={hover === p.i ? TANGERINE : color}
                opacity={hover == null || hover === p.i ? 1 : 0.55}
              />
            ))
          )}

          {/* hover guide */}
          {hp && (
            <>
              <line x1={hx} x2={hx} y1={0} y2={ih} stroke={color} strokeDasharray="4 4" opacity={0.5} />
              {type === "area" && (
                <circle cx={hx} cy={y(hp.value)} r={6} fill="white" stroke={color} strokeWidth={2.5} />
              )}
            </>
          )}

          {/* interaction surface */}
          <rect
            width={iw}
            height={ih}
            fill="transparent"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          />
        </g>
      </svg>

      {/* tooltip */}
      {hp && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl border border-border bg-white px-3 py-2 text-sm shadow-sky-md dark:bg-petrol-deep"
          style={{ left: m.left + hx, top: m.top + y(hp.value) - 12 }}
        >
          <p className="font-bold text-petrol dark:text-white">{hp.label}</p>
          <p className="whitespace-nowrap text-ink-secondary">
            {metric === "revenue" ? money(hp.raw.revenue) : `${hp.raw.orders} orders`}
          </p>
        </div>
      )}
    </div>
  );
}
