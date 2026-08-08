# Chapter 3 — Message History & Memory

Goal of Phase 3 (from `FoodPilot_Master_Spec.md`): a multi-turn concierge that remembers constraints stated across earlier turns — e.g. "healthy" → "no beef" → "under $15" → a recommendation that uses all three, not just the last thing said.

---

## Part 1 — New terms for Phase 3

**Session**
One continuous conversation with one customer, identified by a `session_id` (just a string you make up — could be a user ID, a browser tab ID, anything unique per conversation). Different `session_id`s never see each other's messages.

**Chat History**
Just a list of messages (`HumanMessage`, `AIMessage`, etc. — see Chapter 1) recorded in order. Nothing fancier than that. In our code, `InMemoryChatMessageHistory` is basically a labeled Python list living in RAM.

**`MessagesPlaceholder`**
A new kind of slot inside a Prompt Template — instead of filling in one piece of text like `{text}` does, it dumps an **entire list of past messages** into the conversation at that exact spot. It's how "everything said so far" gets physically inserted before your new message each turn.

**`RunnableWithMessageHistory`**
A wrapper you put *around* a chain. It doesn't change what the chain does — it just handles three chores automatically, before and after every `.invoke()`: look up this session's history, inject it into `chat_history`, and once the model replies, save both your new message and the reply back into that same history for next time.

**`config={"configurable": {"session_id": ...}}`**
The extra argument you pass to `.invoke()` so `RunnableWithMessageHistory` knows *which* conversation's history to load and save to. Swap the `session_id` and you're in a completely different, empty conversation.

---

## Part 2 — The exact trace, turn by turn, using a real run

### Before any turns

**`get_session_history("chapter3-demo").messages`** → `[]`

An empty list. Nothing has been said yet. This is the entire "memory" at this point — literally an empty Python list.

### Turn 1 — input: `"I want something healthy today"`

**What gets built and sent to the model** (via `CONVERSATION_PROMPT.invoke({"chat_history": [], "input": "..."})`, since history is still empty at this point):

```
[SystemMessage] You are FoodPilot's food ordering concierge. Have a natural back-and-forth...
[HumanMessage] I want something healthy today
```

Only 2 messages — the fixed system instruction, plus your one new message. `chat_history` contributed nothing yet because it was empty.

**Model replies:** *"Great! When you say healthy, do you have any specific preferences like low-calorie, high-protein..."*

**What `RunnableWithMessageHistory` does after this reply, automatically:** appends your `HumanMessage` AND the model's new `AIMessage` onto the session's list.

**History right after Turn 1** (`len=2`):
```
[HumanMessage] I want something healthy today
[AIMessage]    Great! When you say healthy, do you have any specific preferences like...
```

### Turn 2 — input: `"Also, no beef please"`

**What gets built and sent to the model this time** (now `chat_history` is NOT empty — it's the 2 messages from Turn 1):

```
[SystemMessage] You are FoodPilot's food ordering concierge. Have a natural back-and-forth...
[HumanMessage] I want something healthy today               ← replayed from history
[AIMessage]    Great! When you say healthy, do you have any specific preferences like...   ← replayed from history
[HumanMessage] Also, no beef please                          ← your new message
```

**4 messages sent this time**, not 2. The entire Turn 1 exchange got physically replayed into the prompt, word for word, via `MessagesPlaceholder("chat_history")`, and your new message got tacked on at the end. **This is the whole trick.** The model doesn't "remember" anything on its own between calls — every single call is stateless and self-contained. What looks like memory is really: *resend the entire transcript so far, every single time.*

**Model replies:** *"Got it! You want something healthy and without beef. Any other preferences..."* — notice it correctly carried forward "healthy" from Turn 1 even though Turn 2 never mentioned it again. That's only possible because Turn 1's exchange was right there in the prompt it just read.

**History right after Turn 2** (`len=4`):
```
[HumanMessage] I want something healthy today
[AIMessage]    Great! When you say healthy, do you have any specific preferences like...
[HumanMessage] Also, no beef please
[AIMessage]    Got it! You want something healthy and without beef. Any other preferences...
```

Two turns happened; history is now 4 messages. Every future turn will replay all 4, then add 2 more. **The conversation gets longer, and so does every single prompt sent to the model** — that's a real, growing cost, not just a mechanic.

(Full 4-turn run — adding "Keep it under $15" then "Ok what do you recommend?" — correctly summarized ALL three accumulated constraints on the final turn: "you want a healthy meal without beef, and the price should be under $15." See `memory.md` for the full transcript.)

---

## The full picture

```
Turn N input
        │
        ▼
get_session_history(session_id)  →  history.messages  (everything said so far, as a list)
        │
        ▼
CONVERSATION_PROMPT.invoke({"chat_history": history.messages, "input": Turn N text})
        │
        ▼
[SystemMessage, ...all past messages replayed..., HumanMessage(Turn N text)]
        │
        ▼
model.invoke(those messages)
        │
        ▼
AIMessage (Turn N reply)
        │
        ▼
RunnableWithMessageHistory appends BOTH HumanMessage(Turn N) and AIMessage(Turn N reply)
back onto history.messages, ready for Turn N+1
```

`conversational_concierge.invoke({"input": text}, config={"configurable": {"session_id": sid}})` does the entire loop above automatically, every call.

---

## Bonus 1: session isolation, proven

The same question — `"what did I tell you about beef?"` — asked with a **different** `session_id` that never saw the beef conversation got: *"You haven't mentioned anything about beef yet."* Correct — because `get_session_history("totally-different-session")` returns a completely separate, empty list. Sessions don't leak into each other; they're just different dictionary keys pointing at different lists.

## Bonus 2: the deprecation warning, explained

Running this prints: `LangChainDeprecationWarning: RunnableWithMessageHistory is deprecated. Use LangGraph's built-in persistence instead.` Now that the mechanism is visible, it's clear exactly *why* this is getting replaced: this whole system is an in-RAM Python dictionary (`_store` in `app/memory.py`). If the process crashes or restarts, **every conversation vanishes** — there's no disk, no database, nothing durable behind it. LangGraph's checkpointing (Phase 10+) is the same *idea* — replay past state into each step — but actually saved somewhere durable. This isn't a wrong way to do it; it's the honest, transparent version first, so the upgrade later makes sense instead of feeling like new magic.

## Key lesson to remember

**"Memory" is not the model remembering anything.** Every `.invoke()` call is completely stateless — the model has no idea Turn 1 ever happened unless Turn 1's messages are physically present in Turn 2's prompt. `RunnableWithMessageHistory` automates exactly one thing: re-sending the whole transcript so far, every time, so it *looks* continuous from your side of the conversation. That also means: the longer a conversation runs, the more text gets sent (and paid for, and processed) on every single turn — replaying history isn't free.

## Deliberate scope limit

This chain does NOT call the Phase 2 retriever — its final recommendation ("grilled chicken salad") isn't grounded in the real 635-item menu data, it's just the model's own knowledge. Phase 3 is scoped to memory mechanics only, per the spec; wiring memory + retrieval + tools together into something that actually acts is Phase 4/5's job.

---

# Explanation to a little kid

*(Same phase, told with pictures and no scary words. If the technical version above ever feels like a fog, read this first, then go back up — it'll click.)*

## The problem we're fixing

Real customers don't say everything in one shot. They dribble it out:

> "Something healthy." … "Oh, no beef." … "Under $15." … "Okay, what do you recommend?"

A good concierge holds **all four** in its head and uses them together on that last line. That's what Phase 3 builds. And the twist that surprises everyone: **the model can't remember anything at all.**

## The uncomfortable truth: the model has amnesia

> A language model is a **brilliant consultant with total amnesia.** The instant it finishes answering, it forgets the whole conversation ever happened. Next question? Blank slate.

The proper word is **stateless** — "state" means "memory of what came before," and the model keeps **none** of it. Every `.invoke()` is a fresh, self-contained event. Send it "no beef" on its own and it replies "no beef in *what*?" — because to it, nothing came before.

So how does it *seem* to remember? A cheeky trick:

> **You re-tell it the whole conversation, from the top, every single time.**

The amnesiac consultant gets a **notebook** slid across the table with the entire transcript so far. They read it top to bottom, answer as if they'd been here all along, then forget again. You write their new answer into the notebook and slide it back for next round. **Memory isn't the model remembering — it's you re-sending the notebook.**

## The pieces, one at a time

- **Chat History = the notebook.** Just a list of messages in order (`HumanMessage`, `AIMessage`, …). In code it's `InMemoryChatMessageHistory` — a labeled Python list in RAM.
- **Session (`session_id`) = which notebook.** Many customers talk at once; each needs its own notebook so they don't mix. `session_id` is any unique string (user ID, tab ID, `"chapter3-demo"`). Your `_store` dict is a **shelf of notebooks**; ask for one that doesn't exist and it hands you a fresh blank.
- **`MessagesPlaceholder` = the slot where the notebook gets poured in.** In Phase 1, `{text}` was a slot for *one string*. `MessagesPlaceholder("chat_history")` is a slot for an **entire list of past messages**, dropped into the prompt right before your new line.
- **`RunnableWithMessageHistory` = the secretary.** A wrapper around your chain that does the boring bookkeeping automatically every turn: open the right notebook, pour it into `chat_history`, run the chain, then write BOTH the new question and the new answer back into the notebook.
- **`config={"configurable":{"session_id": ...}}` = the name tag** you hand the secretary so it knows which notebook to open.

## Watch it happen (real run)

```
Before anything:  history = []                         (empty notebook = the whole memory)

Turn 1  you: "I want something healthy today"
  prompt sent = [System] + [your line]                 → 2 messages
  reply: "Great! any preferences — low-cal, high-protein?"
  secretary writes both lines →  history = 2 messages

Turn 2  you: "Also, no beef please"
  prompt sent = [System] + [Turn-1 human] + [Turn-1 AI] + [your new line]   → 4 messages
                              └─ the notebook, replayed word-for-word ─┘
  reply: "Got it — healthy AND no beef."               ← carried "healthy" forward!
  secretary writes both lines →  history = 4 messages
```

You only **typed** "no beef." The model **received** the whole story. It didn't remember "healthy" — Turn 1 was physically sitting in the prompt it just read. **That is the entire trick.**

## Two things that fall right out of it

1. **Sessions never leak.** Ask "what did I say about beef?" under a *different* `session_id` → "You haven't mentioned beef." Different key → different, empty notebook. Isolation is just what separate notebooks *are*.
2. **Every turn costs more.** Turn 1 sent 2 messages, Turn 2 sent 4, Turn 10 re-sends everything from turns 1–9 plus the new line. The transcript grows, so every prompt grows — re-sending history isn't free.

That second point is *why* the code prints `RunnableWithMessageHistory is deprecated. Use LangGraph's built-in persistence instead.` The notebook here is an **in-RAM dict** — restart the program and every conversation vanishes — and it blindly re-sends the whole growing transcript forever. LangGraph (Phase 10+) keeps the same idea but saves it **durably** and manages it smarter. We built the honest, see-through version first on purpose.

## What this phase deliberately skips

The concierge never calls the Phase 2 retriever, so its recommendation ("grilled chicken salad") comes from the model's own head, **not** your real 635-item menu. Phase 3 is memory mechanics **only**. Wiring memory + retrieval + real actions together is Phase 4/5.

## The whole phase in six sentences

1. A model is **stateless** — it remembers nothing between calls; every `.invoke()` is a blank slate.
2. "Memory" is a trick: **re-send the whole transcript every turn** so it *looks* continuous.
3. **Chat History** is a list of messages; **Session** (`session_id`) picks which list — `_store` is a shelf of notebooks.
4. **`MessagesPlaceholder`** is the prompt slot where that list gets poured back in before your new message.
5. **`RunnableWithMessageHistory`** is the secretary that auto-loads the notebook, injects it, and writes the new Q + A back after each turn.
6. Consequences: sessions stay isolated, and every turn costs more — which is *why* it's deprecated in favor of durable LangGraph persistence later.
