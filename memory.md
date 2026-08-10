# FoodPilot AI — Progress Log

Running record of what's been built, decided, and learned. Read `FoodPilot_Master_Spec.md` first for the full spec/curriculum — this file tracks *actual progress against it*. Beyond the Phase 1–9 LangChain curriculum it now also logs the **product build**: the Sky Market frontend (`web/`) and the microservices integration (`gateway/` Java + `ai_service/` Python) — see `INTEGRATION.md` and the two sections after Phase 9.

---

## Environment

- **Virtualenv:** `cuisine/` (not `.venv` — deliberately named this). Activate with `source cuisine/bin/activate`, or call binaries directly (`./cuisine/bin/python ...`) since this shell has `python`/`pip` aliased to Homebrew's global install, which silently bypasses `source activate`.
- **Dependencies:** `requirements.txt` — `langchain`, `langchain-community`, `langchain-ollama`, `langgraph`, `pydantic`, `chromadb`, `python-dotenv`, `httpx`, plus `fastapi`, `uvicorn` (the AI microservice). Installed versions: `langchain 1.3.14`, `langgraph 1.2.10`.
- **`.env`:** holds `CREATEAI_ACCESS_TOKEN` and `CREATEAI_QUERY_URL` (ASU CreateAI credentials). `.gitignore` added so this never gets committed once the project becomes a git repo.
- **Local model:** Ollama installed, `qwen3:4b` (agents/tool-calling), `llama3`/`llama3.2`, `bge-m3` (review embeddings) pulled. Ollama server runs on `localhost:11434` — **must be running** for the copilot agent + `review_search`.
- **Services (product build):** Python AI service `ai_service/` :8000, Java Spring Boot gateway `gateway/` :8080 (needs Java 17+; `openjdk@21` via Homebrew), Next.js `web/` :3000. Node for the frontend.

## Data layer (already done before this session started)

`data/` already has all entities generated across Tiers 1–3 of the schema — trucks, menu_items, modifiers/modifier_groups, ingredients, recipes, stock, orders/order_items/order_item_mods, reviews, customers, owners, suppliers — via `generate_data.py`, `backfill_fields.py`, `enrich_descriptions.py`. Real Yelp SF truck data (`foodtrucks-sf.json`) is the base; menus/etc. are generated but cuisine-matched. This is well ahead of where the spec expects data to exist at Phase 1 — no data work needed for Phases 1–9 unless something's missing when a phase actually needs it.

## Phase 1 — Chat models + LCEL + structured output — ✅ DONE

**Goal:** turn `"I want spicy vegetarian food under $15"` into a validated `FoodQuery` Pydantic object.

**Files built:**

| File | Purpose |
|---|---|
| `app/schemas.py` | `FoodQuery` Pydantic model (diet, spice_level, max_price, cuisine, max_wait_min, min_protein_g) |
| `app/llm.py` | `get_model()` — factory for `ChatOllama(model="llama3")` |
| `app/createai_llm.py` | `ChatCreateAI(BaseChatModel)` — custom LangChain chat model wrapping ASU CreateAI's `/query` REST endpoint (no LangChain-shipped integration exists for it, so it's hand-written); `get_createai_model()` factory |
| `app/prompts.py` | `INTENT_EXTRACTION_PROMPT` (for models with native structured output) and `INTENT_EXTRACTION_PROMPT_TEXT_ONLY` (has a `{format_instructions}` slot, for models without it) |
| `app/chains.py` | Two parallel chains — see below — plus `parse_chain` = whichever is active |
| `main.py` | Terminal REPL: read a line, run through `parse_chain`, print `FoodQuery` as JSON |

**Two structured-output paths, built side by side on purpose:**

1. **`ollama_parse_chain`** — `INTENT_EXTRACTION_PROMPT | model.with_structured_output(FoodQuery)`. Works because Ollama models support tool-calling; LangChain binds the `FoodQuery` schema as a tool and parses the model's tool-call arguments into the object directly.
2. **`createai_parse_chain`** — `prompt_with_format_instructions | ChatCreateAI | PydanticOutputParser(FoodQuery)`. CreateAI's endpoint is plain text-in/text-out with no tool-calling, so the schema is spelled out as text inside the prompt (`PydanticOutputParser.get_format_instructions()`), and the parser at the *end* of the chain turns the model's raw text reply into a validated object. This is what `with_structured_output` does under the hood for models that can't do native tool-calling.

**Test results (same 5 phrasings through both):**

- `llama3` (local, 8B): got the right *shape* every time (valid `FoodQuery`, no crash) but frequently wrong *content* — e.g. put "vegetarian" in the `cuisine` field instead of `diet`, dropped `max_price` to `null` when a price was clearly stated.
- CreateAI (ASU-hosted, managed): correct on **every field, every test**. Clearly a stronger backing model.

**Decision:** `parse_chain` in `app/chains.py` defaults to `createai_parse_chain`. `ollama_parse_chain` is left in place for future comparison — just repoint `parse_chain` to switch.

**Key lesson learned (Phase 1 checkpoint, answered for real):** `with_structured_output` / `PydanticOutputParser` guarantee the *shape* of the output (types, field presence) is correct — they cannot guarantee the *content* is semantically correct. That's a model-capability problem sitting on top of a framework guarantee, and the two are worth telling apart.

## Phase 2 — Retrievers (RAG) — ✅ DONE

**Goal:** given a `FoodQuery`, return matching menu items with reasoning, using semantic search (embeddings) + metadata filtering together.

**Embedding model decision:** `bge-m3` via Ollama (`ollama pull bge-m3`, 1.2GB, 1024-dim vectors). Chosen over `nomic-embed-text` for higher accuracy (user's call — willing to pay the extra size/speed cost). CreateAI has no embeddings endpoint (only `/query` text completion), so it's out for this phase.

**Data fix — cuisine backfill (`backfill_cuisines.py`):** 15/107 trucks had an empty `cuisines` list in the Yelp scrape (e.g. "Spark Social SF", a food-court venue). Wrote a standalone script that assigns each 1-2 random cuisines from the same 47-word vocabulary `generate_data.py`'s `MENUS` dict uses (copied the key list directly rather than importing `generate_data.py`, which has no `__main__` guard and would re-run the entire data pipeline on import, overwriting everything). Backup of pre-backfill trucks saved as `data/trucks.backup.json`. Seed 42, matching `generate_data.py`'s convention. All 107 trucks now have non-empty `cuisines`. Note: menu items for these 15 trucks were generated using the GENERIC fallback menu (since their cuisine was empty at generation time) — their menu contents don't necessarily match the newly-assigned cuisine label. Acceptable for RAG-mechanics learning purposes; would need a menu regeneration pass to fully reconcile if that ever matters.

**Real data quirks handled in `app/retrievers.py`:**
1. `cuisines` lives on `FoodTruck`, not `MenuItem` — denormalized truck cuisines into each menu item's Document (both page_content and metadata) at index time.
2. `FoodQuery.spice_level` uses `mild/medium/spicy`; `MenuItem.spice_level` uses `mild/medium/hot/none` — explicit mapping dict (`SPICE_LEVEL_QUERY_TO_ITEM`) translates `"spicy"` → `"hot"` when building filters.
3. Chroma metadata values must be scalar (str/int/float/bool), no lists — `dietary_tags` (a list) gets flattened into booleans (`is_vegetarian`, `is_vegan`, `is_gluten_free`) at index time instead of stored as-is.

**Files:** `app/retrievers.py` — `build_menu_vectorstore()` (embeds all 635 menu items into a persisted Chroma store at `chroma_db/menu_items/`, ~20s to build), `build_metadata_filter(FoodQuery)` (translates a FoodQuery into a Chroma `where` clause), `get_menu_retriever(query, k)`. `app/chains.py` — `recommend_chain` / `recommend(text)`: full pipeline `text -> parse_chain -> FoodQuery -> retriever (semantic search + metadata filter) -> Documents -> RECOMMEND_PROMPT -> CreateAI model -> grounded answer`. Uses `RunnableLambda` since the retriever's filter depends on the per-request FoodQuery (can't be a static `|` pipe).

**Design note (the actual Phase 2 lesson):** `cuisine` is deliberately NOT a hard metadata filter — it's left to semantic search only, since it's a fuzzy/loose concept ("Asian" spans many cuisine tags). Diet, spice_level, price, and protein ARE hard metadata filters since they're exact constraints. Tested both ends: a narrow query (`"no meat, spicy Asian food, under $20"`) correctly returned only 1 real match (verified against raw data — genuinely only 1 item in the whole 635-item dataset satisfies vegetarian+hot+≤$20+available), and a broader query (`"vegetarian food, mild spice, under $12"`) returned 5, all correct.

**Milestone: met.** Full text-to-grounded-answer pipeline tested and working.

## Phase 3 — Message history / memory — ✅ DONE

**Goal:** a multi-turn concierge that remembers constraints stated across earlier turns (e.g. "healthy" → "no beef" → "under $15" → give a recommendation using all three).

**Files:** `app/memory.py` — `get_session_history(session_id)`, an in-RAM dict of `session_id -> InMemoryChatMessageHistory`. `app/prompts.py` — `CONVERSATION_PROMPT` (system instruction + `MessagesPlaceholder("chat_history")` + `{input}`). `app/chains.py` — `conversational_concierge = RunnableWithMessageHistory(CONVERSATION_PROMPT | createai_model, get_session_history, input_messages_key="input", history_messages_key="chat_history")`.

**Tested:** a real 4-turn conversation (healthy → no beef → under $15 → "what do you recommend?") — model correctly summarized and applied all 3 accumulated constraints on the final turn. Also confirmed session isolation: a different `session_id` has zero memory of another session's conversation.

**Deliberate scope limit:** this chain does NOT call the Phase 2 retriever — its recommendation is generic ("grilled chicken salad"), not grounded in the real 635-item menu data. Phase 3 is scoped to memory mechanics only, per the spec; wiring memory + retrieval + tools together is what Phase 4/5 (and eventually the agent) does.

**Real thing observed that the spec itself predicts:** `RunnableWithMessageHistory` throws a `LangChainDeprecationWarning` — LangChain's own docs now say "use LangGraph's built-in persistence instead." This is Section 3 of the master spec ("you will *feel* LangChain stop being enough") showing up in real tooling, one phase early — a live signal, not just a narrative beat.

## Phase 4 — Tool binding + manual tool loop — ✅ DONE
## Phase 5 — FEED ME agent + its ceiling — ✅ DONE

**Model switch (important):** CreateAI CANNOT tool-call (our `ChatCreateAI` wrapper is text-in/text-out, no `bind_tools`). Plain `llama3` also can't (`"does not support tools"`, HTTP 400 from Ollama). Phase 4-5 tool model = **`qwen3:4b`** via `get_tool_model()` in `app/llm.py`, `num_ctx=16384`, `run_feed_me` uses `recursion_limit=30`. So the project now uses THREE models: CreateAI (structured extraction, Phase 1), bge-m3 (embeddings, Phase 2), qwen3:4b (tool calling, Phase 4-5).

**Tool-model journey (why qwen3:4b):** first tried `llama3.2` (3B) — emits tool_calls but reliably hallucinated the chain (called first tool, invented the rest). Upgraded to `qwen3:4b` (a reasoning/"thinking" model). It chains ALL tools correctly — both previously-failing FEED ME queries now complete the full search→menu→availability→wait→build_order_draft flow with real (non-hallucinated) data and an approval prompt. Cost: it's SLOW (~4 min/FEED ME run on this hardware) and verbose (huge hidden `<think>` blocks; default 4096 ctx overflowed mid-run → bumped num_ctx). User chose thinking ON knowing the speed cost. `llama3.2` still pulled if a fast-but-dumb comparison is ever wanted. NOTE: `create_react_agent` now warns it moved to `langchain.agents.create_agent` (LangGraph V1 deprecation) — still works for now, revisit at Phase 10+.

**Files:** `app/tools.py` — 8 `@tool`s over real JSON data: `search_food_trucks`, `get_menu`, `check_item_availability`, `get_truck_location` (open-now via operating_hours since Schedule deferred), `check_wait_time` (current_queue_min + avg_prep_time_min), `calculate_order_total`, plus Phase 5's `rank_meals` and `build_order_draft`. Tool lists `PHASE4_TOOLS` / `PHASE5_TOOLS`. `app/agent.py` — `run_manual_tool_loop()` (Phase 4, hand-written invoke→tool_calls→ToolMessage→repeat loop with max_steps guard) and `feed_me_agent = create_react_agent(get_tool_model(), PHASE5_TOOLS, prompt=...)` + `run_feed_me()` (Phase 5). `main.py` — now a command menu: parse | recommend | tools | feedme | quit.

**Milestone deliverable:** `LOOP_LIMITATIONS.md` — the "what the loop does badly" list (Phase 5's real payoff, the LangGraph to-do). Repeatable finding: llama3.2 3B reliably calls the FIRST tool correctly then HALLUCINATES the rest instead of continuing the chain (invented wait times, invented menu items, recommended Chipotle/Taco Bell not in our data). Tools themselves proven correct + composable when driven deterministically (search→menu→rank→draft yields real KoJa Kitchen order, Bulgogi Beef Bowl 32g, $13.98). So: failures 1-4 are model-capability (3B), failures 5-9 are structural (no forced tool order, no approval pause, no branch/loop, no persistence, implicit untyped state) — these map onto what LangGraph fixes in Phases 10-11.

## Phase 6 — Structured output under pressure — ✅ DONE

**Goal:** parse a messy multi-part order (`"3 Spam Musubi, remove onion from 2, add avocado to 1 only if avocado ≤ $2"`) into a validated NESTED order, then verify + price every modification against real modifier data. The production principle: **LLM = language, tools = truth.**

**Files built/edited:**

| File | What |
|---|---|
| `app/schemas.py` | `Modification` (quantity, add[], remove[], condition:str\|None) and `OrderDraftItem` (item, quantity, modifications: list[Modification]) — nested Pydantic. `condition` is captured as TEXT, never evaluated by the model. |
| `app/tools.py` | Loads `modifier_groups.json` + `modifiers.json` (chain: menu_item -< modifier_group -< modifiers, each with `action` + `price_delta`). `resolve_modifications(item_id, modifications)` @tool = the truth layer: matches each add/remove to a real modifier, reads real `price_delta`, evaluates any `condition` safely, returns applied/rejected + total. `_eval_condition` handles both `price <= 2` and natural phrasings (`"$2 or less"`, `"under $3"`) via a phrase→operator map — deliberately NOT `eval()` (safe regex only). `find_menu_item_id(name)` plumbing (parsed name → id). `PHASE6_TOOLS`. |
| `app/prompts.py` | `ORDER_PARSE_PROMPT` — text-only path with `{format_instructions}`; system message explicitly forbids the model from deciding conditions. |
| `app/chains.py` | `order_parse_chain = ORDER_PARSE_PROMPT.partial(format_instructions=...) \| createai_model \| PydanticOutputParser(OrderDraftItem)`. `parse_and_resolve_order(text)` = full pipeline (parse → name→id → resolve). |

**Model path:** reused CreateAI + `PydanticOutputParser` (text-only path, Phase 1 Path B) — CreateAI can't tool-call so `.with_structured_output` is out, but the parser path handles the NESTED schema fine via format_instructions. (Native alternative if ever wanted: `qwen3:4b.with_structured_output(OrderDraftItem)`.)

**Tested (real data, item `mi-0010` Spam Musubi $4.35; real modifiers: Add avocado +$2.0, No onion +$0.0):**
- Condition met (`avocado ≤ $2`, real 2.0) → applied, +$2.00; onion removed; full order 4.35×3+2.00 = **$15.05**.
- Condition fail (`≤ $1.50`) → rejected with reason, +$0.
- Unavailable add (`pineapple`) → rejected `"not available on this item"`.
- `_eval_condition` unit-tested across `price<=2`, `$2 or less`, `under $2`(→False, strict), `under $3`, `at most $2`, `$1.50 or less`, `more than $1`, `over $5` — all semantically correct.

**Real lesson observed (Phase 1 resurfacing):** on one run the model recorded the condition as prose (`"avocado costs $2 or less"`) not `"price <= 2"` — schema guarantees SHAPE, not FORMAT. Fix went into the TOOL (make the truth layer tolerant of natural phrasings), not the model — that's the correct place, since language is allowed to be messy and the tool is the robust layer. Model is non-deterministic: a later identical run emitted the clean `"price <= 2"`.

**REPL:** `main.py` now has an `order` command (menu: parse | recommend | tools | feedme | order | quit) → runs `parse_and_resolve_order` and prints applied/rejected changes + total. Verified: `3 Spam Musubi, remove onion from 2, add avocado to 1 if $2 or less` → onion free, avocado +$2.00, total $15.05.

**Chapter:** `chapter/06_structured_output_under_pressure.md` — written, incl. the "Explanation to a little kid" section.

## Phase 7 — Owner Copilot (SQL + RAG tools together) — ✅ DONE

**Goal:** an owner question (`"How did Tokachi Musubi do recently, and what are customers unhappy about?"`) answered by combining exact NUMBERS (SQL over orders) + THEMES (semantic search over reviews) in one agent run. Lesson: **agent power = tool diversity, not model size.** This is where SQLite arrives (aggregation pain).

**Files built/edited:**

| File | What |
|---|---|
| `migrate_to_sqlite.py` | Builds `foodpilot.db` (idempotent, rebuilds each run) with tables trucks/menu_items/orders/order_items + indexes. Loads from JSON via `executemany`. Counts: 107/635/260/506. |
| `app/db.py` | `DB_PATH` + `connect()` (row_factory=Row). |
| `app/tools.py` | `sales_stats(metric, truck?, start_date?, end_date?, limit)` @tool — **parameterized SQL, keep control**: `metric` whitelisted against `_SALES_METRICS` (revenue/order_count/avg_order_value/top_items/sales_by_day), every value bound as `?` (no injection), limit clamped, SELECT-only, base predicate `status='completed'`. `_resolve_truck` (name/id → id), `_sales_where`. `review_search(topic, truck?, k)` @tool — semantic search over reviews vector store, optional truck filter. `PHASE7_TOOLS=[sales_stats, review_search]`. |
| `app/retrievers.py` | `build_reviews_vectorstore` + `get_review_retriever` (Chroma `reviews` collection at `chroma_db/reviews/`, bge-m3, page_content=review text, metadata=rating/sentiment/truck/topics; topics list flattened to string). |
| `app/agent.py` | `owner_copilot_agent = create_react_agent(get_tool_model(), PHASE7_TOOLS, prompt)` + `run_owner_copilot(text)` (recursion_limit=30). |
| `main.py` | Added `owner` command. Menu now: parse \| recommend \| tools \| feedme \| order \| owner \| quit. |

**Security lesson (checkpoint):** did NOT give the LLM raw SQL (injection + DROP-TABLE risk). Whitelisted metrics + bound `?` params. Proven: `truck="'; DROP TABLE orders; --"` → treated as a literal name to look up → no match, orders table intact (260 rows).

**Tested:** `sales_stats` revenue (200 completed orders, $5425.20, avg $27.13), top_items, truck+date filter (Tokachi Musubi Aug 1-9 = 2 orders, $105.26), injection attempt harmless. `review_search` semantic hits ("long wait times" → "Waited 35 minutes, way too long"). Full agent run (~152s on qwen3:4b): called BOTH `sales_stats(sales_by_day)` AND `review_search(complaints)` for Tokachi, synthesized numbers + a quoted 2-star review. **Milestone met.**

**Real nuances:** (1) reviews are synthetic/templated → top-k can repeat identical text; matching is correct, data is the limit. (2) In the demo run the model quoted the top DAY's revenue ($64.89) rather than a grand total — numbers real (grounded in tool output), just a synthesis/metric-choice wobble (the kind Phase 13 evals catch). (3) **Ollama must be running** (`ollama serve`) for `review_search`/embeddings — bge-m3 on localhost:11434.

## Phase 8 — Review intelligence (RAG as a reporting engine) — ✅ DONE

**Goal:** unstructured reviews → ranked complaint categories with %. Lesson: RAG isn't only Q&A — retrieval + structured classification + aggregation = a reporting engine. Pattern: **map** (classify each review) + **reduce** (aggregate labels).

**Data fix first (important):** reviews had only **28 unique texts across 150 rows** → biased aggregation. `revamp_reviews.py` (seed 42) rewrote ONLY the `text` field of each review from per-(topic, sentiment) phrase banks — varied combos, **all 150 now unique**, still matching each review's existing `sentiment`/`topics` (the ground truth). Backup: `data/reviews.backup.json` (written once, not clobbered). Reviews vector store (`chroma_db/reviews/`) rebuilt on new text — so Phase 7 `review_search` reflects it now.

**Files built/edited:**

| File | What |
|---|---|
| `app/schemas.py` | `ReviewTopic = Literal[taste, portion, value, service, parking, pricing, wait_time, other]`; `ReviewClassification(sentiment, topics: list[ReviewTopic])`. Literal = keeps labels consistent across the whole batch (allowed set is in format_instructions). |
| `app/prompts.py` | `CLASSIFY_REVIEW_PROMPT` (text-only, {format_instructions}, "use ONLY allowed labels, 'other' if none fit"). |
| `app/chains.py` | `classify_review_chain = CLASSIFY_REVIEW_PROMPT.partial(...) \| createai_model \| PydanticOutputParser(ReviewClassification)`. The "map" chain. |
| `app/analytics.py` | `classify_reviews` (dedupe texts → `.batch(config={max_concurrency:8}, return_exceptions=True)` → map back), `aggregate_complaints` (tally topics on NEGATIVE reviews → ranked % table; pct of negatives, multi-topic so can exceed 100%), `generate_complaint_report(reviews=None)` (full pipeline). |
| `main.py` | Added `report` command. Menu: parse \| recommend \| tools \| feedme \| order \| owner \| report \| quit. |

**Tested:** 150 reviews classified in **~87s** (batch, 0 parse failures). Sentiment 46 neg (exact) / 103 pos / 1 neutral. LLM complaint breakdown vs ground truth: portion 23.9%(11), parking 23.9%(11), wait_time 17.4%(8), taste 10.9%(5) — **all exact**. **Divergence (the lesson):** GT pricing 23.9%(11) → LLM split into pricing 9 + value 9 (fuzzy pricing↔value boundary), and total topic-mentions 57 > 46 negatives (LLM multi-labeled some). Shape right, exact % drift, **no error raised** — the silent-wrong-% failure that motivates Phase 13 evals.

**Checkpoint answers:** (1) batch not loop = concurrency (thread pool over invoke, capped by max_concurrency); (2) consistent labels via Literal vocabulary in format_instructions + temp 0 + 'other'; (3) silent wrong % at fuzzy boundaries/multi-labeling → catch with gold-labeled evals (Phase 13). Model: CreateAI text path (no Ollama needed for this phase).

## Phase 9 — Multi-step reasoning that breaks LangChain — ✅ DONE (the second wall)

**Goal:** `"Prepare me for tomorrow"` — forecast → ingredients → inventory → shortfalls → suppliers → purchase plan. Built HONESTLY in LangChain to **hit the wall on purpose**. Deliverable = half-working attempt + written diagnosis. Second wall (after Phase 5's agent-loop ceiling).

**Files built:**

| File | What |
|---|---|
| `app/prep.py` | 6 deterministic steps (`forecast_demand` [STUB: popularity heuristic, no weather/events], `compute_ingredients` [uses RecipeLine], `check_inventory`, `find_shortfalls`, `get_supplier_prices` [cheapest], `build_purchase_plan`) wired as a LINEAR chain `prepare_chain = RunnableLambda(...) | ...`. `prepare_for_tomorrow(truck_id, budget)`. RecipeLine (`recipes.json`: menu_item+ingredient+quantity) is the hinge. |
| `LANGCHAIN_WALL.md` | The Phase 9 diagnosis: the four walls (branch/loop/pause/persist) each reproduced in code, checkpoint answers, and the 1:1 map to LangGraph fixes. |
| `LANGCHAIN_LEARNINGS.md` | **User-requested** single-page summary of the whole LangChain arc (Phases 1-9): what LangChain is, the phase table, full glossary by phase, five recurring lessons, three models, the two walls → LangGraph handoff, REPL commands. |

**Tested (KoJa Kitchen SF Spark, `koja-kitchen-sf-spark-san-francisco`):** happy path runs straight through — 9 forecast items → 21 required ingredients → 1 shortfall (gyoza wrapper) → $37.85 plan (45.6 units, 1-day lead), under $50. The four walls demonstrated in code: budget=$20 → over_budget (no in-chain retry loop); all 6 nodes run even with 0 shortfalls (no branch); no pause point for approval; state is a RAM dict (no persist/resume; stock decrement would corrupt on crash).

**Checkpoint answers:** (1) persist+pause hurt most (mutable stock + approval; branch/loop are ugly-but-possible, pause/persist are absent); (2) RecipeLine is the join that turns demand → shopping list; (3) state lives only in RAM for one `.invoke()`, lost on any crash. **Wall maps 1:1 to LangGraph:** branch→conditional edges, loop→cycles, pause→interrupt(), persist→checkpointer, RAM dict→typed state. **This is the last LangChain phase; Phase 10 starts LangGraph.**

**Chapter:** `chapter/09_multistep_reasoning_breaks_langchain.md` — written, incl. the "Explanation to a little kid" section (conveyor-belt-hits-four-walls analogy).

## Frontend — Sky Market web app — ✅ DONE

**Goal:** a real product face over the `app/` brain. Two audiences (Customer "Order" + Owner "Owner"), 11 screens, built as a static mock over **real project data** first, then wired to a backend. Follows `FoodPilot_Sky_Market_Design_System.md` (light/airy, Petrol structure, Tangerine = commerce, Turquoise = AI/charts).

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 · shadcn (`base-nova` on **Base UI** — `render` prop, not `asChild`) · Framer Motion (`motion`) · **d3** (hand-rolled owner charts) · Manrope + DM Serif Display. Lives in `web/`.

| Area | What |
|---|---|
| Data | `web/lib/foodpilot-data.json` generated from `data/*.json` (extract script). Real numbers: Dinosaurs $147.62/5/$29.52; sentiment 104/0/46; complaint ranking portion/parking/pricing 23.9%. |
| Mock brains | `web/lib/`: `query-parser` (Phase-1 chips), `order-parser` (Phase-6 applied/rejected mods), `concierge`, `copilot` — mirror each phase so screens can swap to real endpoints. |
| Customer | Landing (matches `main-landing-page.png` hero + `landing-page.png` phone + `footer-landing.png` CTA), Discover, Truck detail (+ customize dialog), Concierge, Order Builder (the Phase-6 showcase), Review & Confirm, Confirmation. |
| Owner | Dashboard (KPIs + d3 revenue chart + top items), Sales Analytics (metric/chart/table), Review Intelligence (sentiment + complaint scoreboard + re-run), Owner Copilot (fused tools + evidence). Petrol sidebar "operating system". |

**Tested:** production build passes (23 routes). Landing matches the design mockup (tangerine "Your Way." brush underline, string lights, marquee ribbon + count-up stats effects). All showcase interactions verified in-browser.

## Integration — microservices (Next.js → Spring Boot → Python) — ✅ DONE

**Goal:** wire the frontend to the real `app/` chains + agents, adding a **Java / Spring Boot / microservices** tier (user's résumé goal) while keeping the LangChain brain in Python.

```
web/ :3000  →  gateway/ :8080 (Java)  →  ai_service/ :8000 (Python → app/)
               owns SQL sales (JDBC)      LangChain chains + LangGraph agents
               proxies the AI calls       CreateAI + Ollama qwen3 + Chroma
```

| Service | What |
|---|---|
| `ai_service/main.py` (FastAPI) | Imports `app/`; endpoints: `/parse`, `/recommend`, `/order/resolve`, `/chat` (fast RAG, **not** the slow FEED ME agent), `/copilot`, `/reviews/report`, `/trucks/{id}` (full catalog for any of 107 trucks). Shapes agent tool-traces → evidence; strips qwen3 `<think>`. |
| `gateway/` (Spring Boot 3, Java 21, Maven) | `SalesService`/`SalesController` = SQL over `foodpilot.db` via JdbcTemplate (revenue/orders/aov/top_items/sales_by_day). `AiController` proxies the LLM endpoints with a 6-min read timeout. CORS for :3000. |
| `web/lib/api.ts` + `use-sales.ts` | Typed client → gateway; **every screen falls back to its local mock** if the backend is down (badge: *Live* vs *Sample data*). |

**Endpoint map:** Dashboard/Analytics → `GET /api/sales/summary` (Java JDBC). Discover → `/api/parse`. Order Builder → `/api/order/resolve`. Concierge → `/api/chat`. Copilot → `/api/copilot`. Reviews → `/api/reviews/report`. Truck detail (non-featured) → `/api/trucks/{id}`. Full run steps in `INTEGRATION.md`; `scripts/run-ai.sh` + `scripts/run-gateway.sh`.

**Tested end-to-end:** sales match exactly through Java ($5,425.20/200/$27.13; Dinosaurs $147.62/5/$29.52). Order Builder resolved via real CreateAI + modifier resolver (avocado rejected: real price $2.00). Copilot fused sales+reviews live. Concierge switched from the FEED ME agent (>5 min/turn — unusable) to the **fast RAG path** (~5–7s, grounded) that returns a truck+dish → renders a recommendation card + "View truck & order" link.

**Gotchas hit:** Ollama must be running (`ollama serve`) for the agents (`copilot`) — CreateAI chains (parse/order/reviews) don't need it; the retriever's metadata filter can return 0 docs on tight queries, so `/chat` falls back to unfiltered semantic search to always ground + recommend. Default `java` is 8; gateway needs Java 17+ (`openjdk@21`).

## Teaching notes (chapters so far)

- `chapter/01_langchain_basics_and_phase1_workflow.md` — Model, Message, Prompt Template, Schema, Parser, Runnable, `|`, Chain, `.invoke()`; exact trace of Phase 1's `createai_parse_chain`.
- `chapter/02_rag_retrievers_and_metadata_filtering.md` — Embedding, Vector store, Document, Retriever, metadata filter; exact trace of Phase 2's `recommend()` pipeline, plus the semantic-search-vs-hard-filter lesson.
- `chapter/03_message_history_and_memory.md` — Session, Chat History, MessagesPlaceholder, RunnableWithMessageHistory; exact turn-by-turn trace showing history.messages growing from `[]` to 4 messages, plus why the deprecation warning appears.
- `chapter/04_tool_binding_and_the_manual_tool_loop.md` — Tool, @tool, bind_tools, tool_calls, ToolMessage, tool_call_id, the loop; exact trace showing empty content + tool_calls dict + matching tool_call_id.
- `chapter/05_feed_me_agent_and_its_ceiling.md` — create_react_agent, autonomous tool ordering, order draft; both real failure runs (crammed-arg + hallucinated chains; first-tool-then-hallucinate), the deterministic control test proving tools are sound, and the branch/loop/pause/persist limitation list.
- `chapter/06_structured_output_under_pressure.md` — nested Pydantic, Field-description steering, condition-as-data, resolve_modifications (truth tool), safe no-eval condition parsing; exact trace of `parse_and_resolve_order` (Spam Musubi + avocado/onion), the LLM=language/tools=truth lesson, and the real "model emitted prose → fix the tool not the model" story.
- `chapter/07_owner_copilot_sql_and_rag.md` — SQLite migration + why aggregation forces it, `sales_stats` parameterized-SQL tool + the injection/whitelist security lesson, `review_search` reviews vector store, `owner_copilot_agent` fusing both; exact trace of the two-tool run (numbers + themes), "tool diversity not model size" lesson.
- `chapter/08_review_intelligence_reporting_engine.md` — map-reduce over documents, `.batch()` parallelism, Literal controlled vocabulary for label consistency, `classify_review_chain` + `aggregate_complaints`; the data revamp, the LLM-vs-ground-truth breakdown, and the silent-%-drift lesson (pricing↔value) that motivates evals.
- `chapter/09_multistep_reasoning_breaks_langchain.md` — the second wall: `app/prep.py` linear prepare pipeline, RecipeLine as the hinge, the four walls (branch/loop/pause/persist) reproduced, and the 1:1 map to LangGraph. Pairs with `LANGCHAIN_WALL.md` + `LANGCHAIN_LEARNINGS.md`.

Chapters 1–9 each also carry an **"Explanation to a little kid"** section at the end (plain-English analogy retelling), added on request.

---

## Open decisions / things to revisit later

- `ChatCreateAI` has no `temperature` knob — CreateAI's endpoint doesn't expose one; it's controlled server-side.
- No git repo yet in this project. `.gitignore` is already in place for whenever `git init` happens.
- If `llama3.2` (smaller/newer) is ever worth comparing against `llama3`, just edit the `model=` string in `app/llm.py`.
