# Chapter 6 — Structured Output Under Pressure

Goal of Phase 6 (from `FoodPilot_Master_Spec.md`): parse a messy multi-part order like `"3 Spam Musubi, remove onion from 2, add avocado to 1 only if avocado ≤ $2"` into a **validated, nested** order object, then **verify and price** every modification against real modifier data. The production principle it teaches: **the LLM extracts intent (language); tools check feasibility and price (truth).**

This is Phase 1 turned up to hard mode. Phase 1 parsed a flat request into a flat `FoodQuery`. Here the request is layered (an item, with per-subset modifications, some carrying conditions), so the output has to be a small **tree**, and the model must not be trusted to do arithmetic about your prices.

---

## Part 1 — New terms for Phase 6

**Nested Pydantic**
A schema where one field is itself a list of *another* schema. `OrderDraftItem` has `modifications: list[Modification]` — so one order line contains a list of smaller modification objects. It's a form with a sub-form that repeats. (`app/schemas.py`.)

**`Field(description=...)` as steering**
Not a code comment. `PydanticOutputParser` turns the schema — descriptions included — into the `format_instructions` text the model reads. So each description literally instructs the model on what goes in that slot. The most important one here is on `condition`: *"record the condition as text; do NOT decide whether it's true."*

**`default_factory=list`**
The correct way to default a list field. `Field(default_factory=list)` builds a **fresh** empty list every time; `default=[]` would make all instances secretly share one list (a classic Python bug). Pydantic pushes you toward the safe form.

**Condition-as-data**
The customer's "only if avocado ≤ $2" is captured as the plain string `"price <= 2"` and stored, unevaluated. The model records *what was asked*; it never checks whether it's affordable. That check is a tool's job.

**`resolve_modifications` (the truth tool)**
A `@tool` in `app/tools.py` that takes an `item_id` + a list of modifications and, against the real `modifiers.json`: (1) checks each requested add/remove actually exists on that item, (2) reads its real `price_delta`, (3) evaluates any `condition` against that real price, (4) returns which changes were applied, which were rejected and why, and the total price change.

**Safe condition evaluation (no `eval()`)**
`_eval_condition` never runs the string as code. It extracts *one comparison operator + one number* via regex (handling both `price <= 2` and natural phrasings like `"$2 or less"`, `"under $3"`), then compares. Text from an LLM/user is untrusted data, never code.

---

## Part 2 — The exact trace, using a real run

Customer sentence: `"3 Spam Musubi, remove onion from 2, add avocado to 1 but only if avocado costs $2 or less."`
Real item used: `mi-0010` "Spam Musubi" ($4.35). Real modifiers on it: **Add avocado +$2.0** (action `add`), **No onion +$0.0** (action `remove`).

### Step 1: text → nested `OrderDraftItem` (LLM = language)

**Runnable:** `order_parse_chain = ORDER_PARSE_PROMPT.partial(format_instructions=...) | createai_model | PydanticOutputParser(OrderDraftItem)` (`app/chains.py`). Same text-only path as Phase 1's CreateAI chain — CreateAI can't tool-call, so the schema is spelled out via `format_instructions` — but the schema is now nested.

**Input:** `{"text": "3 Spam Musubi, remove onion from 2, add avocado to 1 but only if avocado costs $2 or less."}`

**Output (exact):**
```json
{
  "item": "Spam Musubi",
  "quantity": 3,
  "modifications": [
    { "quantity": 2, "add": [], "remove": ["onion"], "condition": null },
    { "quantity": 1, "add": ["avocado"], "remove": [], "condition": "price <= 2" }
  ]
}
```
The model got the whole *shape* right: the item, the total of 3, and the split (onion from 2, avocado on 1). It recorded the condition as data and did **not** decide whether $2 is affordable.

### Step 2: item name → item_id (plumbing)

**Function:** `find_menu_item_id("Spam Musubi")` → `"mi-0010"`. The parser returns a name; the tool needs an id. Exact match first, then substring either direction.

### Step 3: modifications → verified + priced (tools = truth)

**Tool:** `resolve_modifications.invoke({"item_id": "mi-0010", "modifications": [...]})`.

**What it does, per modification:**
- remove `onion` → finds the real "No onion" modifier, `price_delta` 0.0 → **applied**, +$0.
- add `avocado` with condition `"price <= 2"` → finds the real "Add avocado" modifier, real `price_delta` **2.0** → evaluates `2.0 <= 2` → **True** → **applied**, +$2.0.

**Output (trimmed):**
```json
{
  "item_id": "mi-0010", "item_name": "Spam Musubi", "base_price": 4.35,
  "modifications": [
    { "quantity": 2, "changes": [ { "type": "remove", "ingredient": "onion", "matched": "No onion", "price_delta": 0.0, "applied": true } ], "line_price_change": 0.0 },
    { "quantity": 1, "condition": "price <= 2", "changes": [ { "type": "add", "ingredient": "avocado", "matched": "Add avocado", "price_delta": 2.0, "applied": true, "condition_met": true } ], "line_price_change": 2.0 }
  ],
  "modifications_price_change": 2.0
}
```

**Full order total:** `4.35 × 3 + 2.00 = $15.05`.

### The two other cases (proving the tool decides, not guesses)

- Condition **fails**: `"$1.50 or less"` on the same real 2.0 → `2.0 <= 1.5` False → avocado **rejected**: `"condition '...' not met (real price 2.00)"`, +$0.
- Add **doesn't exist**: `add ["pineapple"]` → `"applied": false, "reason": "not available on this item"`.

---

## The full picture

```
"3 Spam Musubi, remove onion from 2, add avocado to 1 only if avocado ≤ $2"
        │  order_parse_chain.invoke({"text": ...})          [CreateAI + parser]  LANGUAGE
        ▼
OrderDraftItem(item="Spam Musubi", quantity=3, modifications=[ {2, remove onion}, {1, add avocado, "price <= 2"} ])
        │  find_menu_item_id("Spam Musubi")                 [plumbing]
        ▼
"mi-0010"
        │  resolve_modifications("mi-0010", mods)           [reads modifiers.json]  TRUTH
        ▼
avocado exists (+$2.0 real) · 2.0 ≤ 2 ✓ applied · onion removed ($0) · total $15.05
```
`parse_and_resolve_order(text)` in `app/chains.py` runs all of it. The REPL exposes it as the `order` command in `main.py`.

---

## The real lesson observed (Phase 1 resurfacing)

On one run, the model recorded the condition as **prose** — `"avocado costs $2 or less"` — instead of `"price <= 2"`. The first version of `_eval_condition` only understood the operator form, so it returned "could not be parsed" and correctly **refused to apply** the avocado (better a clean refusal than a wrong guess).

This is exactly the Phase 1 lesson again: **the schema guarantees the *shape* of the output (a valid string in `condition`), never the exact *format/content*.** The model gave a valid string, just phrased loosely. So the fix went into the **tool**, not the model: `_eval_condition` was made tolerant of natural money-talk (`"$2 or less"`, `"under $3"`, `"at most $2"`) via a phrase→operator map. Why fix the tool and not the prompt? Because in *LLM = language, tools = truth*, language is *allowed* to be messy — the tool is the robust layer that turns messy phrasing into a precise, safe comparison. (Confirmed the model is non-deterministic: a later identical run emitted the clean `"price <= 2"`. A robust tool handles both.)

---

## The three learning-checkpoint answers

1. **Why should the condition be data, not an LLM judgment?** Because "is avocado ≤ $2?" is a fact about *your* prices, which the model doesn't know — it would guess from training and be wrong the moment a truck reprices. As data (`"price <= 2"`), a tool reads the real $2.0 and is never wrong. Demonstrated: the tool accepted `$2 or less` and rejected `$1.50 or less` on the *same* real price.
2. **How does nesting change reliability, and how do `Field` descriptions help?** Nesting is harder — the model must build a tree and route each change to the right sub-object, so there's more to get wrong. `Field(description=...)` becomes the `format_instructions` that steer it, and the `condition` description ("record, don't decide") is what keeps the model from evaluating prices itself.
3. **What happens when a requested modifier doesn't exist?** The tool returns `"applied": false, "reason": "not available on this item"` (seen with `pineapple`) — it refuses cleanly instead of inventing a topping.

## Key lesson to remember

**LLM = language, tools = truth.** The model's job is to turn a messy human sentence into structured intent, including conditions captured as *data*. It must never be the thing that decides a factual/price question — a deterministic tool reading real data does that, safely (no `eval`). And when the model phrases something loosely, the *tool* absorbs the messiness, because language is allowed to be messy and the tool is the robust layer. This split is the production principle that applies to every phase after this one.

## Real data quirks handled

1. **Linkage:** `menu_item` (`mi-0010`) → `modifier_group` (`mg-mi-0010`, keyed by `menu_item_id`) → `modifiers` (keyed by `group_id`, each with `action` + `price_delta`). `resolve_modifications` walks that chain to find an item's real add/remove options.
2. **Name vs id:** the parser emits a name (`"Spam Musubi"`), the tool needs an id — bridged by `find_menu_item_id` (exact then substring).
3. **Model path:** CreateAI + `PydanticOutputParser` (native `.with_structured_output` needs tool-calling, which CreateAI lacks). The parser path handles the nested schema fine. Native alternative if ever wanted: `qwen3:4b.with_structured_output(OrderDraftItem)`.

---

# Explanation to a little kid

*(Same phase, told with pictures and no scary words. If the technical version above ever feels like a fog, read this first, then go back up — it'll click.)*

## The problem we're fixing

Phase 1 parsed an easy sentence into a flat form. Phase 6 hands the model a **monster sentence**:

> "3 Spam Musubi, remove onion from 2, add avocado to 1 — but only if avocado is $2 or less."

Two things make it hard: it's **layered** (one item, but different changes to different portions), and it has an **"if"** (a condition). And there's a trap: the model must **not** be the one who decides whether avocado is cheap enough — because it doesn't actually know your prices.

## The pieces, one at a time

- **Nested schema = a form with a mini-form inside.** `OrderDraftItem` has an `item`, a `quantity`, and a `modifications` list — and each modification is its *own* little form (how many? add what? remove what? any condition?). In Phase 1 every blank held a single value; now one blank holds *a list of little forms*.
- **`Field(description=...)` = whispering to the model.** Those descriptions become the instructions the model reads. The key one says: for `condition`, *"just write down the condition as text — do NOT decide if it's true."*
- **`default_factory=list` = a fresh empty list each time** (writing `default=[]` is a famous Python bug where everyone accidentally shares one list). Small thing, saves real pain.
- **Condition-as-data = a sealed envelope.** "only if avocado ≤ $2" gets stored as the text `"price <= 2"`. The model doesn't open it. It just labels it "someone please check this."
- **`resolve_modifications` = the truth-checker who opens the envelope.** It reads the *real* `modifiers.json`: does this item even offer avocado? what does it really cost? does that real price satisfy the condition? All from data, no guessing.
- **No `eval()` = safety.** The condition is a string. The lazy way to "run" a string is `eval()`, which can run *any* code — dangerous with text that came from a user/model. So the tool only ever pulls out one operator and one number with a safe pattern, and compares. Never runs it as code.

## Watch it run (real trace)

```
Customer: "3 Spam Musubi, remove onion from 2, add avocado to 1 if $2 or less"

STEP 1 — the MODEL (language):
  { item: "Spam Musubi", quantity: 3,
    modifications: [ {quantity:2, remove:["onion"]},
                     {quantity:1, add:["avocado"], condition:"price <= 2"} ] }
  (got the shape right; recorded the condition; did NOT decide it)

STEP 2 — name → id:  "Spam Musubi" → "mi-0010"

STEP 3 — the TOOL (truth), reading modifiers.json:
  remove onion  → real "No onion"  +$0.0  → applied
  add avocado   → real "Add avocado" +$2.0 → 2.0 <= 2? YES → applied
  total = $4.35 × 3 + $2.00 = $15.05
```

Two more cases proved the tool decides, not guesses:
- "if $1.50 or less" → 2.0 ≤ 1.5? NO → avocado **rejected** (with the reason).
- "add pineapple" → not offered on this item → **rejected** ("not available").

## The big idea: **LLM = language, tools = truth**

The **model** turns messy human words into a neat structure — that's *language*, and it's allowed to be a little loose. The **tool** checks facts and does the money math against your real data — that's *truth*, and it's never allowed to guess. If you ever let the model decide "is this ≤ $2?", it'll answer confidently and be wrong the day a price changes. Let the tool read the real number. Every phase after this one leans on this split.

## A real hiccup (and why we fixed the tool, not the model)

One run, the model wrote the condition as prose — `"avocado costs $2 or less"` — not `"price <= 2"`. The tool couldn't read it and safely refused the avocado. That's Phase 1's lesson again: the form guarantees the *shape*, not the exact *wording*. So we taught the **tool** to understand natural money-talk ("$2 or less", "under $3", "at most $2"), because messiness is language's job to produce and the tool's job to absorb.

## The whole phase in six sentences

1. Phase 6 parses a **layered** order (item + per-portion modifications, some with an **"if"**).
2. The shape is a **nested schema**: `OrderDraftItem` contains a list of `Modification`.
3. `Field(description=...)` steers the model; the key rule is **record the condition, don't decide it**.
4. The condition is stored as **data** (`"price <= 2"`), a sealed envelope for later.
5. `resolve_modifications` (the **tool**) opens it, reads the **real** price from `modifiers.json`, and decides — safely, no `eval()`.
6. **LLM = language, tools = truth** — the model handles messy words, the tool handles facts and money, and that split is the lesson that carries forward.
