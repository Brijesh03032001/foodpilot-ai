"use client";

import { useRouter } from "next/navigation";
import { Store, UtensilsCrossed } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/** The single most important control: flips between Order and Owner faces. */
export function FaceSwitch({
  to,
  variant = "solid",
  className,
}: {
  to: "owner" | "customer";
  variant?: "solid" | "ghost";
  className?: string;
}) {
  const router = useRouter();
  const { setFace } = useStore();

  function go() {
    setFace(to);
    router.push(to === "owner" ? "/owner" : "/discover");
  }

  const label = to === "owner" ? "Switch to Owner" : "Switch to Order";
  const Icon = to === "owner" ? Store : UtensilsCrossed;

  return (
    <button
      type="button"
      onClick={go}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition hover:-translate-y-0.5",
        variant === "solid"
          ? "bg-petrol text-white shadow-sm hover:bg-petrol-deep"
          : "border border-white/20 bg-white/10 text-white hover:bg-white/15",
        className,
      )}
    >
      <Icon className="size-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
