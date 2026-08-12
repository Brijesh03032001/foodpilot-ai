"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Send, Wrench, ArrowRight, Star } from "lucide-react";
import { conciergeReply, CONCIERGE_SUGGESTIONS, type ToolCall } from "@/lib/concierge";
import { api, type ApiRecommendation } from "@/lib/api";
import { cuisineEmoji } from "@/lib/data";
import { titleCase } from "@/lib/format";
import { MapPin, Clock } from "lucide-react";
import type { Recommendation } from "@/lib/query-parser";
import { Mascot } from "@/components/bits/mascot";
import { Thinking } from "@/components/bits/thinking";
import { TruckPhoto } from "@/components/bits/truck-photo";
import { cn } from "@/lib/utils";

interface Msg {
  id: string;
  role: "user" | "ai";
  text?: string;
  tools?: ToolCall[];
  recommendations?: Recommendation[];
  recommendation?: ApiRecommendation | null;
  cta?: { label: string; href: string };
  pending?: boolean;
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

/** Render **bold** segments; everything else is plain text. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} className="font-bold">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{p.replace(/\*(.+?)\*/g, "$1")}</span>
        ),
      )}
    </>
  );
}

export function Concierge() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "welcome",
      role: "ai",
      text: "Hi! I'm your FoodPilot concierge 🤖 Tell me what you're craving — try a cheap vegan lunch, spicy tacos under $10, or ask what's the cheapest option. I can check wait times and build your order too.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    const pendingId = uid();
    setMessages((m) => [
      ...m,
      { id: uid(), role: "user", text: q },
      { id: pendingId, role: "ai", pending: true },
    ]);
    setInput("");

    try {
      // real FEED ME agent via the gateway (local reasoning model, can be slow)
      const r = await api.chat(q);
      const tools: ToolCall[] = r.trace.map((t) => {
        const a = t.args as Record<string, unknown>;
        const detail = String(
          a.cuisine ?? a.truck_id ?? a.topic ?? Object.values(a).filter(Boolean)[0] ?? "",
        );
        return { name: t.name, detail };
      });
      setMessages((m) =>
        m.map((msg) =>
          msg.id === pendingId
            ? { id: msg.id, role: "ai", text: r.reply, tools, recommendation: r.recommendation }
            : msg,
        ),
      );
    } catch {
      const reply = conciergeReply(q);
      setMessages((m) =>
        m.map((msg) =>
          msg.id === pendingId
            ? {
                id: msg.id,
                role: "ai",
                text: reply.text,
                tools: reply.tools,
                recommendations: reply.recommendations,
                cta: reply.cta,
              }
            : msg,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-container flex h-[calc(100dvh-4rem)] flex-col py-4 md:h-[calc(100dvh-4rem)]">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <Mascot size={48} />
        <div>
          <h1 className="text-lg font-bold text-petrol dark:text-white">FoodPilot Concierge</h1>
          <p className="flex items-center gap-1.5 text-xs text-ink-secondary">
            <span className="size-1.5 rounded-full bg-leaf" /> Online · grounded in live tools
          </p>
        </div>
      </div>

      {/* thread */}
      <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto py-5">
        {messages.map((m) => (
          <MessageBubble key={m.id} msg={m} onPick={send} />
        ))}
      </div>

      {/* composer */}
      <div className="border-t border-border pt-3">
        <div className="mb-2.5 flex flex-wrap gap-2">
          {CONCIERGE_SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={busy}
              className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold text-ink-secondary transition hover:border-turquoise hover:text-petrol disabled:opacity-50 dark:bg-white/5"
            >
              {s}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2 pl-4 shadow-sky-sm focus-within:border-turquoise focus-within:ring-4 focus-within:ring-turquoise/12"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about food near you…"
            className="h-10 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="grid size-10 place-items-center rounded-xl bg-tangerine text-white shadow-tangerine transition hover:bg-tangerine-hover disabled:opacity-50"
            aria-label="Send"
          >
            <Send className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({ msg, onPick }: { msg: Msg; onPick: (t: string) => void }) {
  if (msg.role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end"
      >
        <div className="max-w-[80%] rounded-[18px] rounded-br-[5px] bg-petrol px-4 py-2.5 text-[15px] text-white shadow-sky-sm">
          {msg.text}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2.5"
    >
      <div className="mt-1 shrink-0">
        <Mascot size={32} float={false} />
      </div>
      <div className="max-w-[85%] space-y-2.5">
        {msg.pending ? (
          <div className="rounded-[18px] rounded-bl-[5px] border border-border bg-card px-4 py-3 shadow-sky-sm">
            <Thinking label="Thinking · running tools…" />
          </div>
        ) : (
          <>
            {msg.tools && msg.tools.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {msg.tools.map((t, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-full bg-blue-soft px-2.5 py-1 text-[11px] font-semibold text-ink-secondary dark:bg-turquoise/15"
                  >
                    <Wrench className="size-3 text-turquoise" />
                    <span className="font-bold text-petrol dark:text-white">{t.name}</span>
                    <span className="opacity-70">· {t.detail}</span>
                  </span>
                ))}
              </div>
            )}
            {msg.recommendation ? (
              <>
                <ConciergeRecCard reco={msg.recommendation} />
                {msg.text && (
                  <div className="rounded-2xl bg-[#F7FBFB] px-4 py-2.5 text-sm leading-relaxed text-ink-secondary dark:bg-white/5">
                    <RichText text={msg.text} />
                  </div>
                )}
              </>
            ) : (
              msg.text && (
                <div className="rounded-[18px] rounded-bl-[5px] border border-border bg-card px-4 py-3 text-[15px] leading-relaxed text-ink shadow-sky-sm dark:text-white/90">
                  <RichText text={msg.text} />
                </div>
              )
            )}
            {msg.recommendations && msg.recommendations.length > 0 && (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {msg.recommendations.map((r) => (
                  <ChatTruckCard key={r.truck.id} rec={r} />
                ))}
              </div>
            )}
            {msg.cta && (
              <Link
                href={msg.cta.href}
                className="inline-flex items-center gap-1.5 rounded-xl bg-tangerine px-4 py-2 text-sm font-bold text-white shadow-tangerine transition hover:bg-tangerine-hover"
              >
                {msg.cta.label} <ArrowRight className="size-4" />
              </Link>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

function ConciergeRecCard({ reco }: { reco: ApiRecommendation }) {
  const emoji = cuisineEmoji[reco.cuisines?.[0] ?? ""] ?? "🍽️";
  return (
    <Link
      href={`/trucks/${reco.truckId}`}
      className="group block overflow-hidden rounded-2xl border border-border bg-card shadow-sky-sm transition hover:-translate-y-0.5 hover:shadow-sky-md"
    >
      <div className="flex items-center gap-3 p-3">
        <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-orange-soft to-blue-soft text-3xl">
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-bold text-petrol dark:text-white">
              {reco.truckName ?? "Recommended truck"}
            </p>
            {reco.rating != null && (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-sm font-bold text-petrol dark:text-white">
                <Star className="size-3.5 fill-butter text-butter" />
                {reco.rating.toFixed(1)}
              </span>
            )}
          </div>
          {reco.cuisines?.length > 0 && (
            <p className="truncate text-xs text-ink-secondary">
              {reco.cuisines.map(titleCase).join(" · ")}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-muted">
            {reco.waitMin != null && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3 text-turquoise" />~{reco.waitMin} min
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3 text-turquoise" /> pickup
            </span>
          </div>
        </div>
      </div>

      {reco.itemName && (
        <div className="mx-3 mb-3 flex items-center justify-between gap-2 rounded-xl bg-[#F7FBFB] px-3 py-2 dark:bg-white/5">
          <span className="min-w-0 truncate text-sm text-ink-secondary">
            🍴 {reco.itemName}
            {reco.protein ? ` · ${reco.protein}g protein` : ""}
          </span>
          {reco.price != null && (
            <span className="shrink-0 font-extrabold text-petrol dark:text-white">
              ${reco.price.toFixed(2)}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-center gap-1.5 border-t border-border bg-tangerine/[0.06] py-2.5 text-sm font-bold text-tangerine transition group-hover:bg-tangerine group-hover:text-white">
        View truck &amp; order <ArrowRight className="size-4" />
      </div>
    </Link>
  );
}

function ChatTruckCard({ rec }: { rec: Recommendation }) {
  const { truck, reason } = rec;
  return (
    <Link
      href={`/trucks/${truck.id}`}
      className="group flex gap-3 overflow-hidden rounded-2xl border border-border bg-card p-2.5 shadow-sky-sm transition hover:shadow-sky-md"
    >
      <TruckPhoto truck={truck} className="size-16 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-bold text-petrol dark:text-white">{truck.name}</p>
          <span className="inline-flex items-center gap-0.5 text-xs font-bold text-petrol dark:text-white">
            <Star className="size-3 fill-butter text-butter" />
            {truck.rating?.toFixed(1)}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-ink-secondary">{reason}</p>
      </div>
    </Link>
  );
}
