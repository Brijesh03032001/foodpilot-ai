"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { trucks, salesTrucks } from "@/lib/data";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function TruckSelector({
  scope = "customer",
  onDark = false,
  className,
}: {
  scope?: "customer" | "owner";
  onDark?: boolean;
  className?: string;
}) {
  const { activeTruckId, setActiveTruckId } = useStore();
  const list = scope === "owner" ? salesTrucks : trucks;
  const value = activeTruckId ?? "all";
  const selected = activeTruckId ? list.find((t) => t.id === activeTruckId) : null;
  const label = selected
    ? `${selected.emoji} ${selected.name}`
    : scope === "owner"
      ? "🏙️ All trucks"
      : "📍 All trucks near me";

  return (
    <Select
      value={value}
      onValueChange={(v) => setActiveTruckId(v === "all" ? null : v)}
    >
      <SelectTrigger
        className={cn(
          "h-10 gap-2 rounded-full font-semibold",
          onDark
            ? "border-white/15 bg-white/10 text-white data-[placeholder]:text-white/70"
            : "bg-white",
          className,
        )}
      >
        <span className="truncate">{label}</span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          {scope === "owner" ? "🏙️ All trucks" : "📍 All trucks near me"}
        </SelectItem>
        {list.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            {t.emoji} {t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
