"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";
import { overall, trucks } from "@/lib/data";
import { Reveal } from "@/components/motion";

const avgTruckRating =
  trucks.reduce((s, t) => s + (t.rating ?? 0), 0) / (trucks.length || 1);

function CountUp({
  to,
  decimals = 0,
  suffix = "",
  prefix = "",
}: {
  to: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [v, setV] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const dur = 1200;
    const tick = (t: number) => {
      const p = Math.min((t - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(to * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to]);

  return (
    <span ref={ref}>
      {prefix}
      {v.toFixed(decimals)}
      {suffix}
    </span>
  );
}

export function StatsBand() {
  const stats = [
    { to: overall.truck_count, suffix: "+", label: "Food trucks nearby" },
    { to: overall.menu_count, suffix: "+", label: "Dishes to explore" },
    { to: overall.avg_rating_reviews ?? 4.6, decimals: 1, suffix: "★", label: "Average rating" },
    { to: 10, suffix: "K+", label: "Happy foodies" },
  ];

  return (
    <section className="app-container py-6">
      <Reveal className="grid grid-cols-2 gap-6 rounded-[28px] border border-border bg-gradient-to-br from-white to-blue-soft/40 px-6 py-8 shadow-sky-sm sm:px-10 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <p className="font-display text-[clamp(32px,4.5vw,48px)] leading-none text-petrol dark:text-white">
              <CountUp to={s.to} decimals={s.decimals} suffix={s.suffix} />
            </p>
            <p className="mt-2 text-sm font-semibold text-ink-secondary">{s.label}</p>
          </div>
        ))}
      </Reveal>
    </section>
  );
}
