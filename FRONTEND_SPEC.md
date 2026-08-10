# FoodPilot — Frontend Screens Spec

Status: **planning** (design not chosen yet). This document defines *what screens
exist and what each one does*, so we can agree on scope before any visual design
or code. No colors, fonts, or layout pixels here — those come after this is
approved.

Scope chosen: **full app, both faces** — a Customer side and an Owner side —
built first as a **static mockup with real project data**, then wired to a
FastAPI backend that calls the existing `app/` chains and agents.

---

## 1. The two faces

FoodPilot is one app with two audiences. A single top-level switch flips between
them.

| Face | Who it's for | The job | Phases it surfaces |
|---|---|---|---|
| **Order** (Customer) | a hungry customer | find food, ask questions, build & confirm an order | 1, 2, 3, 5, 6 |
| **Owner** (Business) | a food-truck owner | understand sales, reviews, and ask questions of the data | 7, 8 |

Everything below is grouped by face. Each screen entry lists: **purpose**, the
**phase** it comes from, the **sections/components** on it, the **data** it shows,
the **interactions**, the **states** (loading / empty / error), and the **future
backend endpoint** it will call once wired.

---

## 2. Global shell (present on every screen)

The frame that wraps all screens.

- **Brand / home** — "FoodPilot" mark, click returns to the default screen of the
  current face.
- **Face switch** — `Order ⇄ Owner`. The single most important control; changes
  the whole nav and content area.
- **Truck context selector** — pick the active food truck (e.g. *Poke Delish*,
  *Dinosaurs*, *Tokachi Musubi*). Customer side uses it to scope menus; Owner side
  uses it to scope every stat. An "All trucks" option exists on the Owner side.
- **Theme toggle** — light / dark.
- **(Future) Account menu** — mock only for now; no real auth in the mockup.

**Cross-cutting behaviors** (apply to every screen, defined once here):
- **Loading / latency** — several actions call a local LLM and are slow
  (Owner Copilot and the review report can take **1–2 minutes**). Every such action
  shows a labeled progress state, never a frozen screen. Streaming where possible.
- **Empty state** — every list/table/chart has a "nothing here yet" version.
- **Error state** — every LLM/DB call has a friendly failure with a retry.
  (e.g. "Ollama isn't running" is a real, likely error — surface it plainly.)
- **Responsive** — usable on phone width; multi-column layouts collapse to one.

---

## 3. Customer face — "Order"

### 3.1 Discover (home)
- **Purpose:** the entry point — a customer says what they want in plain language
  and sees matching trucks/dishes.
- **Phase:** 1 (parse the request) + 2 (retrieve/recommend).
- **Sections / components:**
  - A natural-language search box: *"a cheap vegan lunch near me"*.
  - Parsed-intent chips showing how the request was understood (e.g. `diet: vegan`,
    `price: cheap`, `meal: lunch`) — makes the Phase-1 extraction visible.
  - Results: a grid/list of recommendation cards (truck name, dish, price, why it
    matched, distance/open-now if available).
  - Quick filter row (cuisine, price, open-now, diet).
- **Data shown:** trucks, menu items + prices (real: *Tofu Veggie Bowl $11.50*,
  *Spam Musubi $4.35*, etc.), match reasons.
- **Interactions:** submit query → see parsed chips + results; click a card →
  Truck detail; click a filter → refine.
- **States:** loading (parsing + retrieving), empty ("no matches — try broader"),
  error.
- **Future endpoint:** `POST /parse` → `FoodQuery`; `POST /recommend` → ranked items.

### 3.2 Truck detail / Menu
- **Purpose:** everything about one truck.
- **Phase:** 2 (menu retrieval) + tools from 4/5 (availability, wait, location).
- **Sections / components:**
  - Truck header: name, cuisine, rating, open/closed, location, current wait time.
  - Menu list grouped by section; each item: name, price, tags (veg/vegan/spicy),
    availability, "add" button.
  - "Ask about this truck" shortcut → opens the Concierge chat scoped to this truck.
- **Data shown:** full menu with real prices, modifiers (e.g. *Add avocado +$2*,
  *No onion +$0*), wait time, location.
- **Interactions:** add item → goes to the Order panel; open menu-item modifiers.
- **States:** loading, item-unavailable badge, error.
- **Future endpoint:** `GET /trucks/{id}`, `GET /menu/{truck_id}`,
  `GET /wait/{truck_id}`.

### 3.3 Concierge chat
- **Purpose:** a conversation — the customer asks, the assistant recommends,
  answers follow-ups, and remembers the thread.
- **Phase:** 3 (memory / multi-turn) + 5 (the FEED ME agent, tool use).
- **Sections / components:**
  - Message thread (user + assistant bubbles).
  - Assistant messages can embed **recommendation cards** and **tool results**
    (e.g. "Poke Delish is 5 min away, wait ~10 min").
  - A visible "tools used" affordance per answer (shows which tools the agent
    called — teaching/transparency; optional to keep).
  - Composer with suggestion chips ("cheapest option", "something vegan",
    "build my order").
- **Data shown:** conversational replies grounded in tools; running context.
- **Interactions:** type/send; click a chip; click a card to add to order.
- **States:** assistant "thinking" (tool loop can be slow), error, memory reset.
- **Future endpoint:** `POST /chat` (session_id + message) → streamed reply +
  structured tool events.

### 3.4 Order builder
- **Purpose:** turn a messy multi-part request into a validated, priced order.
- **Phase:** 6 (nested order + condition resolution). **The showcase screen.**
- **Sections / components:**
  - A running **Order panel** (persistent, right side on desktop): line items,
    per-item modifications, per-line price changes, and a live total.
  - Natural-language add: *"3 Spam Musubi, remove onion from 2, add avocado to 1
    only if avocado ≤ $2"* → parsed into structured lines.
  - Per-modification status: **applied / rejected** with a reason
    (e.g. "avocado +$2.00 — applied"; "pineapple — not available on this item").
  - Condition badges (e.g. `price ≤ 2 ✓ met`).
- **Data shown:** the exact Phase-6 trace, priced against real modifier data.
  Example total: `4.35 × 3 + 2.00 = $15.05`.
- **Interactions:** add via text or buttons; edit quantities; remove lines;
  proceed to review.
- **States:** parsing, resolving/pricing, rejected-modifier callouts, empty cart.
- **Future endpoint:** `POST /order/parse-and-resolve` → priced order object.

### 3.5 Order review & confirm (human-in-the-loop)
- **Purpose:** the customer approves before anything is "sent to the kitchen" —
  the explicit pause a pure agent loop lacks.
- **Phase:** 5 (the missing human-in-the-loop pause; motivates LangGraph later).
- **Sections / components:**
  - Full itemized summary (items, mods, subtotal, tax, tip, total).
  - Clear primary action: **"Send to kitchen"** (the irreversible step) + a back/
    edit path.
  - Note explaining the approval gate (why the app pauses here).
- **Data shown:** final priced order.
- **Interactions:** confirm (guarded), edit, cancel.
- **States:** submitting, success → status screen, failure.
- **Future endpoint:** `POST /order/confirm`.

### 3.6 Order confirmation / status
- **Purpose:** post-submit acknowledgment.
- **Phase:** n/a (product completeness).
- **Sections / components:** order number, ETA/wait, truck + pickup location,
  itemized receipt.
- **States:** confirmed, (future) preparing/ready.
- **Future endpoint:** `GET /order/{id}`.

---

## 4. Owner face — "Owner"

### 4.1 Dashboard overview
- **Purpose:** the owner's at-a-glance business health.
- **Phase:** 7 (sales via SQL).
- **Sections / components:**
  - **KPI stat tiles** (hero numbers): Revenue, Orders, Avg Order Value, Avg
    Rating — scoped to the selected truck + date range.
  - **Sales-over-time chart** (revenue by day; single-series magnitude/trend).
  - **Top-selling items** list (by quantity), with revenue.
  - Date-range + truck filters in one row above the content.
- **Data shown (real):** e.g. *Dinosaurs — 5 orders, $147.62, AOV $29.52*;
  aggregate across trucks for "All trucks"; sales-by-day series.
- **Interactions:** change truck/date → all tiles + charts update; hover chart for
  per-day tooltip; click a top item → (future) item detail.
- **States:** loading, empty (no completed orders in range), error.
- **Future endpoint:** `GET /sales?metric=revenue|top_items|sales_by_day&truck&start&end`
  (backed by the whitelisted `sales_stats` tool — parameterized, safe).

### 4.2 Sales analytics (detail)
- **Purpose:** deeper slice of the numbers than the overview.
- **Phase:** 7.
- **Sections / components:**
  - Metric switcher: revenue · order count · AOV · top items · sales by day.
  - Larger chart + a data **table view** of the same numbers (accessibility +
    export-friendly).
  - Comparison (this period vs previous) — optional.
- **Data shown:** whichever metric is selected, per truck/date.
- **Interactions:** switch metric, change range, toggle chart/table.
- **States:** loading, empty, error.
- **Future endpoint:** same `sales_stats`-backed `/sales` endpoint.

### 4.3 Review intelligence
- **Purpose:** turn all reviews into a ranked complaint report — the scoreboard,
  not a search.
- **Phase:** 8 (map-reduce classification + aggregation).
- **Sections / components:**
  - **Sentiment summary** (positive / neutral / negative counts — real:
    102 / 2 / 46).
  - **Complaint scoreboard** — horizontal bars, % of negative reviews, ranked
    (real: portion 23.9%, parking 23.9%, pricing 21.7%, wait_time 17.4%,
    value 15.2%, taste 13.0%, other 4.3%, service 2.2%).
  - **Example reviews** per topic (real quotes, with rating + sentiment).
  - A small honesty note: aggregate numbers can drift at fuzzy label boundaries
    (the Phase 8 lesson) — links conceptually to future evals (Phase 13).
- **Data shown:** classification results + tallies; representative review quotes.
- **Interactions:** click a complaint bar → filter example reviews to that topic;
  re-run report (slow — shows progress); filter by truck.
- **States:** **running** (map-reduce over ~150 reviews, ~1 min — show progress
  and count), empty, partial-failure count, error (Ollama/CreateAI down).
- **Future endpoint:** `POST /reviews/report?truck` → sentiment + ranked complaints
  (backed by `generate_complaint_report`).

### 4.4 Owner Copilot
- **Purpose:** ask the business a question in plain language; get an answer that
  fuses exact numbers (SQL) with review themes (semantic search).
- **Phase:** 7 (heterogeneous tools in one agent).
- **Sections / components:**
  - Ask box + suggested questions ("How did we do this week and what are people
    unhappy about?").
  - Answer area that renders: the **synthesized answer**, plus the **evidence** it
    used — the sales figures and the quoted reviews (grounding made visible).
  - A "tools called" trace (sales_stats + review_search) — optional, teaching value.
- **Data shown:** combined numbers + real review quotes, per the Phase-7 trace.
- **Interactions:** ask; click a suggested question; expand evidence/trace.
- **States:** **thinking** (agent runs both tools — slow, ~1–2 min; show which tool
  is running), error, no-data.
- **Future endpoint:** `POST /copilot` (question + truck) → answer + evidence +
  tool trace (backed by `owner_copilot_agent`).

---

## 5. Screen ↔ phase ↔ endpoint map (quick reference)

| # | Screen | Face | Phase | Future endpoint |
|---|---|---|---|---|
| 3.1 | Discover | Order | 1, 2 | `POST /parse`, `POST /recommend` |
| 3.2 | Truck detail / Menu | Order | 2, 4/5 | `GET /trucks/{id}`, `GET /menu/{id}` |
| 3.3 | Concierge chat | Order | 3, 5 | `POST /chat` |
| 3.4 | Order builder | Order | 6 | `POST /order/parse-and-resolve` |
| 3.5 | Order review & confirm | Order | 5 | `POST /order/confirm` |
| 3.6 | Order confirmation | Order | — | `GET /order/{id}` |
| 4.1 | Dashboard overview | Owner | 7 | `GET /sales` |
| 4.2 | Sales analytics | Owner | 7 | `GET /sales` |
| 4.3 | Review intelligence | Owner | 8 | `POST /reviews/report` |
| 4.4 | Owner Copilot | Owner | 7 | `POST /copilot` |

---

## 6. What's intentionally NOT in the mockup (for now)

- Real authentication / accounts.
- Real payment.
- Live order tracking beyond a static confirmation.
- Writing to the database (everything is read-only + parameterized, per Phase 7).
- Phase 9 (`prep.py`) — it's a backend batch job, not a screen. Could later become
  an Owner "Prep for tomorrow" report card if wanted.

---

## 7. Open questions to settle before design

1. **Priority order** — which screens do we build first? (Suggested showcase set:
   3.4 Order builder + 4.1 Dashboard + 4.3 Review intelligence + 4.4 Copilot.)
2. **Concierge vs Discover** — one combined conversational screen, or keep search
   and chat separate?
3. **Depth of the "tools/trace" teaching affordances** — show them (great for a
   learning/portfolio piece) or hide them (cleaner product)?
4. **Single-page mockup vs multi-page** — one `web/` app that switches views, or
   separate pages per screen.

---

*Next step: you review this list, cut/add screens, answer §7, then we pick the
visual design — and only then build.*
