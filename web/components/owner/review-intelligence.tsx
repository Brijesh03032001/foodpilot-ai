"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { RefreshCw, Star, Quote, Info, ThumbsUp } from "lucide-react";
import { useStore } from "@/lib/store";
import { scopeData } from "@/lib/data";
import { titleCase } from "@/lib/format";
import { api } from "@/lib/api";
import { OwnerHeader } from "./owner-header";
import { SourceBadge } from "@/components/bits/source-badge";
import type { Source } from "@/lib/use-sales";
import type { Complaint } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LiveReport {
  counts: { positive: number; neutral: number; negative: number };
  complaints: Complaint[];
  total: number;
}

export function ReviewIntelligence() {
  const { activeTruckId } = useStore();
  const scope = useMemo(() => scopeData(activeTruckId), [activeTruckId]);
  const intel = scope.intel;

  const [live, setLive] = useState<LiveReport | null>(null);
  const [source, setSource] = useState<Source>("mock");
  const [selected, setSelected] = useState<string | null>(intel.complaints[0]?.topic ?? null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // live report if available, else the curated classification
  const counts = live?.counts ?? intel.counts;
  const complaints = live?.complaints ?? intel.complaints;
  const total = live?.total ?? intel.total ?? 1;

  // reset when the scope changes
  useEffect(() => {
    setLive(null);
    setSource("mock");
    setSelected(intel.complaints[0]?.topic ?? null);
  }, [intel]);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const { positive, neutral, negative } = counts;
  const posPct = (positive / total) * 100;
  const neuPct = (neutral / total) * 100;
  const negPct = (negative / total) * 100;
  const maxComplaint = Math.max(1, ...complaints.map((c) => c.pct));
  const examples = selected ? intel.examples[selected] ?? [] : [];

  async function rerun() {
    if (running) return;
    setRunning(true);
    setProgress(0);
    const bar = intel.total || 150;
    const step = Math.max(1, Math.round(bar / 60));
    // creep the bar up while the LLM classifies; finish on response
    timer.current = setInterval(() => {
      setProgress((p) => Math.min(p + step, bar - step));
    }, 900);
    try {
      const r = await api.reviewsReport(activeTruckId);
      setLive({ counts: r.counts, complaints: r.complaints, total: r.total });
      setSource("live");
      setSelected(r.complaints[0]?.topic ?? selected);
    } catch {
      setSource("mock");
    } finally {
      if (timer.current) clearInterval(timer.current);
      setProgress(bar);
      setTimeout(() => setRunning(false), 400);
    }
  }

  const barTotal = intel.total || 150;

  return (
    <div className="app-container py-8">
      <OwnerHeader
        title="Review Intelligence"
        subtitle={`Every review, classified and ranked · ${scope.name}`}
        actions={
          <>
            <SourceBadge source={source} liveLabel="Live · CreateAI classify" />
            <button
              onClick={rerun}
              disabled={running}
              className="inline-flex items-center gap-2 rounded-xl bg-petrol px-4 py-2.5 text-sm font-bold text-white transition hover:bg-petrol-deep disabled:opacity-70"
            >
              <RefreshCw className={cn("size-4", running && "animate-spin")} />
              {running ? "Running…" : "Re-run report"}
            </button>
          </>
        }
      />

      <AnimatePresence>
        {running && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 overflow-hidden rounded-2xl border border-turquoise/25 bg-blue-soft/60 p-4"
          >
            <div className="mb-2 flex items-center justify-between text-sm font-semibold text-petrol dark:text-white">
              <span>Classifying reviews (map-reduce, CreateAI batch)… this takes ~1–2 min</span>
              <span>{Math.min(progress, barTotal)} / {barTotal}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/70">
              <div
                className="h-full rounded-full bg-turquoise transition-all"
                style={{ width: `${(Math.min(progress, barTotal) / barTotal) * 100}%` }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="rounded-[24px] border border-border bg-card p-5 shadow-sky-sm">
          <h2 className="mb-4 text-lg font-bold text-petrol dark:text-white">Sentiment</h2>
          <div className="mb-4 grid grid-cols-3 gap-3 text-center">
            <SentTile label="Positive" value={positive} color="text-leaf" bg="bg-mint-soft" />
            <SentTile label="Neutral" value={neutral} color="text-turquoise" bg="bg-blue-soft" />
            <SentTile label="Negative" value={negative} color="text-danger" bg="bg-[#FDECEA]" />
          </div>
          <div className="flex h-3 overflow-hidden rounded-full">
            <div style={{ width: `${posPct}%` }} className="bg-leaf" />
            <div style={{ width: `${neuPct}%` }} className="bg-turquoise" />
            <div style={{ width: `${negPct}%` }} className="bg-danger" />
          </div>
          <p className="mt-3 text-sm text-ink-secondary">
            <span className="font-bold text-petrol dark:text-white">{posPct.toFixed(0)}% positive</span>{" "}
            across {total} reviews.
          </p>

          {intel.highlights[0] && (
            <div className="mt-4 rounded-2xl bg-mint-soft/60 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-leaf">
                <ThumbsUp className="size-3.5" /> What people love
              </p>
              <p className="text-sm italic text-ink-secondary">
                &ldquo;{intel.highlights[0].text}&rdquo;
              </p>
            </div>
          )}
        </div>

        <div className="rounded-[24px] border border-border bg-card p-5 shadow-sky-sm">
          <h2 className="mb-1 text-lg font-bold text-petrol dark:text-white">Complaint scoreboard</h2>
          <p className="mb-4 text-sm text-ink-muted">% of negative reviews · click a bar to see examples</p>
          {complaints.length ? (
            <div className="space-y-2.5">
              {complaints.map((c) => {
                const active = selected === c.topic;
                return (
                  <button key={c.topic} onClick={() => setSelected(c.topic)} className="group block w-full text-left">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className={cn("font-semibold", active ? "text-petrol dark:text-white" : "text-ink-secondary")}>
                        {titleCase(c.topic)}
                      </span>
                      <span className="font-bold text-ink-secondary">{c.pct}%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full transition-all", active ? "bg-tangerine" : "bg-danger/70 group-hover:bg-danger")}
                        style={{ width: `${(c.pct / maxComplaint) * 100}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-ink-muted">No complaints in scope 🎉</p>
          )}
        </div>
      </div>

      {selected && (
        <div className="mt-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-petrol dark:text-white">
            <Quote className="size-5 text-turquoise" />
            Example reviews · {titleCase(selected)}
          </h2>
          {examples.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {examples.map((ex, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sky-sm"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-bold text-petrol dark:text-white">{ex.author}</span>
                    <span className="inline-flex items-center gap-0.5 text-sm font-bold text-petrol dark:text-white">
                      <Star className="size-3.5 fill-butter text-butter" /> {ex.rating}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-ink-secondary">&ldquo;{ex.text}&rdquo;</p>
                  <p className="mt-2 text-xs text-ink-muted">{ex.date}</p>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-muted">No example reviews for this topic.</p>
          )}
        </div>
      )}

      <div className="mt-8 flex items-start gap-3 rounded-2xl border border-border bg-card/60 p-4 text-sm text-ink-secondary">
        <Info className="mt-0.5 size-4 shrink-0 text-turquoise" />
        <p>
          <span className="font-bold text-petrol dark:text-white">A note on accuracy:</span> the
          sentiment split and complaint ranking come from classifying each review with the LLM (live
          when you re-run, sample otherwise). Counts can drift a little at fuzzy label boundaries
          (e.g. &ldquo;portion&rdquo; vs &ldquo;value&rdquo;) — the Phase-8 lesson that motivates
          evaluation.
        </p>
      </div>
    </div>
  );
}

function SentTile({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <div className={cn("rounded-2xl p-3", bg)}>
      <p className={cn("text-2xl font-extrabold", color)}>{value}</p>
      <p className="text-xs font-semibold text-ink-secondary">{label}</p>
    </div>
  );
}
