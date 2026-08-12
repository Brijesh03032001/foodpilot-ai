"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import { scopeData } from "./data";
import type { Sales } from "./types";

export type Source = "live" | "mock";

/** Live sales from the Spring Boot gateway (JDBC), falling back to sample data. */
export function useSalesSummary(truckId: string | null) {
  const [sales, setSales] = useState<Sales>(() => scopeData(truckId).sales);
  const [source, setSource] = useState<Source>("mock");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .salesSummary(truckId ?? "all")
      .then((d) => {
        if (!alive) return;
        setSales({
          revenue: d.revenue,
          orders: d.orders,
          aov: d.aov,
          top_items: d.top_items,
          sales_by_day: d.sales_by_day,
        });
        setSource("live");
      })
      .catch(() => {
        if (!alive) return;
        setSales(scopeData(truckId).sales);
        setSource("mock");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [truckId]);

  return { sales, source, loading };
}
