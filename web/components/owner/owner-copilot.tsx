"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Sparkles, Send, Database, MessageSquareText, Wrench, TrendingUp } from "lucide-react";
import { useStore } from "@/lib/store";
import { scopeData } from "@/lib/data";
import { copilotAnswer, COPILOT_SUGGESTIONS, type CopilotAnswer, type CopilotEvidence } from "@/lib/copilot";
import { api, type ApiCopilot, type ApiToolCall } from "@/lib/api";
import { money, titleCase } from "@/lib/format";
import { OwnerHeader } from "./owner-header";
import { Mascot } from "@/components/bits/mascot";
import { Thinking } from "@/components/bits/thinking";
import { SourceBadge } from "@/components/bits/source-badge";
import type { Source } from "@/lib/use-sales";
import { cn } from "@/lib/utils";

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, li) => (
        <p key={li} className={li > 0 ? "mt-2.5" : ""}>
          {line.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
            p.startsWith("**") && p.endsWith("**") ? (
              <strong key={i} className="font-bold text-petrol dark:text-white">
                {p.slice(2, -2)}
              </strong>
            ) : (
              <span key={i}>{p}</span>
            ),
          )}
        </p>
      ))}
    </>
  );
}

/** Map the live agent's tool trace into the same answer/evidence shape the mock uses. */
function apiToCopilot(resp: ApiCopilot): CopilotAnswer {
  const tools = resp.trace.map((t: ApiToolCall) => {
    const a = t.args as Record<string, unknown>;
    const detail =
      (a.metric as string) ??
      (a.topic as string) ??
      Object.values(a).filter(Boolean).join(" ") ??
      "";
    return { name: t.name, detail: String(detail) };
  });

  const evidence: CopilotEvidence[] = [];
  for (const t of resp.trace) {
    if (t.name === "sales_stats" && t.result && typeof t.result === "object") {
      const rows = (t.result as { rows?: Record<string, unknown>[] }).rows ?? [];
      const r0 = rows[0] ?? {};
      if ("revenue" in r0) {
        evidence.push({
          kind: "sales",
          label: "Revenue",
          value: money(Number(r0.revenue) || 0),
          meta: r0.orders != null ? `${r0.orders} orders` : undefined,
        });
      } else if ("name" in r0 && "qty" in r0) {
        evidence.push({
          kind: "sales",
          label: "Top seller",
          value: String(r0.name),
          meta: `${r0.qty} sold`,
        });
      }
    } else if (t.name === "review_search" && Array.isArray(t.result)) {
      const rev = (t.result as Array<Record<string, unknown>>)[0];
      if (rev) {
        evidence.push({
          kind: "review",
          label: `Review · ${String((t.args as Record<string, unknown>).topic ?? "")}`.trim(),
          quote: String(rev.text ?? ""),
          meta: `★${rev.rating ?? ""} · ${rev.sentiment ?? ""}`,
        });
      }
    }
  }

  return { answer: resp.answer || "…", tools, evidence };
}

interface Turn {
  id: string;
  question: string;
  answer?: CopilotAnswer;
  phase: "thinking" | "done";
  source: Source;
}

export function OwnerCopilot() {
  const { activeTruckId } = useStore();
  const scope = useMemo(() => scopeData(activeTruckId), [activeTruckId]);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    setBusy(true);
    setInput("");
    const id = uid();
    setTurns((t) => [...t, { id, question, phase: "thinking", source: "live" }]);

    try {
      const resp = await api.copilot(question, activeTruckId);
      const answer = apiToCopilot(resp);
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, phase: "done", answer, source: "live" } : x)));
    } catch {
      const answer = copilotAnswer(question, activeTruckId);
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, phase: "done", answer, source: "mock" } : x)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-container py-8">
      <OwnerHeader
        title="Owner Copilot"
        subtitle={`Ask your business anything · fuses SQL numbers with review themes · ${scope.name}`}
      />

      {turns.length === 0 && (
        <div className="mb-6 rounded-[24px] border border-turquoise/20 bg-blue-soft/50 p-6">
          <div className="flex items-start gap-4">
            <Mascot size={56} />
            <div>
              <h2 className="text-lg font-bold text-petrol dark:text-white">
                Hi! I&apos;m your Owner Copilot.
              </h2>
              <p className="mt-1 max-w-xl text-sm text-ink-secondary">
                Ask a question in plain language. I run the right tools —{" "}
                <span className="font-semibold text-petrol dark:text-white">sales_stats</span> for exact
                numbers and{" "}
                <span className="font-semibold text-petrol dark:text-white">review_search</span> for
                what customers say — then combine them into one grounded answer. The live agent runs a
                local reasoning model, so a real answer can take 1–2 minutes.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {turns.map((turn) => (
          <div key={turn.id} className="space-y-3">
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-[18px] rounded-br-[5px] bg-petrol px-4 py-2.5 font-medium text-white">
                {turn.question}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mascot size={36} float={false} />
              <div className="min-w-0 flex-1">
                {turn.phase === "thinking" ? (
                  <div className="rounded-[18px] rounded-bl-[5px] border border-border bg-card px-4 py-3 shadow-sky-sm">
                    <Thinking label="Running tools (sales_stats + review_search)… this can take 1–2 min" />
                  </div>
                ) : (
                  turn.answer && <AnswerBlock answer={turn.answer} source={turn.source} />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {COPILOT_SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => ask(s)}
            disabled={busy}
            className="rounded-full border border-border bg-white px-3.5 py-2 text-sm font-semibold text-ink-secondary transition hover:border-turquoise hover:text-petrol disabled:opacity-50 dark:bg-white/5"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-card p-2 pl-4 shadow-sky-sm focus-within:border-turquoise focus-within:ring-4 focus-within:ring-turquoise/12"
      >
        <Sparkles className="size-5 shrink-0 text-turquoise" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about sales, reviews, or both…"
          className="h-10 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="grid size-10 place-items-center rounded-xl bg-petrol text-white transition hover:bg-petrol-deep disabled:opacity-50"
          aria-label="Ask"
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}

const TOOL_ICON: Record<string, typeof Database> = {
  sales_stats: Database,
  review_search: MessageSquareText,
};

function AnswerBlock({ answer, source }: { answer: CopilotAnswer; source: Source }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      {answer.tools.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {answer.tools.map((t, i) => {
            const Icon = TOOL_ICON[t.name] ?? Wrench;
            return (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full bg-mint-soft px-3 py-1.5 text-xs font-semibold text-leaf"
              >
                <Icon className="size-3.5" />
                {t.name}
                {t.detail && <span className="opacity-70">· {t.detail}</span>}
                <span className="ml-0.5">✓</span>
              </span>
            );
          })}
          <SourceBadge source={source} liveLabel="Live · LangGraph agent" className="ml-auto" />
        </div>
      )}

      <div className="rounded-[18px] rounded-bl-[5px] border border-border bg-card px-4 py-3.5 text-[15px] leading-relaxed text-ink shadow-sky-sm dark:text-white/90">
        <Rich text={answer.answer} />
      </div>

      {answer.evidence.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
            <TrendingUp className="size-3.5 text-turquoise" /> Evidence
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {answer.evidence.map((ev, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-2xl border p-4 shadow-sky-sm",
                  ev.kind === "sales" ? "border-turquoise/20 bg-blue-soft/40" : "border-border bg-card",
                )}
              >
                <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{ev.label}</p>
                {ev.value && (
                  <p className="mt-1 text-lg font-extrabold text-petrol dark:text-white">{ev.value}</p>
                )}
                {ev.quote && (
                  <p className="mt-1 text-sm italic leading-relaxed text-ink-secondary">
                    &ldquo;{ev.quote}&rdquo;
                  </p>
                )}
                {ev.meta && <p className="mt-1.5 text-xs text-ink-muted">{ev.meta}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
