# Chapter 4 — Tool Binding & the Manual Tool Loop

Goal of Phase 4 (from `FoodPilot_Master_Spec.md`): give the model real tools (functions it can run against our data) and build the "agent loop" **by hand**, so that when a prebuilt agent does it for you later (Phase 5), you know exactly what it automated. Nothing magic.

The one-line idea: **an "agent" is just a while-loop that keeps calling the model and running whatever tools the model asks for, until the model stops asking.**

---

## Part 1 — New terms for Phase 4

**Tool**
A normal Python function the model is allowed to run. You mark it with the `@tool` decorator. The function's **docstring is the instruction the model reads** to decide when and how to call it — so the docstring literally *is* prompt engineering. Ours live in `app/tools.py` (e.g. `search_food_trucks`, `get_menu`, `check_wait_time`).

**`bind_tools`**
`model.bind_tools([tool1, tool2, ...])` hands the model the list of tools it's allowed to use. It doesn't run anything — it just makes the model *aware* the tools exist, so it can ask for them. Returns a new model object that knows about those tools.

**`tool_calls`**
When a tool-aware model decides it wants to run a tool, it doesn't return a normal text answer. Instead its reply (`AIMessage`) comes back with an empty `.content` and a filled-in `.tool_calls` list — each entry saying which tool and with what arguments. **The model doesn't run the tool itself; it just *requests* the call.** You run it.

**`ToolMessage`**
The message you create to carry a tool's result back to the model. It's tied to the specific request via a `tool_call_id`, so the model knows "this result answers the call I made."

**The tool loop**
invoke the model → if it returned `tool_calls`, run each tool and append a `ToolMessage` for each → invoke the model again (now it can see the results) → repeat until the model returns a normal answer with no `tool_calls`.

**Important model note:** tool-calling requires a model that supports it. Our CreateAI wrapper and plain `llama3` do **not** (llama3 returns "does not support tools", HTTP 400). Phase 4/5 use **`qwen3:4b`** via `get_tool_model()`, which emits real `tool_calls` and reliably chains multi-step calls. (An earlier attempt with `llama3.2` 3B emitted tool_calls but hallucinated the rest of the chain after the first call — see `memory.md` and `LOOP_LIMITATIONS.md` — so the project upgraded to the `qwen3:4b` reasoning model.)

---

## Part 2 — The exact trace, using a real run

Setup: `model = get_tool_model().bind_tools(PHASE4_TOOLS)`, then we seed the conversation with a system message and one human request: `"Find a Korean food truck"`.

### Step 1: invoke the model → it requests a tool

**Input:** the message list
```
[SystemMessage("You are a food concierge with tools. Use them."),
 HumanMessage("Find a Korean food truck")]
```

**Output:** an `AIMessage`. Two things about it, both exact from the real run:

`ai.content` is:
```
''
```
**Empty.** The model gave no text answer — because it wants a tool first.

`ai.tool_calls` is:
```json
[
  {
    "name": "search_food_trucks",
    "args": { "cuisine": "korean" },
    "id": "6d500bb9-aab9-4530-822f-0532ea2cc987",
    "type": "tool_call"
  }
]
```
This is the model saying, in structured form: *"please run `search_food_trucks` with `cuisine="korean"`, and I'm labeling this request `6d500bb9...`."* Notice it correctly pulled `"korean"` out of the sentence and put it in the right argument. **The model chose the tool and the argument — using nothing but the function's name, signature, and docstring.** That's why docstrings are the highest-leverage thing in this phase.

### Step 2: YOU run the tool (the model can't)

We look up the tool by name and run it with the args the model gave:
```python
tool = tools_by_name["search_food_trucks"]      # from the @tool functions
result = tool.invoke({"cuisine": "korean"})
```

**Output (exact, truncated):**
```
[{"truck_id": "koja-kitchen-sf-spark-san-francisco", "name": "KoJa Kitchen SF Spark",
  "rating": 4.5, "price_tier": "$$", "cuisines": ["korean", "asian_fusion", ...]}, ...]
```
Real data from `data/trucks.json`. The model never touched the data — it only asked; our code did the actual lookup.

### Step 3: wrap the result in a ToolMessage and hand it back

```python
ToolMessage(content=result, tool_call_id="6d500bb9-aab9-4530-822f-0532ea2cc987")
```

**The `tool_call_id` matters:** it's the *same* id the model put on its request in Step 1. If the model had asked for 3 tools at once, you'd append 3 ToolMessages, and each id is how the model matches each result to the right request. Without it, the model wouldn't know which answer goes with which question.

### Step 4: invoke the model again — now it can see the result

We append that `ToolMessage` to the list and call the model again. Now its input is:
```
[SystemMessage, HumanMessage, AIMessage(the tool request), ToolMessage(the results)]
```
This time the model reads the real truck data and either (a) asks for another tool, or (b) returns a normal text answer with `tool_calls` empty. **When `tool_calls` is empty, the loop ends** — that `AIMessage.content` is your final answer.

---

## The full picture (the loop, from `app/agent.py`)

```
messages = [SystemMessage, HumanMessage(user request)]

repeat (up to max_steps):
    ai = model.invoke(messages)          # model thinks
    messages.append(ai)
    if ai.tool_calls is empty:
        STOP  →  ai.content is the final answer
    for each tool_call in ai.tool_calls:
        result = run_that_tool(tool_call.args)
        messages.append(ToolMessage(result, tool_call_id=tool_call.id))
    # loop again, now with the results visible to the model
```

That's the entire "agent." No magic — a while-loop, a model that asks for tools, and you running them.

---

## The three learning-checkpoint answers

1. **What decides *which* tool the model calls?** The tool's name, its argument signature (types), and above all its **docstring**. The model sees only that description — not the function body. A vague docstring = wrong or missing tool calls.
2. **What's in a `ToolMessage` and why does `tool_call_id` matter?** The tool's result (`content`) plus the `tool_call_id`. The id ties the result to the exact request the model made, so when multiple tools are called at once the model can match each result to its question.
3. **What makes the loop terminate?** The model returning an `AIMessage` with an **empty `tool_calls` list** — meaning it's satisfied and produced a normal text answer instead of asking for another tool. (Plus a `max_steps` safety guard so a confused model can't loop forever.)

## Key lesson to remember

The model **requests** tool calls; it never runs them. Your loop runs them and feeds results back. An "agent" is that loop. Once you've written it by hand, `create_react_agent` in Phase 5 stops being magic — it's this exact loop, wrapped up.

---

# Explanation to a little kid

*(Same phase, told with pictures and no scary words. If the technical version above ever feels like a fog, read this first, then go back up — it'll click.)*

## The problem we're fixing

Until now the model could only **talk**. It never looked at real data, never checked if a dish was in stock, never added up a bill. A language model alone is a **brain in a jar** — brilliant, but with no hands. Phase 4 gives it hands, called **tools**. And the twist that surprises everyone:

> **Even with tools, the model still can't run anything. It only *asks* you to.**

## The mental model: a genius on the phone who can't reach your kitchen

Picture a brilliant chef helping you cook **over the phone.** They can't see or touch your kitchen:

- Chef: "Go check the fridge — any eggs?"
- **You** walk over, look, report back: "Yes, six."
- Chef: "Great, now check for butter."
- **You** check, report back.
- Chef: "Perfect — here's your omelette."

The chef is the **brain** (decides *what* to check and in *what order*). **You** are the **hands** (actually open the fridge, report what's there). The model is the chef. Your code is you. A **tool** is "open the fridge." That back-and-forth — *brain asks → hands do → brain asks again → … → final answer* — **is an agent.** Just a loop.

## The pieces, one at a time

- **Tool = a Python function + `@tool`.** A normal function marked with `@tool`. The model never sees the function's *body* — only its name, arguments, and **docstring**. So **the docstring IS the instruction the model reads** — writing it well is prompt engineering. Ours live in `app/tools.py` (`search_food_trucks`, `get_menu`, `check_wait_time`, …).
- **`bind_tools` = handing the model the menu.** `model.bind_tools([...])` makes the model *aware* the tools exist so it can ask for them. It runs nothing — like giving the chef a printed list of "things you may ask me to check."
- **`tool_calls` = the request slip.** When the model wants a tool it does NOT answer with text. Its reply has **empty `.content`** and a filled **`.tool_calls`**: "run THIS tool with THESE args, tagged with THIS id." A note, not the action.
- **`ToolMessage` + `tool_call_id` = the result, handed back and tagged.** You run the tool, wrap the result in a `ToolMessage`, and stamp it with the **same id** from the slip — so if the model asked for 3 tools at once, it matches each result to the right request (a coat-check ticket).
- **The loop:** invoke → got `tool_calls`? run each, append a `ToolMessage` → invoke again (now it can SEE the results) → repeat → stop when the model asks for **no** tool. That's `run_manual_tool_loop` in `app/agent.py`, plus a `max_steps` safety cap.

## Watch it run (real trace)

```
User: "Find a Korean food truck"

Step 1  invoke the model:
  ai.content    = ''                              ← empty! no text answer
  ai.tool_calls = [{name: "search_food_trucks",
                    args: {cuisine: "korean"},
                    id: "6d500bb9-..."}]           ← a request slip
        (it picked the tool + pulled "korean" using ONLY name+docstring)

Step 2  YOU run it:
  result = search_food_trucks({cuisine: "korean"})
         → [{truck_id: "koja-kitchen-sf-...", name: "KoJa Kitchen SF Spark", ...}]
         (real data from trucks.json — the model never touched the file)

Step 3  hand it back, tagged:
  ToolMessage(content=result, tool_call_id="6d500bb9-...")   ← same id as the slip

Step 4  invoke again with the result visible → model either asks for another
        tool (loop continues) or gives a normal answer with tool_calls EMPTY.
        Empty tool_calls = loop ends. That AIMessage.content is the answer.
```

## Is this "human in the loop"? No.

Common confusion, because I said "**you** run the tool." Here "you" = **your Python code**, running automatically inside the `for` loop — no person, no approval, no pause. It's an **autonomous agent loop**. In the phone analogy you're a **robot arm**, not a person deciding.

**Human-in-the-loop (HITL)** is a *different, deliberate* thing: insert a **real person** to review/approve/edit before a risky or irreversible action (place an order, pay, delete), so the loop **pauses** and waits for a human "yes."

| | Phase 4 loop | Human-in-the-loop |
|---|---|---|
| Who runs the tool? | your code, automatically | your code — but **after a person approves** |
| Pause for a human? | **no** | **yes** |
| Used for | reading data (search, menu, wait) | risky actions (order, pay, delete) |

Phase 5's `build_order_draft` *"presents an order draft for approval"* — the **seed** of HITL — but the current loop **can't actually pause** to collect that approval. That missing pause is one of the limitations in `LOOP_LIMITATIONS.md` that **LangGraph** fixes later with real `interrupt()` pauses. So: Phase 4 = no human; HITL = a later upgrade.

## One catch: not every model can do this

Tool-calling is a special model ability. **CreateAI** (text-in/text-out wrapper) and plain **`llama3`** ("does not support tools", HTTP 400) **can't**. So Phase 4 uses a **third** model, **`qwen3:4b`** (a reasoning model) via `get_tool_model()`. The project now runs three specialists: CreateAI (parsing), `bge-m3` (embeddings), `qwen3:4b` (tools). Right model for the right job.

## The whole phase in six sentences

1. Alone, a model only **talks**; **tools** let it reach real data — but it only **asks**, never runs them.
2. A **tool** is a `@tool` function; its **docstring is the instruction** the model reads.
3. **`bind_tools`** makes the model *aware* of tools (a menu); it executes nothing.
4. A tool request = **empty `.content` + filled `.tool_calls`** (a slip, not the action).
5. **You** run it and hand back a **`ToolMessage`** tagged by **`tool_call_id`** so results match requests.
6. An **agent is a while-loop**: ask → run → feed back → repeat, stop when no tool is asked — exactly what Phase 5's `create_react_agent` automates.

---

## Bonus: this loop is **ReAct** (Reasoning + Acting)

The pattern you built by hand has a name: **ReAct = Reasoning + Acting.** The model alternates thinking and doing, one step at a time, using each result to decide the next move:

```
Thought      → what should I do next?          (Reason)
Action       → call a tool with some args      (Act)
Observation  → read the tool's result          (Observe)
   ↑ the observation feeds the NEXT thought ↓
Thought → Action → Observation → …
Final Answer → when it has enough, it stops calling tools
```

The whole power is that the **Observation feeds the next Thought** — the model doesn't plan all steps up front, it acts, sees what came back, then decides again. That's what lets it "search first (don't know the truck_id yet), THEN read that truck's menu."

**It maps exactly onto `run_manual_tool_loop`:**

| ReAct term | Your code |
|---|---|
| Thought | whatever the model does inside `model.invoke(messages)` |
| Action | the `AIMessage.tool_calls` it emits |
| Observation | the `ToolMessage` you append with the result |
| repeat | the `for step in range(max_steps)` loop |
| Final Answer | `AIMessage` with empty `tool_calls` → `break` |

**Two nuances:**
1. **Reasoning here is the model's hidden thinking.** The classic 2022 ReAct paper had the model literally print `Thought: I should search...` as text that the code parsed. Modern tool-calling models like `qwen3:4b` do it cleaner — the reasoning lives in hidden `<think>` blocks and the action comes back as a **structured `tool_calls`** object, not text to parse. Same pattern, tidier plumbing. (It's also *why* a "thinking" model chains steps well: its Thought step is genuinely strong.)
2. **Phase 5 is named after it.** `create_**react**_agent(...)` is this exact Thought→Action→Observation loop wrapped in one line. Doing Phase 4 by hand first is what makes it read as "oh, it's *my* loop, automated" instead of magic.

Caveat you'll feel in Phase 5: plain ReAct is *just a loop* — no forced tool order, no approval pause, no branching, no memory between runs. Those gaps are `LOOP_LIMITATIONS.md`, and they're exactly what pushes you to **LangGraph** later.
