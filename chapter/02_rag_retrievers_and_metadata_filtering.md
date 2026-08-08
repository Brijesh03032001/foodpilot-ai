# Chapter 2 — RAG, Retrievers & Metadata Filtering

Goal of Phase 2 (from `FoodPilot_Master_Spec.md`): given a `FoodQuery`, return real matching menu items with reasoning — combining semantic search (does this dish "feel" relevant?) with exact metadata filtering (does this dish actually satisfy the hard constraints — price, diet, spice, in-stock?).

---

## Part 1 — New terms for Phase 2

**Embedding**
A list of numbers (a "vector") that represents the *meaning* of a piece of text. Similar meanings produce similar-looking number lists. `"spicy tacos"` and `"hot Mexican food"` end up close together as vectors, even though they don't share a single exact word. We used a model called `bge-m3` to produce these — its whole job is text-in, numbers-out.

**Vector store**
A database built specifically to store these number-lists and let you ask "which stored items are numerically closest to *this* number-list?" Ours is **Chroma**, and it's saved on disk at `chroma_db/menu_items/`.

**Document (LangChain's version)**
The unit of data a vector store holds. Every `Document` has two parts:
- `page_content` — the actual text that gets converted into a vector (this is what gets *searched by meaning*)
- `metadata` — a dictionary of exact facts about that item (this is what gets *filtered by exact rules*, not by meaning)

We turned each of our 635 menu items into one `Document` each (see `app/retrievers.py`, `_item_to_document`).

**Retriever**
A Runnable whose job is: "give me a search query (text), I'll give you back the most relevant `Document`s." Ours is built by `get_menu_retriever(query, k=5)` — it does two things at once, which is the whole point of this phase:
1. Converts your text into a vector and finds the closest-meaning items (**semantic search**)
2. Throws out any item that fails an exact rule, like "must be vegetarian" or "must cost ≤ $12" (**metadata filter**)

**Metadata filter**
The strict, non-negotiable rules. Semantic search is fuzzy — it might think a $50 dish is "similar" to your $12 budget request because the words are food-related. The filter is what actually enforces the number.

---

## Part 2 — The exact trace, using a real run

Test sentence: `"vegetarian food, mild spice, under $12"`

### Step A: text → FoodQuery (this is just Phase 1, reused)

**Input:** `{"text": "vegetarian food, mild spice, under $12"}`
**Output (exact):**
```json
{"diet":"vegetarian","spice_level":"mild","max_price":12.0,"cuisine":null,"max_wait_min":null,"min_protein_g":null}
```
Nothing new here — this is `parse_chain` from Chapter 1, unchanged.

### Step B: FoodQuery → a Chroma filter dictionary

**Function:** `build_metadata_filter(query)` in `app/retrievers.py` (this one's plain Python, not a Runnable — filters are just data, no AI involved)

**Input (exact):** the `FoodQuery` object from Step A

**Output (exact):**
```json
{
  "$and": [
    {"is_available": true},
    {"is_vegetarian": true},
    {"spice_level": "mild"},
    {"price": {"$lte": 12.0}}
  ]
}
```
This is plain, boring logic — no AI touched this. It reads: "only consider items where `is_available` is true, AND `is_vegetarian` is true, AND `spice_level` equals exactly `mild`, AND `price` is less than or equal to `12.0`." Every one of your 635 menu items gets checked against these four rules before anything about "meaning" is even considered.

### Step C: the retriever runs — semantic search AND the filter, together

**Input:** your original text, `"vegetarian food, mild spice, under $12"`, plus the filter dict from Step B

**What happens internally, in order:**
1. Your text gets converted into a 1024-number vector by `bge-m3` (same as embedding, just for a search query instead of a stored item)
2. Chroma compares that vector against all 635 stored item-vectors, looking for the closest matches by *meaning*
3. **At the same time**, it discards any item that fails the Step B filter — doesn't matter how "close" it is semantically, if it's not vegetarian/mild/≤$12/available, it's out
4. Whatever survives both checks gets ranked, and the top `k=5` come back

**Output (exact):** 5 real `Document` objects. Here are the first two, word for word:

```
Veggie Fried Rice (bowl) from Bao n Boba. Veggie Fried Rice at Bao n Boba Cuisine:
dim_sum, bubble_tea, chinese. Dietary: vegetarian. Spice level: mild.

Veggie Taco (taco) from El Alambre #2. Veggie Taco at El Alambre #2 Cuisine:
mexican. Dietary: vegetarian, gluten_free. Spice level: mild.
```
(3 more followed — all real menu items, all genuinely vegetarian, mild, and ≤$12.)

### Step D: the 5 Documents get squashed into one block of text

**Function:** `_format_docs(docs)` in `app/chains.py` — literally joins every Document's `page_content` with a blank line between them.

**Input:** the list of 5 Documents from Step C
**Output:** one long string — all 5 item descriptions, one after another, separated by blank lines. This string is what becomes `{context}` in the next step.

### Step E: the context + your question get filled into the recommendation prompt

**Runnable:** `RECOMMEND_PROMPT` (in `app/prompts.py`)
**Input:** `{"context": <the joined string from Step D>, "question": "vegetarian food, mild spice, under $12"}`
**Output (exact):** a `SystemMessage` + `HumanMessage`, same idea as Chapter 1's Step 1, except now the system instructions carry the *actual retrieved menu items* baked into the text:

```
--- SystemMessage ---
You are a food truck recommendation assistant. Using ONLY the menu items
listed in the context below, recommend items that match the customer's
request. For each recommendation, briefly explain WHY it fits (price, spice,
diet, etc). If nothing in the context truly fits, say so honestly instead
of inventing an item.

Context (menu items available right now):
Veggie Fried Rice (bowl) from Bao n Boba. Veggie Fried Rice at Bao n Boba
Cuisine: dim_sum, bubble_tea, chinese. Dietary: vegetarian. Spice level: mild.
[... 4 more real items ...]

--- HumanMessage ---
vegetarian food, mild spice, under $12
```

### Step F: the model reads all that and writes the final answer

**Input:** the two messages from Step E
**Output (the real answer that came back):**
> "I recommend the Veggie Fried Rice (bowl) from Bao n Boba. It is vegetarian, has a mild spice level... Alternatively, you can choose any of the Veggie Tacos from El Alambre #2, Tahona Mercado, Al Carajo, or Taco N'Madre..."

Notice: **every single dish it named was actually in the context text from Step D.** It didn't invent anything — because the `SystemMessage` explicitly told it "using ONLY the menu items listed" and we only gave it real, filtered, retrieved items to work with. That instruction plus that context is the entire trick behind why RAG answers are trustworthy instead of made up.

---

## The full picture

```
"vegetarian food, mild spice, under $12"
        │  Step A: parse_chain.invoke(...)                  [Phase 1, reused]
        ▼
FoodQuery(diet="vegetarian", spice_level="mild", max_price=12.0, ...)
        │  Step B: build_metadata_filter(query)              [plain Python]
        ▼
{"$and": [{"is_available": true}, {"is_vegetarian": true}, {"spice_level": "mild"}, {"price": {"$lte": 12.0}}]}
        │  Step C: retriever.invoke(text)     ← semantic search AND the filter, at once
        ▼
[5 real Document objects, page_content + metadata each]
        │  Step D: _format_docs(docs)                        [plain Python]
        ▼
one long string of all 5 items' descriptions
        │  Step E: RECOMMEND_PROMPT.invoke({...})
        ▼
[SystemMessage(instructions + that string baked in), HumanMessage(your question)]
        │  Step F: model.invoke(messages)
        ▼
final answer, grounded only in the 5 retrieved items
```

Running `recommend(text)` in `app/chains.py` does Steps A–F automatically, back to back.

---

## Bonus: why one test returned 1 item and another returned 5

Earlier we also tried `"no meat, spicy Asian food, under $20"` and got back **only 1** Document (`Mapo Tofu`), while `"vegetarian food, mild spice, under $12"` got back **5**. Checking the raw data directly confirmed this wasn't a bug: across all 635 menu items, exactly **1** item is genuinely vegetarian *and* spicy-hot *and* ≤$20 *and* in stock. The filter isn't broken — it's being honest. There simply isn't more inventory that satisfies all four hard constraints at once.

This is worth sitting with, because it's the real tradeoff Phase 2 is teaching: **the stricter your filter, the fewer results survive, no matter how good the semantic search is.** Semantic search can find you the most "vegetarian-spicy-Asian-feeling" dishes in the whole dataset — but if the filter says "must be exactly vegetarian AND exactly hot AND under $20," and only one dish in your entire inventory happens to be all three, that's genuinely all there is to return.

## Key lesson to remember

**Semantic search finds what "feels" relevant. The metadata filter enforces what's actually *true*.** You need both, for the exact reason the spec calls out: pure semantic search might rank a $50 dish as "close" to a spicy-Asian request because the words overlap — it has no concept of "$50 > $20, reject." Only the filter knows that. Meaning and correctness are two different jobs, done by two different mechanisms, working on the same request at the same time.

## Real data quirks handled to make this work (see `memory.md` for full detail)

1. `cuisines` lives on `FoodTruck`, not `MenuItem` — denormalized into each Document at index time.
2. `FoodQuery.spice_level` (`mild/medium/spicy`) vs `MenuItem.spice_level` (`mild/medium/hot/none`) — explicit mapping dict translates `"spicy"` → `"hot"` when building filters.
3. Chroma metadata can't store lists — `dietary_tags` got flattened into booleans (`is_vegetarian`, `is_vegan`, `is_gluten_free`) at index time.
4. 15/107 trucks had an empty `cuisines` list in the raw Yelp scrape — backfilled with `backfill_cuisines.py` so cuisine-flavored semantic search has something to work with for every truck.

---

# Explanation to a little kid

*(Same phase, told with pictures and no scary words. If the technical version above ever feels like a fog, read this first, then go back up — it'll click.)*

## The problem we're fixing

A language model is like a **charming waiter who has never seen your menu.** Ask him "what's good and vegetarian?" and he answers instantly and confidently — by **making up a dish** that your truck can't even cook. Fluent. Useless. That making-stuff-up has a name: **hallucination**.

The fix is silly-simple:

> **Hand the waiter your real menu first, and say: "Only recommend from THIS."**

That's **RAG** (*Retrieval-Augmented Generation*):
- **Retrieval** — go find the real, relevant menu items.
- **Augmented** — stuff those real items into the prompt.
- **Generation** — *now* let the model write the answer, boxed in by what you gave it.

The model still writes the pretty sentence. It just can't invent the facts anymore. We call that a **grounded** answer.

## The one magic idea: turn *meaning* into numbers

Customer types `"spicy Mexican food"`. Your menu says `"hot tacos with jalapeño."` **Zero shared words** — a Ctrl+F search misses it completely. But you and I know they *mean* the same thing.

So we turn the **meaning** of text into a list of numbers, called an **embedding** (or "vector" — same thing). Think of it as a **GPS coordinate for meaning**:

- `"spicy Mexican food"` lands at one spot.
- `"hot tacos with jalapeño"` lands **right next door** (similar meaning).
- `"vanilla ice cream"` lands across town.

Similar meaning → coordinates close together. **Words don't have to match — only the meaning does.** The little machine that does text → numbers is `bge-m3`. That's its only job.

## Where we keep the coordinates: the vector store

We embed **all 635 menu items ahead of time** and store their coordinates in **Chroma** (a database good at one question: *"here's a coordinate — what's closest?"*).

Two separate moments — don't mix them up:

- **Moment 1 — build the library (once, ~20 seconds):** embed all 635 items, save to disk. Pay this cost once.
- **Moment 2 — answer a question (every time, fast):** embed just the one customer question, ask Chroma for the nearest items.

## What we store: the Document (a two-sided index card)

Each menu item = one **Document**, with two sides:

- **Front → `page_content`:** a plain-English sentence about the dish. *This* gets turned into a coordinate and searched by meaning.
- **Back → `metadata`:** a table of exact facts (`price`, `is_vegetarian`, `spice_level`, `is_available`). Kept separate because meaning-search is fuzzy and terrible at exact rules — it has no clue that $50 > $12.

## The two-track search: the Matchmaker and the Bouncer

When a customer asks, the retriever does **two jobs at once**:

- **Matchmaker (semantic search):** finds dishes that *feel* right by meaning. Warm, fuzzy, good at vibes — but would happily rank a $50 lobster plate as "close" to a cheap-taco request.
- **Bouncer (metadata filter):** stands at the door with a checklist of **non-negotiable rules** and throws out anyone who fails, *no matter how good their vibe was.* Too pricey? Out. Not veggie? Out. Sold out? Out.

**Matchmaker finds what *feels* right. Bouncer enforces what's *actually true*.** You need both — meaning and correctness are two different jobs.

Clever detail: `cuisine` is given to the **Matchmaker only**, never the Bouncer — because "Asian" is fuzzy (Thai? Chinese? Korean?) and a hard rule would wrongly reject a perfect match. But price, diet, spice, protein are **exact**, so they go to the strict Bouncer. *Choosing which field goes to which track is the real skill.*

## The little journey (one query)

```
"vegetarian food, mild spice, under $12"
        │  parse  →  FoodQuery(diet=vegetarian, spice=mild, max_price=12)
        ▼
Bouncer checklist:  in-stock AND vegetarian AND mild AND price ≤ 12
        │  retriever runs Matchmaker + Bouncer AT THE SAME TIME
        ▼
5 real Documents that survived BOTH checks
        │  poured into the prompt with:  "use ONLY these items"
        ▼
Grounded answer — names only real dishes, invents nothing
```

That four-word leash — **"use ONLY these items"** — is what turns a make-things-up waiter into a trustworthy one.

## The honest-filter surprise

A stricter query, `"no meat, spicy Asian food, under $20"`, returned **only 1 dish** — not a bug. Across all 635 items, exactly one is vegetarian *and* hot *and* ≤$20 *and* in stock. The Bouncer was being **honest**.

> **The stricter your filter, the fewer results survive — no matter how good the meaning-search is.** Few results can mean the truth about your real inventory, not a weak system.

## One LangChain word: `RunnableLambda`

LangChain snaps steps together with `|` (a pipe = "output of the left becomes input of the right"). Each snappable step is a **Runnable**. But the retrieval step is custom Python that depends on *this* customer's request, and a plain function isn't a Runnable. **`RunnableLambda` is the adapter that wraps a plain function so it clicks into the pipe** with everything else.

## The whole phase in six sentences

1. Models hallucinate; **RAG** fixes it — give the model real data, say "only use this."
2. **Embeddings** turn meaning into number-coordinates, so similar meanings sit close even with no shared words (`bge-m3`).
3. A **vector store** (Chroma) holds those coordinates and finds the nearest ones fast — **built once**, **searched per request**.
4. Each item is a **Document**: `page_content` (fuzzy meaning) + `metadata` (exact facts).
5. The retriever runs two tracks at once — **Matchmaker** (feels right) + **Bouncer** (actually true) — and picking which field goes where is the design skill.
6. Retrieved real items go into the prompt with **"use ONLY this,"** and the model writes a **grounded** answer.
