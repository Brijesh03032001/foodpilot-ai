"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Clock, Star } from "lucide-react";

const AVATARS = ["🧑🏽", "👩🏻", "🧔🏾", "👩🏼"];

function FloatChip({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      <motion.div
        animate={{ y: [0, -7, 0] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut", delay }}
        className="rounded-2xl border border-border bg-white/95 px-3.5 py-2.5 shadow-sky-md backdrop-blur dark:bg-petrol-deep/90"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      {/* full-bleed market scene, blended into the copy on the left */}
      <div className="absolute inset-0 -z-10">
        <Image
          src="/images/main-landing-page.png"
          alt="Poke Delish food truck at an outdoor market with friends dining"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[68%_center]"
        />
        {/* left → right fade keeps the headline legible over the art */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#F4FAFB] from-25% via-[#F4FAFB]/80 to-transparent md:via-[#F4FAFB]/55 dark:from-[#0a2730] dark:via-[#0a2730]/80" />
        {/* bottom fade blends into the next section */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#F8FCFC] to-transparent dark:from-[#0b2c35]" />
      </div>

      <div className="app-container relative flex min-h-[clamp(580px,84vh,800px)] items-center py-16">
        <div className="max-w-xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-white/80 px-3.5 py-1.5 text-xs font-bold text-petrol shadow-sm backdrop-blur dark:bg-white/5 dark:text-white"
          >
            <span className="grid size-4 place-items-center rounded-full bg-turquoise text-[9px] text-white">
              AI
            </span>
            AI-native food marketplace
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="font-display text-[clamp(46px,7vw,78px)] leading-[0.96] tracking-[-0.035em] text-petrol-deep dark:text-white"
          >
            Your Food.
            <br />
            <span className="brush-underline text-tangerine">Your Way.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-5 max-w-md text-lg font-medium leading-relaxed text-ink-secondary"
          >
            Find the best food trucks, ask anything, and build the perfect order —
            powered by an AI concierge that actually understands you.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Link
              href="/discover"
              className="group inline-flex items-center gap-2 rounded-2xl bg-tangerine px-6 py-3.5 text-base font-bold text-white shadow-tangerine transition hover:-translate-y-0.5 hover:bg-tangerine-hover hover:shadow-tangerine-lg"
            >
              Find Food Now
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/discover"
              className="inline-flex items-center gap-2 rounded-2xl border-[1.5px] border-petrol bg-white/85 px-6 py-3.5 text-base font-bold text-petrol backdrop-blur transition hover:-translate-y-0.5 hover:bg-blue-soft dark:bg-white/10 dark:text-white"
            >
              Explore Food Trucks
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-8 flex items-center gap-3"
          >
            <div className="flex -space-x-2.5">
              {AVATARS.map((a, i) => (
                <span
                  key={i}
                  className="grid size-9 place-items-center rounded-full border-2 border-white bg-gradient-to-br from-blue-soft to-mint-soft text-base shadow-sm"
                >
                  {a}
                </span>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-0.5 text-tangerine">
                {[0, 1, 2, 3].map((i) => (
                  <Star key={i} className="size-4 fill-current" />
                ))}
                <Star className="size-4 fill-current [clip-path:inset(0_50%_0_0)]" />
              </div>
              <p className="text-sm font-semibold text-ink-secondary">
                Loved by 10K+ foodies
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* floating chips over the truck scene */}
      <FloatChip className="absolute right-[6%] top-28 z-10 hidden lg:block" delay={0.5}>
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-leaf" />
          <span className="text-sm font-bold text-petrol dark:text-white">Open now</span>
        </div>
      </FloatChip>
      <FloatChip className="absolute right-[4%] top-1/2 z-10 hidden lg:block" delay={0.7}>
        <div className="flex items-center gap-2 text-petrol dark:text-white">
          <Clock className="size-4 text-turquoise" />
          <span className="text-sm font-bold">~7 min wait</span>
        </div>
      </FloatChip>
      <FloatChip className="absolute bottom-16 right-[16%] z-10 hidden xl:block" delay={0.9}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">🍜</span>
          <div>
            <p className="text-xs text-ink-muted">Tofu Veggie Bowl</p>
            <p className="text-sm font-extrabold text-petrol dark:text-white">$11.50</p>
          </div>
          <span className="rounded-lg bg-tangerine px-2 py-1 text-xs font-bold text-white">
            Add
          </span>
        </div>
      </FloatChip>
    </section>
  );
}
