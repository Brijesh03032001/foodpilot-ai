# Chapter 1 — LangChain Basics & the Phase 1 Workflow

This chapter covers the absolute fundamentals of LangChain, explained in plain English, then traces one real request through our actual Phase 1 code — showing the **exact** input and output at every single step, not a simplified/made-up version.

Goal of Phase 1 (from `FoodPilot_Master_Spec.md`): turn a sentence like `"I want spicy vegetarian food under $15"` into a validated, structured `FoodQuery` object your code can actually use.

---

## Part 1 — Basic LangChain terms, one at a time

**Model**
The AI itself. The thing you send text to, and it sends text back. In our code, this is `createai_model` (from `app/createai_llm.py`).

**Message**
A single unit of conversation. LangChain has three kinds we use:
- `SystemMessage` — instructions telling the model *how to behave* ("you are an extraction tool...")
- `HumanMessage` — what the user actually said
- `AIMessage` — what the model replied with

Think of these like labeled sticky notes in a conversation transcript: "System says: ...", "Human says: ...", "AI says: ...".

**Prompt Template**
A reusable fill-in-the-blank form that *produces* Messages. You give it your raw text, it gives you back a `SystemMessage` + `HumanMessage` pair, fully written out. Ours is `createai_prompt` in `app/chains.py`.

**Schema**
A strict description of what fields you want back, and what type each one is. We wrote ours as a Pydantic class, `FoodQuery`, in `app/schemas.py`. Think of it as a printed form with labeled boxes: "Diet (pick one: vegetarian/vegan/none)", "Max Price (a number)".

**Parser**
The tool that takes the model's raw text reply and turns it into a real object matching the Schema — checking types along the way, filling in defaults for anything missing. Ours is `_parser` (a `PydanticOutputParser`) in `app/chains.py`.

**Runnable**
The generic name LangChain gives to "a thing that can be run with `.invoke(input)` and gives you `output`." A Prompt Template is a Runnable. A Model is a Runnable. A Parser is a Runnable. This matters because it means **they're all interchangeable Lego pieces that speak the same language** — any one of them can plug into any other.

**The `|` pipe**
Connects two Runnables so the first one's output becomes the second one's input automatically. `A | B` means "run A, take what it produces, feed it straight into B."

**Chain**
Several Runnables piped together into one Runnable. Ours is `createai_parse_chain = createai_prompt | createai_model | _parser` — a 3-piece assembly line.

**`.invoke(...)`**
The actual "go" button. Nothing runs until you call `.invoke()` on a Runnable (or a Chain).

---

## Part 2 — The exact input and output at every step

Test sentence used throughout: `"I want spicy vegetarian food under $15"`

### Step 1: Prompt Template

**Runnable:** `createai_prompt`

**Input (exact):**
```python
{"text": "I want spicy vegetarian food under $15"}
```
A plain Python dictionary — one key, `text`, holding your sentence.

**Output (exact):** two Message objects — word for word, exactly what got produced:

```
--- SystemMessage ---
You extract structured food ordering preferences from a customer's message. Only fill in fields the customer actually mentioned or clearly implied. Leave everything else at its default.

The output should be formatted as a JSON instance that conforms to the JSON schema below.

As an example, for the schema {"properties": {"foo": {"title": "Foo", "description": "a list of strings", "type": "array", "items": {"type": "string"}}}, "required": ["foo"]}
the object {"foo": ["bar", "baz"]} is a well-formatted instance of the schema. The object {"properties": {"foo": ["bar", "baz"]}} is not well-formatted.

Here is the output schema:
```
{"description": "A customer's food request, parsed into structured fields.", "properties": {"diet": {"default": "none", "description": "Dietary restriction the customer mentioned, if any.", "enum": ["vegetarian", "vegan", "none"], "title": "Diet", "type": "string"}, "spice_level": {"anyOf": [{"enum": ["mild", "medium", "spicy"], "type": "string"}, {"type": "null"}], "default": null, "description": "How spicy the customer wants their food, if mentioned.", "title": "Spice Level"}, "max_price": {"anyOf": [{"type": "number"}, {"type": "null"}], "default": null, "description": "The maximum price in USD the customer is willing to pay, if mentioned.", "title": "Max Price"}, "cuisine": {"anyOf": [{"type": "string"}, {"type": "null"}], "default": null, "description": "The type of cuisine the customer wants, e.g. 'mexican', 'asian'.", "title": "Cuisine"}, "max_wait_min": {"anyOf": [{"type": "integer"}, {"type": "null"}], "default": null, "description": "Maximum wait time in minutes the customer will tolerate, if mentioned.", "title": "Max Wait Min"}, "min_protein_g": {"anyOf": [{"type": "number"}, {"type": "null"}], "default": null, "description": "Minimum grams of protein the customer wants, if mentioned.", "title": "Min Protein G"}}}
```

--- HumanMessage ---
I want spicy vegetarian food under $15
```

Notice something important: the **entire `FoodQuery` schema got typed out as plain text** inside the `SystemMessage`. That giant JSON blob is `app/schemas.py`'s `FoodQuery` class, automatically converted into a text description by the Parser (`_parser.get_format_instructions()`), then glued onto the template. The model never "sees" your Python class — it only ever sees this text description of it. That's the whole trick behind structured output for a model with no native schema support.

The `HumanMessage` is just your sentence, untouched.

### Step 2: The Model

**Runnable:** `createai_model`

**Input (exact):** the two Message objects from Step 1 — `[SystemMessage(...), HumanMessage(...)]`

**Output (exact):** one `AIMessage`, whose `.content` is this raw string — literally what CreateAI sent back over the network:

````
```json
{
  "diet": "vegetarian",
  "spice_level": "spicy",
  "max_price": 15
}
```
````

Look closely: this is **just text**. Not a Python object. Not validated. Not even guaranteed to be valid JSON — it just happens to look like JSON here, and the model even wrapped it in markdown code fences on its own, because that's a common pattern it picked up from training. Also notice: the model only filled in 3 of the 6 fields (`diet`, `spice_level`, `max_price`) — it left out `cuisine`, `max_wait_min`, `min_protein_g` entirely, because your sentence never mentioned them.

### Step 3: The Parser

**Runnable:** `_parser`

**Input (exact):** that raw `AIMessage` from Step 2, containing the fenced JSON-looking text above.

**Output (exact):** a real, validated `FoodQuery` Python object:

```python
FoodQuery(diet='vegetarian', spice_level='spicy', max_price=15.0, cuisine=None, max_wait_min=None, min_protein_g=None)
```

Two things happened here, invisibly, that are worth slowing down on:
1. The parser **stripped away the ```` ```json ```` fences** and pulled out just the `{...}` part before trying to read it as JSON.
2. The 3 fields the model never mentioned (`cuisine`, `max_wait_min`, `min_protein_g`) got **automatically filled with their default value (`None`)** — because `app/schemas.py` declared each of them as `= None` by default. The model didn't have to output every field; the Schema covers the gaps.

---

## The full picture, now that you've seen every stage

```
{"text": "I want spicy vegetarian food under $15"}          ← your input, a dict
        │  Step 1: createai_prompt.invoke(...)
        ▼
[SystemMessage(schema spelled out as text), HumanMessage(your sentence)]
        │  Step 2: createai_model.invoke(...)
        ▼
AIMessage(content = '```json\n{"diet": "vegetarian", ...}\n```')   ← still just TEXT
        │  Step 3: _parser.invoke(...)
        ▼
FoodQuery(diet='vegetarian', spice_level='spicy', max_price=15.0, cuisine=None, ...)   ← real Python object
```

Each arrow above is one `.invoke()` call. Running `createai_parse_chain.invoke({"text": ...})` does all three arrows automatically, back to back, because `|` already wired Step 1's output to be Step 2's input, and Step 2's output to be Step 3's input.

---

## Bonus: why two different structured-output paths exist in our code

`app/chains.py` actually has two parse chains, not one:

- **`ollama_parse_chain`** — uses `model.with_structured_output(FoodQuery)`. This works because Ollama models support **tool-calling**: the model itself understands "call this function with these arguments," so LangChain can hand it the schema directly and get structured data back natively — no separate Parser step needed at the end.
- **`createai_parse_chain`** — the one traced above. CreateAI's endpoint is plain text-in/text-out with no tool-calling, so the schema has to be spelled out as text inside the prompt, and a separate `PydanticOutputParser` at the end does the work of turning text back into an object.

Both end up at the same kind of result (a validated `FoodQuery`), but by two different mechanisms. `with_structured_output` is really just a shortcut that picks whichever mechanism the model supports — tool-calling when available, or the manual prompt+parse approach (what we built by hand for CreateAI) when it isn't.

---

## Key lesson to remember

A Schema (like `FoodQuery`) guarantees the **shape** of what comes back — right field names, right types, missing fields get sensible defaults. It does **not** guarantee the **content** is correct. A weaker model can hand back a perfectly shaped `FoodQuery` where the values are simply wrong (e.g. putting "vegetarian" in the `cuisine` field instead of `diet` — this really happened when we tested with the local `llama3` model). Validation and correctness are two different things.
