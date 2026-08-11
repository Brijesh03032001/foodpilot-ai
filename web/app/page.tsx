import Link from "next/link";
import Image from "next/image";
import {
  Leaf,
  MessagesSquare,
  Salad,
  Heart,
  ArrowRight,
  Check,
} from "lucide-react";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { Hero } from "@/components/marketing/hero";
import { Marquee } from "@/components/marketing/marquee";
import { StatsBand } from "@/components/marketing/stats-band";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion";
import { cn } from "@/lib/utils";

const FEATURES = [
  { icon: Leaf, tint: "text-leaf bg-mint-soft", title: "Fresh & Local", body: "Discover local food trucks and fresh flavors near you." },
  { icon: MessagesSquare, tint: "text-turquoise bg-blue-soft", title: "Ask Anything", body: "Chat with our AI concierge and get instant answers." },
  { icon: Salad, tint: "text-tangerine bg-orange-soft", title: "Build Your Order", body: "Customize your meal your way and order with ease." },
  { icon: Heart, tint: "text-tangerine bg-orange-soft", title: "Made for Food Lovers", body: "From picky eaters to food adventurers — we've got you." },
];

const CHECKS = [
  "Find food that fits your taste, diet, and budget",
  "Get real-time info on wait time, location & more",
  "Customize your order with ease",
  "Track your order and get updates",
];

const STEPS = [
  { n: 1, img: "/images/search-food.png", title: "Tell Us", body: "Search or chat with us about what you're craving." },
  { n: 2, img: "/images/food-truck4.png", cover: true, title: "Discover", body: "We recommend the best food trucks and dishes." },
  { n: 3, img: "/images/dish.png", title: "Build Your Order", body: "Customize it your way with simple steps." },
  { n: 4, img: "/images/deliver.png", title: "Enjoy!", body: "Place your order and enjoy amazing food." },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingNav />

      <main className="flex-1">
        <Hero />

        {/* Feature strip */}
        <section className="app-container">
          <Reveal className="rounded-[28px] border border-border bg-card p-6 shadow-sky-md sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[auto_1fr] lg:items-center lg:gap-10">
              <h2 className="max-w-[10ch] font-display text-3xl leading-tight text-petrol dark:text-white">
                Loved by Foodies Everywhere
              </h2>
              <StaggerGroup className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {FEATURES.map((f) => (
                  <StaggerItem key={f.title}>
                    <div className="group">
                      <span className={`mb-3 grid size-11 place-items-center rounded-2xl ${f.tint}`}>
                        <f.icon className="size-5" />
                      </span>
                      <h3 className="text-[15px] font-bold text-petrol dark:text-white">{f.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-ink-secondary">{f.body}</p>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerGroup>
            </div>
          </Reveal>
        </section>

        <Marquee />

        {/* Phone showcase */}
        <section className="app-container py-20 sm:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <Reveal className="relative mx-auto w-full max-w-md">
              <Image
                src="/images/landing-page.png"
                alt="FoodPilot app — discover food trucks near you"
                width={1024}
                height={1536}
                className="h-auto w-full drop-shadow-[0_30px_60px_rgba(18,60,74,0.20)]"
              />
            </Reveal>

            <Reveal delay={0.1}>
              <h2 className="font-display text-[clamp(30px,4vw,44px)] leading-[1.05] tracking-tight text-petrol dark:text-white">
                Food Made Simple,
                <br />
                <span className="brush-underline text-tangerine">Conversations Made Better.</span>
              </h2>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-secondary">
                Tell us what you want, ask anything, and let our AI concierge guide
                you to the best food trucks, build your order, and make it
                unforgettable.
              </p>
              <ul className="mt-7 space-y-3.5">
                {CHECKS.map((c) => (
                  <li key={c} className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-mint-soft text-leaf">
                      <Check className="size-4" strokeWidth={3} />
                    </span>
                    <span className="text-[15px] font-medium text-ink">{c}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/concierge"
                className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-petrol px-6 py-3.5 text-base font-bold text-white transition hover:-translate-y-0.5 hover:bg-petrol-deep"
              >
                Meet the concierge
                <ArrowRight className="size-5" />
              </Link>
            </Reveal>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="app-container scroll-mt-20 py-8">
          <Reveal className="mx-auto mb-12 max-w-2xl text-center">
            <p className="mb-2 flex items-center justify-center gap-2 text-sm font-bold text-leaf">
              🌿 <span className="font-display text-2xl text-petrol dark:text-white">How FoodPilot Works</span> 🌿
            </p>
          </Reveal>
          <StaggerGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <StaggerItem key={s.n}>
                <div className="group/step relative h-full rounded-[24px] border border-border bg-card p-6 text-center shadow-sky-sm transition hover:-translate-y-1.5 hover:shadow-sky-md">
                  <span
                    className={cn(
                      "mx-auto mb-3 grid size-24 place-items-center overflow-hidden transition-transform duration-300 group-hover/step:scale-105",
                      s.cover && "rounded-2xl border border-border",
                    )}
                  >
                    <Image
                      src={s.img}
                      alt={s.title}
                      width={200}
                      height={200}
                      className={cn("size-full", s.cover ? "object-cover" : "object-contain")}
                    />
                  </span>
                  <span className="absolute left-4 top-4 grid size-7 place-items-center rounded-full bg-petrol text-xs font-bold text-white">
                    {s.n}
                  </span>
                  <h3 className="text-lg font-bold text-petrol dark:text-white">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">{s.body}</p>
                  {i < STEPS.length - 1 && (
                    <ArrowRight className="absolute -right-3 top-1/2 hidden size-5 -translate-y-1/2 text-border lg:block" />
                  )}
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </section>

        <StatsBand />

        {/* CTA banner — designed art asset */}
        <section id="about" className="app-container scroll-mt-20 py-20">
          <Reveal>
            <Link
              href="/discover"
              aria-label="Get started — Hungry? Let's fix that."
              className="group relative block overflow-hidden rounded-[28px] shadow-sky-lg"
            >
              <Image
                src="/images/footer-landing.png"
                alt="Hungry? Let's fix that. Join thousands of food lovers finding their next favorite meal."
                width={2103}
                height={748}
                className="w-full scale-[1.03] transition-transform duration-500 group-hover:scale-[1.05]"
                priority
              />
              <span className="absolute bottom-[9%] left-1/2 inline-flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-tangerine px-6 py-3 text-sm font-bold text-white shadow-tangerine-lg transition-[transform,background-color] group-hover:-translate-y-1 group-hover:bg-tangerine-hover sm:px-8 sm:py-4 sm:text-base">
                Get Started
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </Reveal>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
