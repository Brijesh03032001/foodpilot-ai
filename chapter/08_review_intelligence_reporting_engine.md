# Chapter 8 — Review Intelligence (RAG as a Reporting Engine)

Goal of Phase 8 (from `FoodPilot_Master_Spec.md`): answer `"What are customers complaining about?"` over many reviews → **ranked complaint categories with percentages**. The big lesson: **RAG isn't only Q&A.** Retrieval + structured classification + aggregation is a *reporting engine*.

Phase 7 *retrieved* a few matching reviews. Phase 8 *reads all of them, labels each, and quantifies* — unstructured text in, an act-on-able table out.

---

## Data fix first (why the numbers can be trusted)

The generated reviews reused only ~28 distinct sentences across 150 rows. Aggregating duplicated text biases every percentage. `revamp_reviews.py` rewrote only the `text` field of each review from per-(topic, sentiment) phrase banks — varied combinations, **guaranteed all-150-unique**, still matching each review's existing `sentiment`/`topics` labels (the ground truth we classify against). Original saved to `data/reviews.backup.json`; the reviews vector store was rebuilt on the new text.

---

## Part 1 — New terms for Phase 8

**Map-reduce over documents**
*Map* = do the same operation to each document independently (classify each review). *Reduce* = combine all those per-document results into one summary (tally into a ranked table). The shape scales to any pile of documents.

**Batched classification (`.batch()`)**
`chain.batch([inputs...])` runs the chain over many inputs **concurrently** — under the hood, a thread pool firing many `.invoke()`s at once (capped by `max_concurrency`). Far faster than a Python `for` loop that waits for each call to finish before starting the next. `return_exceptions=True` keeps one bad output from sinking the whole run.

**Controlled vocabulary (a `Literal`)**
`topics: list[ReviewTopic]` where `ReviewTopic = Literal["taste", ...]`. The allowed labels are baked into the prompt's `format_instructions` on **every call**, so the model can't drift ("slow service" vs "sluggishness"). `"other"` is the escape hatch.

**Classification chain**
`classify_review_chain = CLASSIFY_REVIEW_PROMPT | createai_model | PydanticOutputParser(ReviewClassification)` — the same text-only structured-output path as every other parser in this project, applied per review.

---

## Part 2 — The exact run

`generate_complaint_report()` (`app/analytics.py`): dedupe texts → `classify_review_chain.batch(...)` (MAP) → `aggregate_complaints(...)` (REDUCE).

**Timing:** 150 reviews classified in **~87s**, 0 parse failures (a serial loop would be several times slower).

**LLM-derived complaint breakdown (% of the 46 negative reviews):**
```
portion     23.9%  (11)
parking     23.9%  (11)
pricing     19.6%  ( 9)
value       19.6%  ( 9)
wait_time   17.4%  ( 8)
taste       10.9%  ( 5)
other        6.5%  ( 3)
service      2.2%  ( 1)
```

**Ground-truth breakdown (from the data labels):**
```
portion     23.9%  (11)
parking     23.9%  (11)
pricing     23.9%  (11)
wait_time   17.4%  ( 8)
taste       10.9%  ( 5)
```

Sentiment was near-perfect: **46 negative (exact)**, 103 positive, 1 neutral (vs 104/0). portion, parking, wait_time and taste matched exactly.

---

## The part that matters most: where it *silently* drifts

`pricing` is ground-truth **23.9% (11)**, but the LLM reported **pricing 9 + value 9** — it split pricing-ish complaints across two labels. And its topic counts sum to **57 across 46 negative reviews**, meaning it put **two labels on some reviews** where the data had one.

Why? The `pricing`↔`value` boundary is genuinely fuzzy — is *"overpriced"* a pricing complaint or a value complaint? Humans disagree, so the model does too.

The danger: **the overall shape is right (portion & parking on top, taste low), but the exact percentages drift — and nothing errors.** No crash, no failure count, just quietly-slightly-wrong numbers an owner might over-trust. You cannot eyeball this at 5,000 reviews. Catching it needs a **gold-labeled sample + per-label precision/recall** — which is exactly **Phase 13 (evals)**. This run is the motivation for it.

---

## The full picture

```
150 raw reviews (unstructured text)
        │  classify_review_chain.batch(...)   ← MAP: classify each in parallel (8 at once)
        ▼
150 labels (sentiment + topics), from a fixed Literal vocabulary
        │  aggregate_complaints(...)          ← REDUCE: tally topics on negatives
        ▼
ranked complaint table: portion 24% · parking 24% · pricing 20% · …
```

---

## The three learning-checkpoint answers

1. **Why batch instead of a loop? What does `.batch` do under the hood?** Concurrency. A loop calls the model one-at-a-time, each waiting on the last; `.batch` fires many `.invoke()`s in parallel (a thread pool, capped at `max_concurrency`), so 150 network-bound calls overlap. That's why it was ~87s, not minutes.
2. **How do you keep labels consistent across thousands of calls?** A controlled vocabulary as a `Literal`, so the allowed set is in `format_instructions` on every call; plus `temperature=0` and an `"other"` catch-all. The model can't invent synonyms.
3. **Where would this silently produce wrong percentages, and how would you catch it?** At fuzzy label boundaries (`pricing`↔`value`) and via multi-labeling (57 topic-mentions over 46 reviews). It won't error — so you catch it with evals: a gold-labeled sample and per-label metrics (Phase 13).

## Key lesson to remember

**RAG is a reporting engine, not just Q&A.** Classify each document (map) with a *controlled vocabulary* so labels stay comparable, run it in *parallel* with `.batch()`, then *aggregate* (reduce) into ranked, quantified insight. And respect the failure mode: aggregate numbers can look authoritative while quietly drifting at fuzzy category boundaries — only evals tell you whether to trust them.

## Real data quirks handled

1. **De-duplicated reviews** (`revamp_reviews.py`) — 28 → 150 unique texts, so percentages aren't dominated by repeated sentences; labels preserved as ground truth; backup kept.
2. **Dedupe-before-batch** — `classify_reviews` classifies distinct texts once and maps back, so identical reviews don't cost repeat LLM calls.
3. **`return_exceptions=True`** — a single unparseable output is counted (`classify_failures`) rather than crashing the whole batch.
4. **Model** — CreateAI + `PydanticOutputParser` (text-only path); no Ollama needed for this phase (that's only the embedding/vector tools).

---

# Explanation to a little kid

*(Same phase, told with pictures and no scary words. If the technical version above ever feels like a fog, read this first, then go back up — it'll click.)*

## The problem we're fixing

The owner has a giant box of customer reviews and asks: *"What are people complaining about?"* Searching (Phase 7) only pulls a few reviews. This time we want a **scoreboard**: read *every* review and count up the complaints — "portion too small: 24%, parking: 24%, price: 20%…". That's a **report**, not a search.

## First, we fixed the reviews

The reviews were copy-pasted — only ~28 different sentences across 150. If you count complaints from copies, a few sentences dominate and the scoreboard lies. So we rewrote each review to be **unique** but still true to its labels. Now every review counts once, fairly.

## The trick: do-to-each, then add-up (map → reduce)

- **Map = label each review.** A little chain reads one review and stamps it: *sentiment* (happy/unhappy) and *topics* (portion? parking? price?). We do this to all 150.
- **Reduce = add up the labels.** Count how often each complaint shows up among the unhappy reviews, sort, turn into percentages. Done — a scoreboard.

## Two clever bits

- **Do them all at once (`.batch()`).** Instead of labeling review 1, waiting, then review 2… we send a whole bunch at the **same time** (8 at once). 150 reviews took ~90 seconds instead of ages. Like having 8 helpers labeling in parallel.
- **A fixed list of labels.** We give the model an exact menu of topic words (taste, portion, value, service, parking, pricing, wait_time, other). So it can't say "slowness" one time and "slow-ish" the next — the counts stay comparable.

## Did it work? Mostly — and the "mostly" is the lesson

We compared the robot's scoreboard to the true answer:
- portion, parking, wait times, taste — **spot on**.
- unhappy count — **exactly 46, correct**.
- BUT: "price" complaints got **split** between two similar labels ("pricing" and "value"), because *"overpriced"* could count as either. So those two percentages were a bit off — and **nothing looked broken.**

That's the big warning: a scoreboard can look confident while being quietly a little wrong at fuzzy edges. You'd never spot it by eye across thousands of reviews. To really trust it, you need to **grade the robot against a hand-checked answer key** — which is a whole later phase (evals, Phase 13).

## The whole phase in six sentences

1. The goal is a **scoreboard** of complaints (with percentages), not a search.
2. First we made the reviews **unique** so counting is fair.
3. **Map** = label every review's sentiment + topics with a small chain.
4. **Reduce** = add up the labels into a ranked table.
5. `.batch()` labels many reviews **at once** (fast), and a **fixed label list** keeps counts comparable.
6. It matched the truth closely, but **split a fuzzy category** — proof that aggregate numbers can quietly drift, which is why **evals** exist later.
