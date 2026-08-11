"use client";

import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { TruckSelector } from "./truck-selector";
import { OwnerSidebarContent } from "./owner-sidebar";
import { useStore } from "@/lib/store";
import { getTruck } from "@/lib/data";

export function OwnerTopbar() {
  const { activeTruckId } = useStore();
  const scopeName = activeTruckId
    ? getTruck(activeTruckId)?.name ?? "All trucks"
    : "All trucks";

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 glass-nav">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Sheet>
            <SheetTrigger
              className="grid size-9 place-items-center rounded-full border border-border bg-white/80 text-petrol lg:hidden dark:bg-white/5 dark:text-white"
              aria-label="Menu"
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-0 p-0">
              <OwnerSidebarContent />
            </SheetContent>
          </Sheet>
          <div className="hidden sm:block">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              Scope
            </p>
            <p className="-mt-0.5 text-sm font-bold text-petrol dark:text-white">
              {scopeName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <TruckSelector scope="owner" className="w-[180px] sm:w-[210px]" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
