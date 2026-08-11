"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag, Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { FaceSwitch } from "./face-switch";
import { TruckSelector } from "./truck-selector";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/discover", label: "Discover" },
  { href: "/concierge", label: "Concierge" },
  { href: "/order", label: "Order Builder" },
];

export function CustomerNav() {
  const pathname = usePathname();
  const { orderCount } = useStore();

  const isActive = (href: string) =>
    href === "/discover" ? pathname === href : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 glass-nav">
      <div className="app-container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "relative rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
                  isActive(l.href)
                    ? "text-petrol dark:text-white"
                    : "text-ink-secondary hover:text-petrol dark:hover:text-white",
                )}
              >
                {l.label}
                {isActive(l.href) && (
                  <span className="absolute inset-x-3.5 -bottom-0.5 h-0.5 rounded-full bg-tangerine" />
                )}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden lg:block">
            <TruckSelector scope="customer" />
          </div>

          <Link
            href="/order"
            className="relative grid size-9 place-items-center rounded-full border border-border bg-white/80 text-petrol shadow-sm transition hover:-translate-y-0.5 dark:bg-white/5 dark:text-white"
            aria-label="Your order"
          >
            <ShoppingBag className="size-[18px]" />
            {orderCount > 0 && (
              <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-tangerine px-1 text-[10px] font-bold text-white">
                {orderCount}
              </span>
            )}
          </Link>

          <div className="hidden sm:block">
            <FaceSwitch to="owner" />
          </div>
          <ThemeToggle />

          {/* mobile menu */}
          <Sheet>
            <SheetTrigger
              className="grid size-9 place-items-center rounded-full border border-border bg-white/80 text-petrol md:hidden dark:bg-white/5 dark:text-white"
              aria-label="Menu"
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>
                  <Logo />
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-2 flex flex-col gap-1 px-4">
                {LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={cn(
                      "rounded-xl px-4 py-3 text-base font-semibold",
                      isActive(l.href)
                        ? "bg-blue-soft text-petrol"
                        : "text-ink-secondary hover:bg-muted",
                    )}
                  >
                    {l.label}
                  </Link>
                ))}
                <div className="mt-4 px-1">
                  <TruckSelector scope="customer" className="w-full" />
                </div>
                <div className="mt-4 px-1">
                  <FaceSwitch to="owner" className="w-full justify-center" />
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
