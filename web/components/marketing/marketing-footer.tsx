import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const COLS = [
  {
    title: "Discover",
    links: [
      { label: "Find food", href: "/discover" },
      { label: "Concierge", href: "/concierge" },
      { label: "Order Builder", href: "/order" },
    ],
  },
  {
    title: "For Owners",
    links: [
      { label: "Dashboard", href: "/owner" },
      { label: "Sales Analytics", href: "/owner/analytics" },
      { label: "Review Intelligence", href: "/owner/reviews" },
      { label: "Owner Copilot", href: "/owner/copilot" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "How it works", href: "#how" },
      { label: "About us", href: "#about" },
      { label: "Contact", href: "#" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/70 bg-petrol text-white">
      <div className="app-container grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="max-w-xs">
          <Logo onDark />
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            An AI-native outdoor food marketplace. Find the best food trucks,
            ask anything, and build the perfect order.
          </p>
        </div>
        {COLS.map((col) => (
          <div key={col.title}>
            <h4 className="text-sm font-bold">{col.title}</h4>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-sm text-white/70 transition-colors hover:text-white"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="app-container flex flex-col items-center justify-between gap-3 py-5 text-xs text-white/55 sm:flex-row">
          <p>© {new Date().getFullYear()} FoodPilot · Sky Market. Built with real project data.</p>
          <p>Made for hungry humans & busy owners.</p>
        </div>
      </div>
    </footer>
  );
}
