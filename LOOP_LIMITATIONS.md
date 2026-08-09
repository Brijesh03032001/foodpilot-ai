# What the Loop Does Badly — Phase 5 deliverable

The Phase 5 milestone isn't "a perfect agent." It's a working-ish FEED ME demo
**plus this written list of what a plain tool loop / prebuilt ReAct agent does
badly.** This list is the entry ticket to LangGraph (Phase 10+): each item here
is something a state machine with explicit edges, loops, persistence, and
human-in-the-loop is meant to fix.

Observed with `llama3.2` (3B, local) driving `create_react_agent` and the
hand-written loop in `app/agent.py`. Two categories: model-capability failures
(this model) and structural failures (any pure loop, regardless of model).

> **Update — model upgraded to `qwen3:4b`.** `app/agent.py` now uses `qwen3:4b`
> (a reasoning model) via `get_tool_model()`, not `llama3.2`. On the new model
> the model-capability failures (1–4) are resolved: both previously-failing FEED
> ME queries now complete the full search→menu→availability→wait→rank→draft
> chain with real data and an approval prompt (cost: ~4 min/run, verbose
> `<think>` blocks, `num_ctx=16384`). The `llama3.2` observations below are kept
> because the failure story is the point. **The structural failures (5–9) are
> NOT resolved by the upgrade** — they need LangGraph, not a better model.

## Model-capability failures (worse on a small local model — resolved by `qwen3:4b`)

1. **Hallucinates instead of calling the next tool.** Asked for a Mexican
   truck + wait time, the model called `search_food_trucks` (got "Leo's
   Tacos"), then invented a *different* truck ("El Gallo Giro", rating 4.7) and
   a wait time of "20 minutes" — it never called `check_wait_time` at all.
   The data it "reported" was fabricated.

2. **Crams the whole request into one tool argument.** For "high-protein,
   spicy, under $25," it called `search_food_trucks(cuisine="high-protein,
   spicy")` — stuffing constraints into the `cuisine` field. No truck serves a
   cuisine literally called that, so it got zero results.

3. **Gives up on tools after one failure and invents an answer.** After the
   empty search above, instead of retrying with a real cuisine, it abandoned
   tools entirely and recommended **Chipotle, Taco Bell, and Subway** — chains
   that are not in our data at all, with made-up distances and prices.

4. **Stops the tool chain early.** Even on a clean query ("Korean food, highest
   protein, build me an order"), it correctly called `search_food_trucks`
   ("KoJa Kitchen") — then hallucinated menu items ("Bulgogi Beef Tacos, 42g")
   without calling `get_menu`, and never called `rank_meals` or
   `build_order_draft` despite writing the words "Order Draft" in prose.
   (Ground truth, proven by calling the tools directly: the real
   highest-protein item is "Bulgogi Beef Bowl, 32g", order total $13.98.)

## Structural failures (true of ANY pure loop, even with a strong model)

5. **No clean way to force tool order.** The loop lets the model decide the
   sequence. There's no way to say "you MUST call get_menu before you can build
   an order" without hacking it into the prompt and hoping.

6. **No pause for human approval before a consequential action.** The agent
   builds an order draft and just... continues. There's no first-class way to
   stop, show the draft, wait for a human yes/no, and only then place the
   order. (This is exactly the Phase 11 `interrupt()` payoff.)

7. **No branching / looping as real control flow.** "If over budget, find a
   cheaper alternative and re-check" can only be nudged via prompt text, not
   expressed as an actual loop the framework guarantees.

8. **No persistence.** If the process crashes mid-run, the entire in-flight
   state is gone. The message list lives in RAM only. There's no resume.

9. **State is implicit and untyped.** The only "state" is the growing message
   list. There's no explicit place that says "current candidates = [...],
   budget_ok = False, attempts = 2." You reconstruct it by re-reading messages.

## Verdict / what this motivates

The tools themselves are correct and compose perfectly when driven directly
(proven deterministically). What's missing is **control**: forced order,
branching, loops, a pause-for-approval step, and durable state. A linear
LangChain-style loop can't provide those cleanly. That is the whole reason the
project moves to **LangGraph** at Phase 10 — and items 5–8 above map almost
one-to-one onto conditional edges, loops, checkpointing, and interrupts.
