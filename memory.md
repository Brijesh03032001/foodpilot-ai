# FoodPilot AI — Progress Log

Running record of what's been built, decided, and learned. Read `FoodPilot_Master_Spec.md` first for the full spec/curriculum — this file just tracks *actual progress against it*.

---

## Environment

- **Virtualenv:** `cuisine/` (not `.venv` — deliberately named this). Activate with `source cuisine/bin/activate`, or call binaries directly (`./cuisine/bin/python ...`) since this shell has `python`/`pip` aliased to Homebrew's global install, which silently bypasses `source activate`.
- **Dependencies:** `requirements.txt` — `langchain`, `langchain-community`, `langchain-ollama`, `langgraph`, `pydantic`, `chromadb`, `python-dotenv`, `httpx`. Installed versions: `langchain 1.3.14`, `langgraph 1.2.10`.
- **`.env`:** holds `CREATEAI_ACCESS_TOKEN` and `CREATEAI_QUERY_URL` (ASU CreateAI credentials). `.gitignore` added so this never gets committed once the project becomes a git repo.
- **Local model:** Ollama installed, `llama3` (8B) and `llama3.2` (3B) pulled. Ollama server runs on `localhost:11434`.

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

## Teaching notes (chapters so far)

- `chapter/01_langchain_basics_and_phase1_workflow.md` — Model, Message, Prompt Template, Schema, Parser, Runnable, `|`, Chain, `.invoke()`; exact trace of Phase 1's `createai_parse_chain`.
- `chapter/02_rag_retrievers_and_metadata_filtering.md` — Embedding, Vector store, Document, Retriever, metadata filter; exact trace of Phase 2's `recommend()` pipeline, plus the semantic-search-vs-hard-filter lesson.
- `chapter/03_message_history_and_memory.md` — Session, Chat History, MessagesPlaceholder, RunnableWithMessageHistory; exact turn-by-turn trace showing history.messages growing from `[]` to 4 messages, plus why the deprecation warning appears.
- `chapter/04_tool_binding_and_the_manual_tool_loop.md` — Tool, @tool, bind_tools, tool_calls, ToolMessage, tool_call_id, the loop; exact trace showing empty content + tool_calls dict + matching tool_call_id.
- `chapter/05_feed_me_agent_and_its_ceiling.md` — create_react_agent, autonomous tool ordering, order draft; both real failure runs (crammed-arg + hallucinated chains; first-tool-then-hallucinate), the deterministic control test proving tools are sound, and the branch/loop/pause/persist limitation list.

---

## Open decisions / things to revisit later

- `ChatCreateAI` has no `temperature` knob — CreateAI's endpoint doesn't expose one; it's controlled server-side.
- No git repo yet in this project. `.gitignore` is already in place for whenever `git init` happens.
- If `llama3.2` (smaller/newer) is ever worth comparing against `llama3`, just edit the `model=` string in `app/llm.py`.
