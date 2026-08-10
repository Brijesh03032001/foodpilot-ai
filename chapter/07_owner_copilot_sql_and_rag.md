# Chapter 7 — Owner Copilot (SQL + RAG Tools Together)

Goal of Phase 7 (from `FoodPilot_Master_Spec.md`): answer an owner question like `"How did my truck do this week, and what are customers unhappy about?"` by combining **exact numbers** (SQL over orders) with **themes** (semantic search over reviews) in one agent. The big lessons: **aggregation is what finally forces a real database (SQLite)**, and **agent power comes from tool *diversity*, not a bigger model.**

Everything before this read from JSON files in memory. This is the first phase where that genuinely stops being enough.

---

## Part 1 — New terms for Phase 7

**SQLite**
A real relational database that lives in a single file (`foodpilot.db`) — no server to run. A **table** is a grid; a **row** is one record (an order); a **column** is a field; a **primary key** (`id`) uniquely names each row.

**Aggregation (`GROUP BY` / `SUM` / `COUNT` / `AVG`)**
"Bucket the rows, then compute something per bucket." *Revenue by day* = `GROUP BY date(created_at)` then `SUM(total)`. In JSON these are hand-written accumulation loops written fresh every time; in SQL they're one line. This pain is *the* reason SQLite arrives here.

**`JOIN`**
Stitch two tables together on a shared key. `order_items` has a `menu_item_id`; the *name* lives in `menu_items`. `JOIN menu_items mi ON mi.id = oi.menu_item_id` combines them so "top items" can show names, not ids. This "relate two tables by a key" is the *relational* in relational database.

**Parameterized SQL**
Passing values into a query through `?` placeholders instead of pasting them into the SQL string. SQLite treats a bound value as **data, never as code**, which makes SQL injection impossible. It's the safe way to let an LLM's chosen values reach the database.

**Heterogeneous tools**
Tools of different *kinds* in one agent: a **structured** tool (`sales_stats`, SQL over orders) and an **unstructured** tool (`review_search`, semantic search over review text). The agent picks which one answers which part of a question.

---

## Part 2 — The exact trace, using a real run

Setup: `owner_copilot_agent = create_react_agent(get_tool_model(), PHASE7_TOOLS, prompt=...)` where `PHASE7_TOOLS = [sales_stats, review_search]` and the model is `qwen3:4b`.

Owner question: `"How did Tokachi Musubi do recently on sales, and what are customers unhappy about there?"`

### What the agent did (both tools, one run — ~152s)

```
CALL sales_stats({"truck": "Tokachi Musubi", "metric": "sales_by_day"})
  -> {"metric": "sales_by_day", "truck": "Tokachi Musubi",
      "rows": [{"day": "2026-08-07", "revenue": 40.37, "orders": 1},
               {"day": "2026-08-01", "revenue": 64.89, "orders": 1}, ...]}

CALL review_search({"truck": "Tokachi Musubi", "topic": "complaints"})
  -> [{"text": "Waited 35 minutes, way too long.", "rating": 2,
       "sentiment": "negative", "truck": "Tokachi Musubi", "topics": "wait_time"}, ...]
```

### The synthesized answer

> "Tokachi Musubi recently generated $64.89 in revenue on August 1st (1 order)… Customers are most unhappy about wait times, as one review noted: 'Waited 35 minutes, way too long.' (2 stars)."

The agent **routed each half of the question to the right tool** — "how did sales do" → `sales_stats`, "unhappy about" → `review_search` — using nothing but the tool docstrings and the system prompt. Then it fused numbers + a real quoted review into one answer, grounded in tool output.

**Honest nuance:** the model quoted the top *day's* revenue ($64.89) rather than a grand total. The numbers are real (it grounded in the tool result); it just chose a per-day metric over `revenue`. A synthesis wobble, not a tool bug — the kind of thing Phase 13's evals catch.

---

## The full picture

```
"How did Tokachi do, and what are people unhappy about?"
        │
        ▼
   owner_copilot_agent   (create_react_agent — the Phase 5 loop, again)
        │  model routes each sub-question by tool docstring
        ├─ sales_stats(truck, metric)      → SQLite  → NUMBERS
        └─ review_search(truck, topic)     → Chroma  → THEMES
        │
        ▼
   one synthesized answer: revenue figures + a quoted real review
```

Nothing new in the *loop* — the novelty is the two tools reach two different data stores (structured SQL vs unstructured vectors), and the model decides which answers what.

---

## The security lesson: never hand an LLM raw SQL

Two dangers if you let a model write arbitrary SQL: (1) **destructive/arbitrary queries** (`DROP TABLE`, runaway scans), and (2) **SQL injection** (a crafted value breaking out of a string-built query). `sales_stats` shuts both down:

1. **Metric whitelist** — the model can only pick from `_SALES_METRICS` (five fixed `SELECT`s). There is no surface to author arbitrary SQL. `metric="delete everything"` → `"unknown metric"`.
2. **Parameterized values** — every value (truck, dates, limit) is bound via `?`, so SQLite treats it as data. Proven: `truck="'; DROP TABLE orders; --"` was bound into `WHERE lower(name) LIKE ?` as a literal search term → no match → `orders` still had all 260 rows. The malicious SQL was never parsed as SQL.
3. **Clamped limit** (`max(1, min(limit, 50))`) and **SELECT-only** templates (read, never write).

This is the spec's "start hand-written, keep control; don't jump to the full SQL-agent toolkit yet." LangChain ships `create_sql_agent` (LLM writes raw SQL against your DB) — powerful, but it hands over the keys. Here the model chooses *what* to ask; you own the query.

---

## The three learning-checkpoint answers

1. **Why did aggregation push you off JSON?** Because *revenue/top-item/avg* are `SUM`/`GROUP BY` — one line in SQL, but a hand-written loop in JSON every time, and slow at scale. Demonstrated in Step 1: count + revenue + avg over 200 completed orders in one query; top items via `GROUP BY` + `JOIN` in four lines.
2. **How does the agent decide which tool answers which part?** From the tool **docstrings** + the system prompt: `sales_stats` is described for how-much/how-many, `review_search` for what-are-people-saying. The model matches each sub-question to the tool whose description fits. The descriptions *are* the routing — no routing code.
3. **What are the risks of raw SQL, and how did parameterizing help?** Injection + destructive queries. A metric whitelist + `?`-bound values mean a supplied value can never become executable SQL and the query shapes are fixed, so the worst a bad input does is return zero rows.

## Key lesson to remember

**Agent power comes from tool diversity, not model size.** The same `create_react_agent` and the same model as Phase 5 suddenly answers a business question it couldn't touch — purely because it now has a **structured** tool (SQL, exact) and an **unstructured** tool (semantic search, fuzzy). Match the tool to the *shape* of the question: exact/aggregate → SQL; meaning/theme → vectors. And when you expose a database to a model, keep control with **parameterized, whitelisted** queries — the model picks what to ask, never the raw SQL.

## Real data quirks handled

1. **Migration is idempotent** — `migrate_to_sqlite.py` drops + rebuilds every run, so it's safe to re-run; indexes added on `orders(truck_id, created_at)` and the `order_items` foreign keys.
2. **Realized sales only** — every `sales_stats` metric bakes in `status='completed'` so cancelled/pending orders don't inflate revenue (200 of the 260 orders).
3. **Reviews are synthetic/templated** — the same sentence repeats across trucks, so top-k semantic hits can look identical. The matching is correct; the data is the limit.
4. **Ollama must be running** (`ollama serve`, bge-m3 on localhost:11434) for `review_search`/embeddings — same dependency as Phase 2.

---

# Explanation to a little kid

*(Same phase, told with pictures and no scary words. If the technical version above ever feels like a fog, read this first, then go back up — it'll click.)*

## The problem we're fixing

The owner asks: *"How did my truck do this week — and what are people upset about?"* That's really **two questions in one**: a **numbers** question (how much money, how many orders) and a **feelings** question (what are people saying). No single tool answers both, so we give the agent **two** and let it use each where it fits.

## Two tools for two kinds of question

- **`sales_stats` = the accountant.** It reads a real database (**SQLite** — a whole database in one file) and is brilliant at *sum this, count that, group by day*. Money math. Before this, the numbers lived in JSON files, and adding them up meant writing a loop by hand every single time — annoying and slow. SQL does it in one line. That pain is *why* we finally moved to a database.
- **`review_search` = the librarian.** It reads the **reviews** and finds ones that *mean* what you asked, even in different words — ask "long waits" and it finds "waited 35 minutes, way too long." (Same meaning-search magic as Phase 2, pointed at reviews now.)

Numbers → ask the accountant. Feelings → ask the librarian. That's the whole idea.

## Watch it run (real trace, ~2.5 min)

```
Owner: "How did Tokachi Musubi do, and what are customers unhappy about?"

The agent, on its own, made TWO calls:
  sales_stats(truck="Tokachi Musubi", metric="sales_by_day")  → the numbers
  review_search(truck="Tokachi Musubi", topic="complaints")   → the themes

Then it combined them into ONE answer:
  "$64.89 on Aug 1… customers most unhappy about wait times:
   'Waited 35 minutes, way too long.' (2 stars)."
```

Nobody told it which tool to use for which half — it figured that out from each tool's description (its docstring). The accountant handled the money part; the librarian handled the complaints part.

## The safety rule: never let the robot write raw database commands

The accountant tool does NOT let the model type any command it wants — that would be dangerous (a confused model could delete your data, or a sneaky input could trick it). Instead:
- the model may only pick from a short menu of safe, pre-written questions ("revenue", "top items", …), and
- any value it fills in (a truck name, a date) is handed to the database as **plain data, never as a command**.

Proof: we fed it a nasty fake input — `'; DROP TABLE orders; --` (a trick meant to delete the orders) — and nothing happened. The database just looked for a truck *named* that, found none, and all 260 orders were still there. The trick was treated as a harmless word, not a command.

## The big idea: **more tools beat a bigger brain**

We didn't upgrade the model. We just gave it a **numbers tool** and a **feelings tool**, and suddenly it answers a real business question it couldn't before. That's the lesson: an agent gets powerful from having **different kinds of tools**, not from a smarter model. Pick the tool that matches the *shape* of the question — exact math → the database; meaning/opinions → the review search.

## The whole phase in six sentences

1. An owner question is often **two questions**: numbers + feelings.
2. **SQLite** (a database in one file) answers the numbers, because adding up JSON by hand doesn't scale — that's what `GROUP BY` / `SUM` are for.
3. **`sales_stats`** is the accountant tool; **`review_search`** is the librarian tool (meaning-search over reviews).
4. The **agent picks** which tool answers which half, from the tools' descriptions, then **combines** them into one answer.
5. We never let the model write raw SQL — it picks from safe pre-written queries with values passed as **data**, so a `DROP TABLE` trick does nothing.
6. **Tool diversity, not model size** — the same brain plus two different tools answers what neither could alone.
