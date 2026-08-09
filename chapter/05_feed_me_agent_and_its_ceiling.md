# Chapter 5 — The FEED ME Agent & Its Ceiling

Goal of Phase 5 (from `FoodPilot_Master_Spec.md`): take the hand-written loop from Chapter 4 and let a **prebuilt agent** run it — one vague request in, the agent does everything (search → menu → availability → wait → rank → build an order draft). Then, crucially, **watch where it struggles** and write that down. The struggle list is the entire point — it's the motivation for LangGraph.

The one-line idea: **`create_react_agent` is the Chapter 4 loop, pre-built for you. Using it teaches you what it automates — and, more importantly, what it *can't* do cleanly.**

---

## Part 1 — New terms for Phase 5

**`create_react_agent`**
A LangGraph helper that takes `(model, tools, prompt)` and returns a ready-to-run agent — the same invoke→tool_calls→ToolMessage→repeat loop you built by hand in Chapter 4, already wired up. ("ReAct" = Reason + Act: the model reasons about what to do, then acts by calling a tool.) You don't write the loop anymore; you just call `.invoke({"messages": [...]})`.

**Autonomous tool ordering**
With the manual loop you still controlled the surrounding code. With `create_react_agent`, the *model* decides the entire sequence of tool calls on its own — which tool, in what order, when to stop. That freedom is the feature... and the source of most of the problems below.

**Order draft**
A proposed order (truck + items + total + wait) assembled but **not yet placed** — something a human should approve first. Our `build_order_draft` tool produces one. The fact that there's no clean way to *pause for that approval* is a headline Phase 5 limitation.

**Note (updated):** CreateAI and plain `llama3` can't tool-call, so this phase needs a tool-capable model. The failure runs documented below were with **`llama3.2` (3B)** — the first attempt. The project has since **upgraded to `qwen3:4b`** (a reasoning model) via `get_tool_model()`, which completes the full chain (see the "Update" box at the end of Part 2). The `llama3.2` runs are kept on purpose because the *failure story* is the whole lesson of this phase.

---

## Part 2 — What actually happened (the real runs)

The agent has 8 tools (the 6 from Chapter 4 plus `rank_meals` and `build_order_draft`) and this instruction: *"do everything autonomously, respect every constraint, end by building one order draft for approval."*

### Run A — "I'm exhausted. High-protein, spicy, under $25, quick."

**What the agent did:**
```
CALL search_food_trucks({"cuisine": "high-protein, spicy"})
  -> "No food trucks found serving 'high-protein, spicy'."
```
Then it stopped using tools and answered with... **Chipotle, Taco Bell, and Subway** — with invented distances and prices. None of those are in our data.

**Two failures in one run:**
- It **crammed the whole request into one argument** (`cuisine="high-protein, spicy"`). `cuisine` should be something like `"mexican"`. No truck serves a cuisine literally named that, so zero results.
- On that failure, it **gave up on tools and hallucinated** national chains instead of retrying with a real cuisine.

### Run B — "Korean food, highest protein, build me an order."

**What the agent did:**
```
CALL search_food_trucks({"cuisine": "korean"})
  -> [{"truck_id": "koja-kitchen-sf-spark-...", "name": "KoJa Kitchen SF Spark", ...}]
```
Then, in its text answer, it described **"Bulgogi Beef Tacos, 42g protein"** and wrote "Order Draft" — but it **never called `get_menu`, never called `rank_meals`, never called `build_order_draft`.** The menu items and protein numbers were invented.

**The failure:** it called the *first* tool correctly, then **stopped chaining and hallucinated the rest.** This was repeatable across runs.

### The control test — are the tools broken, or is the model?

Driving the exact same chain **by hand** (no model deciding), the tools compose perfectly:
```
search_food_trucks("korean")  -> KoJa Kitchen SF Spark
get_menu(that truck)          -> real items
rank_meals(items, "protein")  -> Bulgogi Beef BOWL, 32g   (not the hallucinated "Tacos, 42g")
build_order_draft(...)        -> {"estimated_total": 13.98, "estimated_wait_min": 22}
```
So the **tools are correct**. The weak link is the 3B model's ability to plan a multi-step tool chain. That distinction — *framework/tools fine, model weak* — is exactly the muscle from Chapter 1, reused.

### Update — the model got upgraded (and it worked)

The two failing runs above were `llama3.2` (3B). The project then swapped `get_tool_model()` to **`qwen3:4b`**, a reasoning ("thinking") model. Both previously-failing FEED ME queries now complete the **full** `search → get_menu → check availability → check_wait_time → rank_meals → build_order_draft` chain with real (non-hallucinated) data and an approval prompt at the end. Cost: it's slow (~4 min/run on this hardware) and verbose (large hidden `<think>` blocks, so `num_ctx` is bumped to 16384).

**But this only closed the four model-capability failures (1–4).** The four structural failures (5–8) below are *untouched* by the upgrade — because they're about **control, not intelligence**. That split is the real Phase 5 lesson: a stronger model fixes what the model does wrong; only a different framework (LangGraph) fixes what the *loop* can't do at all.

---

## Part 3 — The deliverable: what the loop does badly

This list (full version in `LOOP_LIMITATIONS.md`) is the actual Phase 5 milestone. Split into two kinds:

**Model-capability failures** (a bigger model would reduce these):
1. Hallucinates instead of calling the next tool (invented wait times, invented dishes).
2. Crams the whole request into one tool argument.
3. Gives up after one failed tool call and invents an answer.
4. Stops the tool chain early — calls tool #1, fabricates the rest.

**Structural failures** (true of *any* pure loop, even with a perfect model):
5. **No way to force tool order** — can't guarantee "get_menu before build_order_draft."
6. **No pause for human approval** before a consequential action (placing an order).
7. **No branching/looping as real control flow** — "if over budget, find cheaper and re-check" can only be nudged via prompt text.
8. **No persistence** — crash mid-run and all in-flight state is gone.
9. **State is implicit and untyped** — the only "state" is the growing message list.

---

## The full picture

```
one vague request
        │
        ▼
create_react_agent  (= the Chapter 4 loop, prebuilt)
        │  model autonomously decides the tool sequence
        ▼
search → menu → availability → wait → rank → build_order_draft → (want: approval)
        │
        ▼
final answer / order draft
```
It *looks* clean. The problems are hidden in the arrows: the model might skip steps (4), take wrong turns (1-3), and there's no framework-level way to force order (5), stop for approval (6), loop on budget (7), or survive a crash (8).

---

## The three learning-checkpoint answers

1. **Where did the agent waste calls or lose a constraint?** It dropped constraints constantly — Run A ignored "under $25 / quick / high-protein" the moment its first search failed; Run B ignored "highest protein" as a real ranking step and just guessed. It also *under*-called (skipped tools) rather than wasting calls, which is the 3B failure mode.
2. **How would you force a "stop and ask me before ordering" step, and why is it awkward here?** You'd have to hack it into the prompt ("don't place the order, just show it") and *hope* — there's no framework mechanism to actually halt execution, surface state to a human, and resume. That missing mechanism is Phase 11's `interrupt()`.
3. **What state is the agent implicitly carrying, and where does it live?** Only the message list — candidates, budget status, attempt count are all buried inside prior messages, never named explicitly, and gone if the process dies. Phase 10's typed graph state fixes exactly this.

## Key lesson to remember

A prebuilt agent removes the *boilerplate* of the tool loop, not its *limits*. The freedom that makes it convenient (the model decides everything) is also why you can't force order, pause for approval, loop on a condition, or persist state. Those four missing powers — **branch, loop, pause, persist** — are the exact four things LangGraph adds, and they're why the project pivots to it at Phase 9-10. The wall is the curriculum.

---

# Explanation to a little kid

*(Same phase, told with pictures and no scary words. If the technical version above ever feels like a fog, read this first, then go back up — it'll click.)*

## The problem we're fixing

In Phase 4 you wrote the tool loop **by hand**. Phase 5 does two things: (1) throw your loop away and let a **prebuilt agent** run it, and (2) — the real point — **watch it hit a wall** and write the wall down. That wall is the reason the whole rest of the project exists.

## Your 30-line loop becomes 3 lines

```python
feed_me_agent = create_react_agent(
    get_tool_model(),   # the qwen3:4b brain
    PHASE5_TOOLS,       # 8 tools now (the 6 + rank_meals + build_order_draft)
    prompt=_FEED_ME_SYSTEM,
)
```

`create_react_agent` **is your Phase 4 loop, pre-wired** — same ask → run → feed-back → repeat. You already know what's inside it, which is exactly why you built it by hand first.

## What changes: the model now drives

Before, *your code* wrapped the loop. Now the **model decides the whole sequence** — which tool, what order, when to stop. That's **autonomous tool ordering**. The "FEED ME" idea leans in: the customer gives one lazy sentence —

> "I'm exhausted. High-protein, spicy, under $25, quick."

— and the agent must do *everything* by itself: search → menus → availability → wait → rank → build ONE order draft → present for approval. That freedom is the feature… and the trap.

## The plot twist: it failed first (that's the lesson)

**Act 1 — a small brain (`llama3.2`, 3B) broke badly:**
- "high-protein, spicy, under $25" → it called `search_food_trucks(cuisine="high-protein, spicy")` — **stuffed the whole request into one field** → zero results → then **gave up and recommended Chipotle, Taco Bell, Subway** (not in our data, invented prices).
- "Korean, highest protein, build an order" → called `search_food_trucks("korean")` **right**, then wrote "Bulgogi Beef Tacos, 42g, Order Draft" **without ever calling `get_menu`, `rank_meals`, or `build_order_draft`.** Called tool #1, then **hallucinated the rest.**

**The control test — tools or model?** Drive the same chain by hand:
```
search → KoJa Kitchen
get_menu → real items
rank_meals(protein) → Bulgogi Beef BOWL, 32g   (real — not the made-up "Tacos, 42g")
build_order_draft → total $13.98, wait 22 min
```
Tools compose **perfectly**. So tools fine, *model* weak — the same shape-vs-content lesson from Phase 1.

**Act 2 — upgrade the brain to `qwen3:4b`** (a thinking model): both failing queries now finish the whole chain with real data and an approval prompt. Slow (~4 min) and verbose, but it works.

## The ceiling: what a better brain can NEVER fix

Upgrading the model closed the **model-weakness** bugs. A second set is left completely untouched — because these are about **control, not smarts**:

| Model-weakness (a better brain fixes) | Structural (NO brain fixes — needs LangGraph) |
|---|---|
| crams args into one field | **can't force tool order** (get_menu before build_order_draft) |
| hallucinates the chain | **can't pause for approval** (the human-in-the-loop stop) |
| gives up after one fail | **can't branch / loop** ("if over budget, find cheaper, re-check") |
| stops the chain early | **can't persist** (crash mid-run = everything gone) |
| → fixed by `qwen3:4b` | → fixed only by **LangGraph** |

The pipeline *looks* clean — `request → agent → search → menu → rank → draft → answer` — but the problems hide **in the arrows**: nothing forces the order, nothing pauses at "approval," nothing loops on budget, nothing survives a crash. Four missing powers: **branch, loop, pause, persist.**

## Why this is the whole point

Phase 5's real deliverable isn't a working agent — it's the **list of what the loop can't do** (`LOOP_LIMITATIONS.md`). Because those four gaps map **one-to-one** onto what LangGraph adds next:

| The wall (Phase 5) | The fix (LangGraph, Phase 10+) |
|---|---|
| force order / branch / loop | **conditional edges** |
| pause for approval | **`interrupt()`** (real human-in-the-loop) |
| persist / resume | **checkpointing** |
| implicit, untyped state | **typed graph state** |

You didn't get *told* "LangChain isn't enough." You **felt the wall with your own hands.** That's why LangGraph will feel like relief, not a random new topic. **The wall is the curriculum.**

## The whole phase in six sentences

1. **`create_react_agent` = your Phase 4 loop, prebuilt** (3 lines replace ~30).
2. The change is **autonomous tool ordering** — the model picks tools, order, and when to stop.
3. That freedom is feature *and* trap — a weak model crammed args, gave up, and hallucinated chains.
4. A **control test** proved the tools compose by hand → tools fine, model weak (Phase 1's lesson again).
5. Upgrading to **`qwen3:4b`** fixed the model-weakness bugs but left a deeper set untouched.
6. Those **structural** gaps — **can't force order, pause, branch, or persist** — need **LangGraph**, not a smarter model.
