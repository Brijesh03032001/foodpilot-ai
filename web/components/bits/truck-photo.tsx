"use client";

import Image from "next/image";
import { useState } from "react";
import type { Truck } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Stable hue from the truck id so the gradient fallback feels intentional. */
function hueOf(id: string): number {
  return Array.from(id).reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
}

function StringLights() {
  return (
    <svg
      className="absolute inset-x-0 top-0 h-8 w-full opacity-70"
      viewBox="0 0 300 30"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d="M0 6 Q75 24 150 8 T300 6"
        stroke="rgba(18,60,74,0.25)"
        strokeWidth="1"
        fill="none"
      />
      {[20, 65, 110, 150, 190, 235, 280].map((x, i) => (
        <circle key={i} cx={x} cy={i % 2 ? 15 : 12} r="3" fill="#FFD76A" />
      ))}
    </svg>
  );
}

/**
 * Truck imagery with graceful degradation:
 * local branded art → real Yelp photo → on-brand gradient "scene".
 */
export function TruckPhoto({
  truck,
  className,
  priority = false,
}: {
  truck: Truck;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const src = truck.photo ?? truck.image;
  const showImg = src && !failed;
  const hue = hueOf(truck.id);

  return (
    <div className={cn("relative overflow-hidden bg-blue-soft", className)}>
      {showImg ? (
        <Image
          src={src}
          alt={truck.name}
          fill
          sizes="(max-width: 768px) 100vw, 420px"
          priority={priority}
          className="food-image object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="absolute inset-0 grid place-items-center"
          style={{
            background: `linear-gradient(135deg, hsl(${hue} 45% 92%), #ffffff 55%, hsl(${(hue + 40) % 360} 50% 90%))`,
          }}
        >
          <StringLights />
          <span className="text-6xl drop-shadow-sm">{truck.emoji}</span>
        </div>
      )}
    </div>
  );
}
