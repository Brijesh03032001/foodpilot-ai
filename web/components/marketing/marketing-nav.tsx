"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { FaceSwitch } from "@/components/shell/face-switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const LINKS = [
  { href: "/discover", label: "For Customers" },
  { href: "/owner", label: "For Owners" },
  { href: "#how", label: "How It Works" },
  { href: "#about", label: "About Us" },
];

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 glass-nav">
      <div className="app-container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Sheet>
            <SheetTrigger
              className="grid size-9 place-items-center rounded-full text-petrol md:hidden dark:text-white"
              aria-label="Menu"
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
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
                    className="rounded-xl px-4 py-3 text-base font-semibold text-ink-secondary hover:bg-muted"
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
          <Logo />
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-3.5 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:text-petrol dark:hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <FaceSwitch to="owner" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
