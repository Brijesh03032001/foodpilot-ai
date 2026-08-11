"use client";

import { motion } from "motion/react";

const ITEMS = [
  "🌮 Tacos",
  "🍜 Ramen",
  "🥗 Poke bowls",
  "🍔 Smash burgers",
  "🌯 Burritos",
  "🧆 Falafel",
  "🍛 Curry",
  "🥟 Dumplings",
  "🍣 Sushi",
  "🌭 Loaded dogs",
  "🍦 Desserts",
  "☕ Cold brew",
];

/** A rotated, endlessly-scrolling food-market ticker. */
export function Marquee() {
  const row = [...ITEMS, ...ITEMS];
  return (
    <div className="relative my-10 overflow-hidden py-3">
      <div className="-rotate-2 scale-110 border-y border-white/10 bg-petrol py-4 shadow-sky-md">
        <motion.div
          className="flex w-max gap-10 whitespace-nowrap pr-10"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 30, ease: "linear", repeat: Infinity }}
        >
          {row.map((it, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-4 text-lg font-bold text-white/90"
            >
              {it}
              <span className="size-1.5 rounded-full bg-tangerine" />
            </span>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
