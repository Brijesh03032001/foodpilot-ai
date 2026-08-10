# Chapter 9 — Multi-Step Reasoning That Breaks LangChain

Goal of Phase 9 (from `FoodPilot_Master_Spec.md`): build `"Prepare me for tomorrow"` — forecast demand, compute ingredients, check inventory, find shortfalls, price suppliers, propose a purchase plan — **in LangChain, honestly, and feel the ceiling.** The milestone is not a working agent; it's a half-working attempt **plus a written diagnosis** (`LANGCHAIN_WALL.md`). That diagnosis is the entry ticket to LangGraph.

This is the **second wall**. Phase 5 hit the ceiling of the prebuilt ReAct *loop*; Phase 9 hits the ceiling of a linear LCEL *chain* on a stateful task. Both point at the same four missing powers: **branch, loop, pause, persist.**

---

## Part 1 — New terms for Phase 9

**RecipeLine**
One row of a recipe: `menu_item_id` + `ingredient_id` + `quantity` (`recipes.json`). It's the **hinge** of the whole phase — the join that turns "sell ~5 bowls" into "need 0.6 kg of X." Without it, demand and inventory can't be connected.

**Linear pipeline**
Six steps wired with `|` as `RunnableLambda(f1) | RunnableLambda(f2) | ...` (`app/prep.py`). Each step takes the running `state` dict and returns an updated one. It runs **straight through, top to bottom, exactly once.**

**The four walls (branch / loop / pause / persist)**
The things a linear chain structurally cannot do: conditionally skip steps, cycle back to an earlier step, halt for human approval and resume, or survive a crash with its state intact.

**Forecast stub**
`forecast_demand` uses a simple popularity heuristic — no real weather/events API. Deliberate: the phase's lesson is the **control structure**, not forecast accuracy, so the inputs are stubbed and the plumbing is honest.

---

## Part 2 — The exact run

Truck: KoJa Kitchen SF Spark. `prepare_for_tomorrow(truck_id, budget)` calls the linear `prepare_chain`.

### The happy path (it works)

```
forecast_demand      -> 9 available items, est units each   (popularity stub)
compute_ingredients  -> 21 required ingredients             (via RecipeLine)
check_inventory      -> on-hand from stock.json
find_shortfalls      -> 1 short: gyoza wrapper
get_supplier_prices  -> cheapest supplier for it
build_purchase_plan  -> buy 45.6 units, $37.85, 1-day lead; under $50 budget
```
Straight through, once. For a happy path, a linear chain is perfect.

### The four walls (each reproduced in code)

**Wall 1 — Loop.** With `budget=$20`, the $37.85 plan returns `over_budget=True` — and the chain has **already finished**. To get under budget you'd want to retry supplier-selection with cheaper options, but a linear pipe has no way back to step 5. Any retry `while` loop must be hand-written **outside** the chain.

**Wall 2 — Branch.** The pipe runs **all six nodes every time.** Even if `shortfalls` were empty, `get_supplier_prices` and `build_purchase_plan` still execute (producing empty results). There's no clean `if/else` *inside* a `|` chain to skip the buying half.

**Wall 3 — Pause.** `build_purchase_plan` produces a plan that should not be committed (a real order) without owner approval. The chain runs to the end — there's no first-class way to halt after step 6, show a human, wait for yes/no, and resume into a "commit" step.

**Wall 4 — Persist.** State is a plain dict in RAM, alive only for one `.invoke()`. Crash between steps 3 and 4 → everything lost, restart from step 1. If step 6 decremented stock (mutable state), a mid-write crash could corrupt inventory.

---

## The full picture

```
"Prepare me for tomorrow"
        │
        ▼
forecast → ingredients → inventory → shortfall → supplier → plan   (linear pipe, runs once)
   stub       RecipeLine     stock       need>have   cheapest   $ + approval?
                                 ▲                                    │
                                 └────── want a LOOP (budget) ────────┘   ← can't
                                 and a PAUSE for approval                 ← can't
                                 and PERSIST if it crashes                ← can't
                                 and a BRANCH to skip when nothing short  ← can't
```

---

## The three learning-checkpoint answers

1. **Which of the four hurts most, and why can't a chain solve it?** **Persist and pause**, because this task *mutates real state* (stock) and *needs approval* before doing so. Branch and loop are painful but expressible with ugly external Python; pause and persist are simply **absent** — a linear chain's only state is the value flowing through the pipe, alive for one `.invoke()` and no longer.
2. **Why is `RecipeLine` the single table that makes this agent real?** It's the join between a *dish* and the *ingredient quantities* it consumes. Without it you can't turn "forecast 5 bowls" into a concrete shopping list; every downstream step (shortfalls, suppliers, plan) depends on that bridge.
3. **Where does the process lose all state if it crashes?** Everywhere: the state dict lives only in RAM for the duration of `prepare_chain.invoke(...)`. Kill the process at any arrow and you restart from step 1 with nothing saved.

## Key lesson to remember

**Compose is not control.** LangChain pipes steps together beautifully (the happy path is genuinely clean), but a linear chain cannot **branch**, **loop**, **pause**, or **persist**. Those are exactly the powers a real, stateful, human-approved, crash-resistant operations agent needs — and exactly what LangGraph adds (conditional edges, cycles, `interrupt()`, checkpointers, typed state). The wall is the curriculum.

## Real data quirks handled

1. **RecipeLine linkage** — `recipes.json` is keyed by `menu_item_id`; `stock.json` by `truck_id + ingredient_id`; suppliers by `ingredient_id`. `app/prep.py` builds lookup dicts for each and walks the chain dish → ingredients → on-hand → shortfall → supplier.
2. **Forecast is stubbed** — popularity heuristic, no weather/events API. The structure is the lesson.
3. **Truck choice** — KoJa Kitchen SF Spark, picked because it has available menu items *with* recipes *and* stock rows (so the pipeline has real numbers end to end).

---

# Explanation to a little kid

*(Same phase, told with pictures and no scary words. If the technical version above ever feels like a fog, read this first, then go back up — it'll click.)*

## The problem we're fixing (on purpose)

Every phase so far ended with something that works. This one is different: we build something **so we can watch it fail** — and learn exactly why we need a new tool next.

The task: *"Get me ready for tomorrow."* The plan has six steps:

```
guess how much we'll sell → work out ingredients → check the fridge
    → find what's missing → price it from suppliers → make a shopping plan
```

We build these six steps as a straight **conveyor belt** (a linear chain): each step does its bit and passes the box to the next. And it *works* for the simple case — for KoJa Kitchen it figured out they're short on gyoza wrappers and made a $37.85 shopping plan.

## The magic table: RecipeLine

The trick that makes this real is one little table called **RecipeLine**: it says *"one bowl uses this much of that ingredient."* That's the bridge between "we'll sell 5 bowls" and "so we need 0.6 kg of X." Without it, the plan is impossible.

## Then the conveyor belt hits four walls

A straight conveyor belt can only go one way, once. Real life needs more:

1. **Loop — "keep looking until it's cheap enough."** We set a $20 budget; the plan came to $38. We'd want to go *back* and find cheaper suppliers. But the belt already reached the end — it can't go backward. You'd have to bolt a loop on *outside* the belt by hand.
2. **Branch — "skip the shopping steps if nothing's missing."** The belt runs *all six* steps every time, even when there's nothing to buy. It can't take a shortcut.
3. **Pause — "check with the owner before buying."** The plan spends real money, so a human should say "yes" first. But the belt never stops — there's no way to pause, ask, and continue.
4. **Persist — "if it crashes, pick up where it stopped."** Everything the belt knows is written on the box as it moves. If the power cuts out halfway, the box is gone — start over from step 1. And if step 6 had already started changing the fridge count, a crash could leave it half-changed and wrong.

## What hurt the most

The worst two are **pause** and **persist** — because this job *changes real things* (the fridge) and *needs a human's yes* first. You can hack in a loop or a branch with extra code, but pausing-and-resuming and remembering-after-a-crash just *don't exist* on a straight conveyor belt.

## Why this is the whole point

We've now hit this same wall twice (Phase 5's robot, Phase 9's conveyor belt), and both times the missing pieces are the same four: **branch, loop, pause, remember.** That's not bad luck — it's the lesson. LangChain is great at *connecting* steps but can't *control* them. The next tool, **LangGraph**, is built exactly for those four things. We had to feel the wall to understand why it exists.

## The whole phase in six sentences

1. We built a six-step "get ready for tomorrow" plan as a straight conveyor belt (linear chain).
2. **RecipeLine** is the magic table that turns "sell 5 bowls" into "need this much of each ingredient."
3. The simple case works — it found the shortage and made a shopping plan.
4. But the belt can't **loop** (retry under budget), **branch** (skip steps), **pause** (ask the owner), or **remember** (survive a crash).
5. **Pause** and **remember** hurt most, because the job changes real things and needs approval.
6. Same four missing pieces as Phase 5 — which is exactly what **LangGraph** adds next.
