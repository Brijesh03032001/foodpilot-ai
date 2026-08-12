import { overall, getTruck, trucks } from "./data";
import { money, titleCase } from "./format";
import type { Sales, ReviewIntel } from "./types";
import type { ToolCall } from "./concierge";

export interface CopilotEvidence {
  kind: "sales" | "review";
  label: string;
  value?: string;
  quote?: string;
  meta?: string;
}

export interface CopilotAnswer {
  answer: string;
  tools: ToolCall[];
  evidence: CopilotEvidence[];
}

function scope(truckId: string | null): {
  name: string;
  sales: Sales;
  intel: ReviewIntel;
  rating: number | null;
} {
  if (truckId) {
    const t = getTruck(truckId);
    if (t)
      return {
        name: t.name,
        sales: t.sales,
        intel: t.review_intel,
        rating: t.avg_rating_reviews ?? t.rating,
      };
  }
  return {
    name: "all trucks",
    sales: overall.sales,
    intel: overall.review_intel,
    rating: overall.avg_rating_reviews,
  };
}

/**
 * Owner Copilot (Phase-7 stand-in): fuses exact numbers (SQL/sales_stats) with
 * review themes (semantic review_search) into one grounded answer + evidence.
 */
export function copilotAnswer(question: string, truckId: string | null): CopilotAnswer {
  const q = question.toLowerCase();
  const s = scope(truckId);
  const tools: ToolCall[] = [];
  const evidence: CopilotEvidence[] = [];

  const wantsSales = /sale|revenue|money|earn|order|aov|average|number|how did|perform|week|best|top/.test(q);
  const wantsReviews = /review|unhappy|complain|happy|sentiment|feedback|problem|wrong|love|hate|why/.test(q);

  // Always ground with the headline sales when relevant (default yes)
  if (wantsSales || (!wantsSales && !wantsReviews)) {
    tools.push({
      name: "sales_stats",
      detail: `revenue + orders + AOV · ${s.name}`,
    });
    evidence.push(
      { kind: "sales", label: "Revenue", value: money(s.sales.revenue), meta: `${s.sales.orders} completed orders` },
      { kind: "sales", label: "Avg order value", value: money(s.sales.aov) },
    );
    if (s.sales.top_items[0])
      evidence.push({
        kind: "sales",
        label: "Top seller",
        value: s.sales.top_items[0].name,
        meta: `${s.sales.top_items[0].qty} sold · ${money(s.sales.top_items[0].revenue)}`,
      });
  }

  if (wantsReviews || (!wantsSales && !wantsReviews)) {
    tools.push({
      name: "review_search",
      detail: `semantic search over ${s.intel.total} reviews · ${s.name}`,
    });
    const topComplaint = s.intel.complaints[0];
    if (topComplaint) {
      const ex = s.intel.examples[topComplaint.topic]?.[0];
      evidence.push({
        kind: "review",
        label: `Top complaint · ${titleCase(topComplaint.topic)}`,
        value: `${topComplaint.pct}% of negative reviews`,
        quote: ex?.text,
        meta: ex ? `★${ex.rating} · ${ex.author}` : undefined,
      });
    }
    const hi = s.intel.highlights[0];
    if (hi)
      evidence.push({
        kind: "review",
        label: "What people love",
        quote: hi.text,
        meta: `★${hi.rating} · ${hi.author}`,
      });
  }

  // Compose the synthesized answer
  const pos = s.intel.counts.positive;
  const neg = s.intel.counts.negative;
  const totalR = s.intel.total || pos + neg;
  const posPct = totalR ? Math.round((100 * pos) / totalR) : 0;
  const top = s.intel.complaints[0];
  const top2 = s.intel.complaints[1];

  const salesLine = `Across ${s.name === "all trucks" ? "all your trucks" : s.name}, you booked **${money(s.sales.revenue)}** on **${s.sales.orders}** completed orders (AOV **${money(s.sales.aov)}**)${s.sales.top_items[0] ? `, led by **${s.sales.top_items[0].name}** (${s.sales.top_items[0].qty} sold)` : ""}.`;
  const reviewLine = `Sentiment is **${posPct}% positive** (${pos} positive vs ${neg} negative)${top ? `. The biggest pain point is **${titleCase(top.topic)}** (${top.pct}% of negatives)${top2 ? `, then **${titleCase(top2.topic)}** (${top2.pct}%)` : ""}` : ""}.`;
  const action = top
    ? ` If you fix one thing this week, tackle **${titleCase(top.topic)}** — it's your most common complaint and likely the cheapest win.`
    : "";

  let answer = "";
  if (wantsSales && !wantsReviews) answer = salesLine;
  else if (wantsReviews && !wantsSales) answer = reviewLine + action;
  else answer = `${salesLine}\n\n${reviewLine}${action}`;

  return { answer, tools, evidence };
}

export const COPILOT_SUGGESTIONS = [
  "How did we do this week and what are people unhappy about?",
  "What's our top-selling item?",
  "Why are customers leaving negative reviews?",
  "Summarize revenue and sentiment.",
];
