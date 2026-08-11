"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, Sparkles, SlidersHorizontal, X } from "lucide-react";
import { parseQuery, recommend, type Recommendation } from "@/lib/query-parser";
import type { ParsedQuery } from "@/lib/types";
import { trucks, CUISINES } from "@/lib/data";
import { api } from "@/lib/api";
import { TruckCard } from "@/components/bits/truck-card";
import { Chip } from "@/components/bits/chip";
import { Thinking } from "@/components/bits/thinking";
import { SourceBadge } from "@/components/bits/source-badge";
import type { Source } from "@/lib/use-sales";
import { Skeleton } from "@/components/ui/skeleton";
import { titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  "a cheap vegan lunch",
  "spicy tacos under $10",
  "poke near me",
  "vegetarian, open now",
];

function intentChips(p: ParsedQuery): { label: string; key: string }[] {
  const chips: { label: string; key: string }[] = [];
  if (p.diet) chips.push({ key: "diet", label: `diet: ${p.diet}` });
  if (p.cuisine) chips.push({ key: "cuisine", label: `cuisine: ${p.cuisine}` });
  if (p.max_price != null) chips.push({ key: "price", label: `≤ $${p.max_price}` });
  if (p.meal) chips.push({ key: "meal", label: `meal: ${p.meal}` });
  if (p.spice_level) chips.push({ key: "spice", label: `spice: ${p.spice_level}` });
  if (p.max_wait_min != null) chips.push({ key: "wait", label: `≤ ${p.max_wait_min} min` });
  if (p.open_now) chips.push({ key: "open", label: "open now" });
  return chips;
}

export function Discover() {
  const [query, setQuery] = useState("");
  const [parsed, setParsed] = useState<ParsedQuery | null>(null);
  const [results, setResults] = useState<Recommendation[]>(
    trucks.map((t) => ({ truck: t, reason: "", score: 0 })),
  );
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [source, setSource] = useState<Source>("mock");

  function rank(p: ParsedQuery) {
    setParsed(p);
    const recs = recommend(p).filter((r) => r.score > -2);
    setResults(recs.length ? recs : recommend(p));
  }

  async function runSearch(text: string) {
    const q = text.trim();
    setQuery(text);
    if (!q) return;
    setLoading(true);
    setSearched(true);
    try {
      // real Phase-1 extraction via the gateway; rank locally over rich data
      const { query: fq } = await api.parse(q);
      const local = parseQuery(q);
      rank({
        ...local,
        diet: fq.diet === "none" ? null : fq.diet,
        spice_level: fq.spice_level,
        max_price: fq.max_price,
        cuisine: fq.cuisine ?? local.cuisine,
        max_wait_min: fq.max_wait_min,
      });
      setSource("live");
    } catch {
      rank(parseQuery(q));
      setSource("mock");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-container py-8 sm:py-10">
      {/* Header + search */}
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="font-display text-[clamp(30px,5vw,44px)] leading-tight tracking-tight text-petrol dark:text-white">
          What are you <span className="brush-underline text-tangerine">craving</span>?
        </h1>
        <p className="mt-3 text-ink-secondary">
          Describe it in plain language — our AI understands taste, diet, budget, and more.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(query);
          }}
          className="mt-6"
        >
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2 pl-4 shadow-sky-md focus-within:border-turquoise focus-within:ring-4 focus-within:ring-turquoise/12">
            <Search className="size-5 shrink-0 text-ink-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. a cheap vegan lunch near me"
              className="h-11 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-tangerine px-4 py-2.5 font-bold text-white shadow-tangerine transition hover:-translate-y-0.5 hover:bg-tangerine-hover"
            >
              <Sparkles className="size-4" />
              <span className="hidden sm:inline">Find food</span>
            </button>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs font-semibold text-ink-muted">Try:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => runSearch(ex)}
              className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-ink-secondary transition hover:border-turquoise hover:text-petrol dark:bg-white/5"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Parsed intent */}
      <AnimatePresence>
        {parsed && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-auto mt-8 max-w-3xl rounded-2xl border border-turquoise/25 bg-blue-soft/60 p-4"
          >
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-petrol">
              <Sparkles className="size-4 text-turquoise" />
              Understood your request as
              <SourceBadge source={source} liveLabel="Live · LangChain" className="ml-auto" />
            </div>
            <div className="flex flex-wrap gap-2">
              {intentChips(parsed).length ? (
                intentChips(parsed).map((c) => (
                  <Chip key={c.key} variant="ai">
                    {c.label}
                  </Chip>
                ))
              ) : (
                <span className="text-sm text-ink-secondary">
                  No strong filters — showing top-rated trucks near you.
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-petrol dark:text-white">
            {loading ? (
              <Thinking label="Searching trucks…" />
            ) : searched ? (
              `${results.length} matches near you`
            ) : (
              "Popular trucks near you"
            )}
          </h2>
          <span className="hidden items-center gap-1.5 text-sm text-ink-muted sm:flex">
            <SlidersHorizontal className="size-4" />
            Sorted by match
          </span>
        </div>

        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-[20px] border border-border bg-card">
                <Skeleton className="aspect-[16/10] w-full rounded-none" />
                <div className="space-y-3 p-4">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : results.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((r, i) => (
              <TruckCard
                key={r.truck.id}
                truck={r.truck}
                reason={searched && r.reason ? r.reason.replace("Matched: ", "") : undefined}
                index={i}
              />
            ))}
          </div>
        ) : (
          <EmptyState onReset={() => runSearch("open now")} />
        )}
      </div>
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-[24px] border border-dashed border-border bg-card/60 p-12 text-center">
      <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-orange-soft text-3xl">
        🔍
      </div>
      <h3 className="text-lg font-bold text-petrol dark:text-white">No matches — try broader</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-secondary">
        We couldn&apos;t find trucks for that exact request. Loosen a filter or explore what&apos;s open now.
      </p>
      <button
        onClick={onReset}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-petrol bg-white px-4 py-2 text-sm font-bold text-petrol transition hover:bg-blue-soft dark:bg-transparent dark:text-white"
      >
        <X className="size-4" /> Clear filters
      </button>
    </div>
  );
}
