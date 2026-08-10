# Where LangChain Breaks — Phase 9 diagnosis

The Phase 9 milestone isn't a working agent. It's an **honest half-working
attempt** (`app/prep.py`) **plus this written diagnosis** of what a linear
LangChain pipeline cannot do. That diagnosis is the entry ticket to LangGraph
(Phases 10-11).

This is the *second* wall in the project. Phase 5 hit the ceiling of the
prebuilt ReAct agent loop (`LOOP_LIMITATIONS.md`). Phase 9 hits the ceiling of
a linear LCEL chain on a stateful, multi-step task. Both walls point at the
same four missing powers — **branch, loop, pause, persist** — which is exactly
what LangGraph adds.

## The task

`"Prepare me for tomorrow."` — a six-step operations plan:

```
forecast_demand -> compute_ingredients -> check_inventory
      -> find_shortfalls -> get_supplier_prices -> build_purchase_plan
```

Built in `app/prep.py` as a **linear** chain of `RunnableLambda`s piped with `|`.
`RecipeLine` (`recipes.json`: menu_item -> ingredient + quantity) is the hinge
table — it's what turns "sell ~5 bowls" into "need 0.6 kg of X."

**The happy path works.** For KoJa Kitchen SF Spark: 9 forecast items -> 21
required ingredients -> 1 shortfall (gyoza wrapper) -> a $37.85 purchase plan
(45.6 units from Bay Area Restaurant Depot, 1-day lead). Straight through, once.

## The four walls (each reproduced in code)

### 1. Branch — "if short on X, plan a purchase; else skip"
A linear pipe runs **all six nodes every time.** Even when `shortfalls` is empty,
`get_supplier_prices` and `build_purchase_plan` still execute (producing empty
results). There is no clean `if/else` *inside* a `|` chain to skip the buying
half. You can only hack it: have each downstream node early-return on empty
input — scattering the branch logic across every node instead of expressing it
once as an edge.

### 2. Loop — "keep finding cheaper suppliers until under budget"
With `budget=$20`, the $37.85 plan comes back `over_budget=True` — and the chain
has **already finished.** A linear pipe has no way back to step 5 to retry with
different supplier choices. Any retry loop must be **hand-written in Python
around the chain** (`while state['over_budget']: ...`), which means the control
flow that matters most lives *outside* the framework, not in it.

### 3. Pause — "stop, show the owner the plan, wait for approval, resume"
`build_purchase_plan` produces a plan that **should not** be committed (a real
order, decrementing stock) without owner sign-off. The chain runs straight to
the end. There is no first-class way to **halt** after step 6, surface the state
to a human, wait for yes/no, and **resume** into a "commit purchase" step. You'd
have to split the program in two and glue the halves together by hand.

### 4. Persist — "if it crashes mid-plan, resume where it left off"
State is a plain dict passed through RAM. A crash between steps 3 and 4 loses
**everything** — there's no checkpoint, no resume. Worse: if step 6 actually
*decremented stock* (mutable persistent state — the Tier 3 payoff), a mid-write
crash could corrupt inventory, with no transaction boundary to roll back to.

## The three learning-checkpoint answers

1. **Which of the four hurts most, and why can't a chain solve it?**
   **Persist** and **pause**, together, hurt most — because this task *mutates
   real state* (stock) and *needs human approval* before doing so. A linear
   chain has no concept of a durable checkpoint or a resumable halt: its only
   "state" is the value flowing through the pipe, alive only for the length of
   one `.invoke()`. Branch and loop are painful but *expressible* with ugly
   external Python; pause+persist are simply **absent**.
2. **Why is `RecipeLine` the single table that makes this agent real?**
   Without it, "forecast 5 bowls" and "check inventory" live in different
   universes — you can't connect a *dish* to the *ingredient quantities* it
   consumes. `RecipeLine` (menu_item + ingredient + quantity) is the join that
   turns demand into a concrete shopping list. It's the bridge between sales and
   supply; everything downstream (shortfalls, suppliers, plan) depends on it.
3. **Where does the process lose all state if it crashes?**
   Everywhere and always: the state dict lives only in memory for the duration
   of `prepare_chain.invoke(...)`. There is no persistence between nodes. Kill
   the process at any arrow in the pipeline and you restart from step 1 with
   nothing saved.

## Verdict — the wall maps 1:1 onto LangGraph

| The wall (Phase 9, linear chain) | The fix (LangGraph, Phase 10-11) |
|---|---|
| can't branch (skip when no shortfall) | **conditional edges** |
| can't loop (retry until under budget) | **cycles** in the graph |
| can't pause for approval | **`interrupt()`** (human-in-the-loop) |
| can't persist / resume after a crash | **checkpointers** (`MemorySaver`/`SqliteSaver`) |
| state is an implicit dict in RAM | **typed graph state** (`TypedDict`) |

Two walls now say the same thing (Phase 5's agent loop, Phase 9's linear chain):
**LangChain composes steps beautifully but cannot *control* them** — no branch,
loop, pause, or durable state. That control is precisely what LangGraph is for.
The wall is the curriculum.
