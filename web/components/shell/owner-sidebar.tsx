"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  LineChart,
  MessagesSquare,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { FaceSwitch } from "./face-switch";
import { cn } from "@/lib/utils";

export const OWNER_NAV = [
  { href: "/owner", label: "Dashboard", icon: LayoutDashboard },
  { href: "/owner/analytics", label: "Sales Analytics", icon: LineChart },
  { href: "/owner/reviews", label: "Review Intelligence", icon: MessagesSquare },
  { href: "/owner/copilot", label: "Owner Copilot", icon: Sparkles },
];

export function OwnerSidebarContent() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/owner" ? pathname === href : pathname.startsWith(href);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center px-5">
        <Logo onDark />
      </div>

      <div className="px-4 pb-2 pt-4">
        <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-white/40">
          Operating system
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {OWNER_NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-white/72 hover:bg-white/8 hover:text-white",
              )}
            >
              <item.icon className="size-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="mb-3 rounded-xl bg-white/5 p-3 text-xs text-white/60">
          <p className="font-semibold text-white/80">FoodPilot for Owners</p>
          <p className="mt-0.5">Sales, reviews & AI copilot — read-only.</p>
        </div>
        <FaceSwitch to="customer" variant="ghost" className="w-full justify-center" />
      </div>
    </div>
  );
}
