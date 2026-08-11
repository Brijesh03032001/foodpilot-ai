"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, MessageCircle, ShoppingBag, Store } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/discover", label: "Explore", icon: Compass },
  { href: "/concierge", label: "Chat", icon: MessageCircle },
  { href: "/order", label: "Order", icon: ShoppingBag, cart: true },
  { href: "/owner", label: "Owner", icon: Store },
];

export function CustomerBottomNav() {
  const pathname = usePathname();
  const { orderCount } = useStore();
  const isActive = (href: string) =>
    href === "/discover" ? pathname === href : pathname.startsWith(href);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 glass-nav pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="grid grid-cols-4">
        {ITEMS.map((it) => {
          const active = isActive(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold",
                active ? "text-tangerine" : "text-ink-muted",
              )}
            >
              <span className="relative">
                <it.icon className="size-[22px]" />
                {it.cart && orderCount > 0 && (
                  <span className="absolute -right-2 -top-1.5 grid min-w-4 place-items-center rounded-full bg-tangerine px-1 text-[9px] font-bold text-white">
                    {orderCount}
                  </span>
                )}
              </span>
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
