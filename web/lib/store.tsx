"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import type { OrderLine, MenuItem, Truck, ConfirmedOrder } from "./types";
import { lineTotal } from "./format";

type Face = "customer" | "owner";

interface StoreValue {
  face: Face;
  setFace: (f: Face) => void;

  activeTruckId: string | null;
  setActiveTruckId: (id: string | null) => void;

  order: OrderLine[];
  setOrder: (lines: OrderLine[]) => void;
  addItem: (truck: Truck, item: MenuItem, quantity?: number) => void;
  addLine: (line: OrderLine) => void;
  updateQty: (lineId: string, qty: number) => void;
  removeLine: (lineId: string) => void;
  clearOrder: () => void;

  orderCount: number;
  orderSubtotal: number;
  confirmedOrder: ConfirmedOrder | null;
  setConfirmedOrder: (o: ConfirmedOrder | null) => void;
}

const StoreCtx = createContext<StoreValue | null>(null);

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [face, setFaceState] = useState<Face>("customer");
  const [activeTruckId, setActiveTruckId] = useState<string | null>(null);
  const [order, setOrderState] = useState<OrderLine[]>([]);
  const [confirmedOrder, setConfirmedOrderState] = useState<ConfirmedOrder | null>(null);

  // hydrate from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("foodpilot:order");
      if (saved) setOrderState(JSON.parse(saved));
      const f = localStorage.getItem("foodpilot:face") as Face | null;
      if (f) setFaceState(f);
      const co = localStorage.getItem("foodpilot:confirmed");
      if (co) setConfirmedOrderState(JSON.parse(co));
    } catch {
      /* ignore */
    }
  }, []);

  const setConfirmedOrder = useCallback((o: ConfirmedOrder | null) => {
    setConfirmedOrderState(o);
    try {
      if (o) localStorage.setItem("foodpilot:confirmed", JSON.stringify(o));
      else localStorage.removeItem("foodpilot:confirmed");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("foodpilot:order", JSON.stringify(order));
    } catch {
      /* ignore */
    }
  }, [order]);

  const setFace = useCallback((f: Face) => {
    setFaceState(f);
    try {
      localStorage.setItem("foodpilot:face", f);
    } catch {
      /* ignore */
    }
  }, []);

  const setOrder = useCallback((lines: OrderLine[]) => setOrderState(lines), []);

  const addItem = useCallback(
    (truck: Truck, item: MenuItem, quantity = 1) => {
      setOrderState((prev) => {
        const existing = prev.find(
          (l) => l.itemId === item.id && l.mods.length === 0,
        );
        if (existing) {
          return prev.map((l) =>
            l.id === existing.id
              ? { ...l, quantity: l.quantity + quantity }
              : l,
          );
        }
        return [
          ...prev,
          {
            id: uid(),
            itemId: item.id,
            truckId: truck.id,
            truckName: truck.name,
            name: item.name,
            emoji: item.emoji,
            basePrice: item.price,
            quantity,
            mods: [],
          },
        ];
      });
    },
    [],
  );

  const addLine = useCallback((line: OrderLine) => {
    setOrderState((prev) => [...prev, line]);
  }, []);

  const updateQty = useCallback((lineId: string, qty: number) => {
    setOrderState((prev) =>
      prev
        .map((l) => (l.id === lineId ? { ...l, quantity: qty } : l))
        .filter((l) => l.quantity > 0),
    );
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setOrderState((prev) => prev.filter((l) => l.id !== lineId));
  }, []);

  const clearOrder = useCallback(() => setOrderState([]), []);

  const orderCount = useMemo(
    () => order.reduce((s, l) => s + l.quantity, 0),
    [order],
  );
  const orderSubtotal = useMemo(
    () =>
      order.reduce(
        (s, l) => s + lineTotal(l.basePrice, l.quantity, l.mods),
        0,
      ),
    [order],
  );

  const value: StoreValue = {
    face,
    setFace,
    activeTruckId,
    setActiveTruckId,
    order,
    setOrder,
    addItem,
    addLine,
    updateQty,
    removeLine,
    clearOrder,
    orderCount,
    orderSubtotal,
    confirmedOrder,
    setConfirmedOrder,
  };

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
