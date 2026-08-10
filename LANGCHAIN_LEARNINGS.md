# What We Learned in LangChain — FoodPilot, Phases 1–9

A single-page map of the entire LangChain half of this project. Phases 1–9 are
all LangChain; Phase 10 onward is LangGraph. Each phase's full teaching lives in
`chapter/NN_*.md` (every one ends with an "Explanation to a little kid"
section); the running progress log is `memory.md`.

---

## What LangChain actually is

A toolkit for **composing** the pieces of an LLM app into pipelines. Its core
grammar is tiny:

- A **Runnable** is anything with `.invoke()` (models, prompts, parsers, tools,
  plain functions wrapped in `RunnableLambda`).
- The pipe **`|`** feeds one Runnable's output into the next.
- A **chain** is Runnables piped together; you run it with `.invoke()` (or many
  at once with `.batch()`).

Everything below is built from that grammar. The project's arc is: LangChain
**composes** steps beautifully — and then (Phases 5 and 9) you hit the wall
that it cannot **control** them (branch/loop/pause/persist), which is why the
project moves to LangGraph next.

---

## The nine-phase arc

| Phase | What you built | The one key idea |
|---|---|---|
| 1 — Chat models + LCEL + structured output | text → validated `FoodQuery` | prompt \| model \| parser; schema guarantees **shape**, not **content** |
| 2 — Retrievers (RAG) | grounded menu recommendation | embeddings = meaning as numbers; **semantic search + metadata filter** together |
| 3 — Message history / memory | multi-turn concierge | the model is **stateless**; "memory" = re-send the transcript every turn |
| 4 — Tool binding + manual loop | hand-written agent loop | the model **requests** tools; your loop **runs** them (this is ReAct) |
| 5 — FEED ME agent + its ceiling | `create_react_agent` + limits | prebuilt agent removes boilerplate, not limits → **wall #1** |
| 6 — Structured output under pressure | nested order + resolver | **LLM = language, tools = truth** (conditions as data) |
| 7 — Owner Copilot (SQL + RAG) | agent with two data tools | **tool diversity > model size**; parameterized SQL keeps control |
| 8 — Review intelligence | complaint report | RAG as a **reporting engine** (map-reduce, `.batch()`) |
| 9 — Reasoning that breaks LangChain | linear prep pipeline | linear chains can't branch/loop/pause/persist → **wall #2** |

---

## The glossary (by phase)

**Phase 1 — chat models, LCEL, structured output**
- **Chat model** — the LLM you message (`ChatOllama`, `ChatCreateAI`).
- **Message types** — `SystemMessage` / `HumanMessage` / `AIMessage`.
- **Prompt Template** — a fill-in-the-blanks message form (`ChatPromptTemplate`).
- **Schema** — the exact output shape (`FoodQuery(BaseModel)`); **`Field`/`Literal`** define/limit slots.
- **Output Parser** — turns the model's text into an object (`PydanticOutputParser`).
- **format_instructions** — the schema written into the prompt as text.
- **Runnable / `|` / chain / `.invoke()`** — the composition grammar.
- **`with_structured_output`** — native structured output for tool-calling models.
- **`.partial()`** — pre-fill one prompt slot; **temperature** — randomness knob.

**Phase 2 — retrievers / RAG**
- **Embedding / vector** — meaning as a list of numbers (`bge-m3`).
- **Vector store** — a DB that finds nearest-meaning items (`Chroma`).
- **Document** — `page_content` (searched by meaning) + `metadata` (exact facts).
- **Retriever** — text in, relevant Documents out.
- **Semantic search** vs **metadata filter** — feels-relevant vs is-actually-true.
- **`RunnableLambda`** — wrap a plain function as a Runnable; **grounding** — answer only from retrieved data.

**Phase 3 — memory**
- **Stateless** — the model remembers nothing between calls.
- **Chat History** — the list of past messages (the "notebook").
- **Session / `session_id`** — which conversation's notebook.
- **`MessagesPlaceholder`** — prompt slot where history is replayed.
- **`RunnableWithMessageHistory`** — auto-loads/saves the notebook each turn.

**Phase 4 — tools & the manual loop**
- **Tool / `@tool`** — a Python function the model may call; its **docstring is the instruction**.
- **`bind_tools`** — make the model aware of tools (not run them).
- **`tool_calls`** — the model's request (empty content + a call slip).
- **`ToolMessage` / `tool_call_id`** — the result handed back, tagged to its request.
- **The tool loop / ReAct** — Thought → Action → Observation → repeat.

**Phase 5 — prebuilt agent & ceiling**
- **`create_react_agent`** — the Phase 4 loop, prebuilt.
- **Autonomous tool ordering** — the model picks tools/order/stop.
- **Order draft** — a proposal awaiting approval.
- **Human-in-the-loop** — a person approves before a risky action (the missing pause).
- **branch/loop/pause/persist** — the four powers a pure loop lacks.

**Phase 6 — structured output under pressure**
- **Nested Pydantic** — a schema field that is a list of another schema.
- **`Field(description=...)` as steering** — descriptions guide extraction.
- **`default_factory=list`** — safe list default.
- **Condition-as-data** — capture "only if ≤ $2" as text, don't evaluate it.
- **Truth tool** — `resolve_modifications` checks feasibility/price against real data (no `eval`).

**Phase 7 — Owner Copilot (SQL + RAG)**
- **SQLite** — a real relational DB in one file; **table/row/column/primary key**.
- **Aggregation** — `GROUP BY` / `SUM` / `COUNT` / `AVG` (what forced the DB).
- **JOIN** — stitch two tables on a shared key.
- **Parameterized SQL** — `?` placeholders → values are data, never code (no injection).
- **Heterogeneous tools** — structured (SQL) + unstructured (vector) in one agent.

**Phase 8 — review intelligence**
- **Map-reduce over documents** — classify each (map), aggregate (reduce).
- **`.batch()`** — run a chain over many inputs concurrently.
- **Controlled vocabulary (`Literal`)** — fixed labels → consistent across calls.

**Phase 9 — reasoning that breaks LangChain**
- **RecipeLine** — the join (menu_item + ingredient + quantity) that turns demand into a shopping list.
- **Linear pipeline** — `RunnableLambda | ... | RunnableLambda`; runs straight through, once.
- **The four walls** — branch / loop / pause / persist (see `LANGCHAIN_WALL.md`).

---

## Five lessons that keep coming back

1. **Shape ≠ content.** Schemas/parsers guarantee the *shape* of output; they can't make the model's *content* correct (Phase 1), and they don't guarantee the *format* you hoped for (Phase 6's prose condition). Fix content/robustness in the model choice or the tool, not the schema.
2. **LLM = language, tools = truth.** The model turns messy words into structure and plans; deterministic tools verify facts, do math, and touch data. Never let the model decide a factual/price/availability question a tool can read (Phases 6, 7).
3. **Tool diversity > model size.** The same model gains new power from *different kinds* of tools (SQL + vectors), not a bigger brain (Phase 7).
4. **Aggregate numbers drift silently.** Map-reduce reporting can look authoritative while wrong at fuzzy boundaries — only evals tell you if you can trust it (Phase 8).
5. **Compose is not control.** LangChain pipes steps together brilliantly but can't branch, loop, pause, or persist them (Phases 5 and 9). That gap is the whole reason for LangGraph.

---

## The three models (right tool for the job)

- **CreateAI** (ASU-hosted) — structured extraction & classification (Phases 1, 6, 8). Text-in/text-out, no tool-calling, strongest accuracy → used via `PydanticOutputParser`.
- **bge-m3** (Ollama) — embeddings for the menu and review vector stores (Phases 2, 7). Needs `ollama serve`.
- **qwen3:4b** (Ollama) — tool-calling / reasoning agent (Phases 4, 5, 7). Slow but chains tools reliably.

---

## The two walls → why LangGraph (Phase 10+)

Both ceilings say the same thing:

- **Wall #1 (Phase 5, `LOOP_LIMITATIONS.md`)** — a prebuilt ReAct loop can't force tool order, pause for approval, branch, or persist.
- **Wall #2 (Phase 9, `LANGCHAIN_WALL.md`)** — a linear LCEL chain can't branch, loop, pause, or persist a stateful multi-step task.

Both map 1:1 onto what LangGraph adds:

| Missing in LangChain | LangGraph fix |
|---|---|
| branch | conditional edges |
| loop | cycles |
| pause for approval | `interrupt()` (human-in-the-loop) |
| persist / resume | checkpointers (`MemorySaver` / `SqliteSaver`) |
| implicit RAM state | typed graph state (`TypedDict`) |

**LangChain composes; LangGraph controls.** That's the handoff.

---

## Run any phase (the REPL)

```bash
./cuisine/bin/python main.py
```
Commands: `parse` (P1) · `recommend` (P2) · `tools` (P4) · `feedme` (P5) ·
`order` (P6) · `owner` (P7) · `report` (P8) · `quit`.
(Phase 9's `prepare_for_tomorrow` runs from `app/prep.py`.)
Vector/tool phases need `ollama serve` running (bge-m3 / qwen3:4b).
