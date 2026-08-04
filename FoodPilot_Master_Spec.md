# 🌮 FoodPilot AI — Master Project Specification & Learning Guide

> **A single project that takes you from LangChain beginner → LangGraph → production-grade Agentic AI.**
> You don't learn abstractions because a tutorial told you to. You learn them because *FoodPilot forces you to hit the exact problem each abstraction solves.*

---

## 0. How to use this document

This is both a **spec** (what to build in each phase) and a **teaching guide** (what to learn and *why* each abstraction exists). Read it top to bottom once, then live in Section 7 (the phases) as you build.

Each phase is written in the same template so you always know where to look:

- **🎯 Goal** — the one sentence that defines the phase.
- **🧠 What you'll learn** — the concepts, and critically *why the abstraction exists*.
- **🗂️ Schema slice** — which entities from Section 5 this phase touches.
- **📦 Data needed** — what data to load (see Section 6).
- **🛠️ Build** — the functions/tools/graph nodes to write.
- **✅ Milestone (definition of done)** — how you know you're finished.
- **🔍 Learning checkpoint** — questions you should be able to answer before moving on. If you can't, you didn't really learn it — rebuild until you can.

**Rule of the whole project:** terminal-first. No React, no FastAPI, no cloud until a phase *forces* it (Phase 7 for a DB, optional web UI only after Phase 11). The product exists to generate AI problems, not to be a startup.

---

## 1. Project vision

**FoodPilot AI = DoorDash/Yelp for food trucks + an AI concierge for customers + an AI operations copilot for truck owners.**

Two sides, one agentic backend:

```text
                    FOODPILOT AI

        CUSTOMER                     FOOD TRUCK OWNER
            │                              │
            ▼                              ▼
     AI Food Concierge              AI Business Copilot
            │                              │
      ┌─────┼─────┐                ┌───────┼────────┐
      ▼     ▼     ▼                ▼       ▼        ▼
   Search  Menu  Order          Inventory Sales   Reviews
      │     │     │                │       │        │
      └─────┴─────┘                └───────┴────────┘
            │                              │
            └──────────────┬───────────────┘
                           ▼
                     Agentic Backend
```

You are **not** building "a food chatbot using LangChain." You are building **an AI-native operating platform for mobile food businesses**, and using it as a forcing function to learn the entire modern agent stack.

**The two realism anchors that make this domain special (never lose these):**

1. **Food trucks move.** Location is time-scoped (`Schedule`), not a static address.
2. **Things sell out.** Availability and inventory change over time and *per truck* — which is exactly why later phases need persistent, mutable state (and therefore LangGraph).

---

## 2. Prerequisites (what you already know)

You are starting with: **RAG, LLM inference, basic transformer understanding, tool calling.**

That means this guide **skips the "what is an embedding" material** and focuses on *how LangChain packages these ideas* and *how LangGraph controls their execution*. Where a phase touches something you already know (e.g. RAG in Phase 2), the goal is the **framework abstraction**, not the concept.

---

## 3. The learning arc

Two frameworks, two different jobs:

- **LangChain** = composable **building blocks** (models, prompts, retrievers, tools) glued with **LCEL** (the `|` pipe). You *describe a pipeline*.
- **LangGraph** = controllable **execution** (state, branching, loops, pausing, persistence). You *describe a state machine*.

The single most important shift in the whole project happens around Phase 9–10: you will *feel* LangChain stop being enough, and that pain is the entire point.

```text
LangChain land                          LangGraph land
──────────────────────────────►  ────────────────────────────►

P1  Models + LCEL + structured output
P2  Retrievers (RAG as an abstraction)
P3  Message history / memory
P4  Tool binding + the manual tool loop
P5  First agent (FEED ME) + its ceiling   ◄── the wall starts here
P6  Structured output under pressure
────────────────────────────────────────
P7  Owner Copilot (SQL + RAG tools)
P8  Review intelligence (RAG at scale)
P9  Multi-step reasoning → LangChain ceiling
────────────────────────────────────────
P10 LangGraph: state, nodes, edges
P11 Conditional edges, loops, HITL, checkpointing
P12 Multi-agent (supervisor)
P13 MCP + evals + guardrails
```

**Pacing (given your background):** move fast through 1–4 (days — API familiarization), slow *way* down on 5, 9, 10, 11 (the real conceptual leaps), treat 12–13 as "when the single agent gets boring."

---

## 4. Repo structure & setup

Keep it tiny for weeks:

```text
foodpilot/
│
├── app/
│   ├── llm.py          # model wrappers, provider config
│   ├── prompts.py      # ChatPromptTemplates
│   ├── schemas.py      # Pydantic models (Section 5)
│   ├── chains.py       # LCEL chains
│   ├── tools.py        # @tool functions
│   ├── retrievers.py   # vector store + retriever setup
│   ├── graph.py        # LangGraph state machine (from Phase 10)
│   └── memory.py       # message history / checkpointer config
│
├── data/
│   ├── trucks.json
│   ├── menu_items.json
│   ├── modifiers.json
│   ├── ingredients.json
│   ├── recipes.json
│   ├── stock.json
│   ├── schedule.json
│   ├── orders.json      # appended at runtime
│   └── reviews.json
│
├── experiments/        # scratch notebooks / one-off scripts
├── evals/              # test sets (from Phase 13)
├── main.py             # terminal entry point
├── requirements.txt
└── .env                # API keys — never commit
```

**Setup checklist:**

- Python 3.11+, a virtualenv.
- `pip install langchain langchain-openai langchain-community langgraph pydantic chromadb python-dotenv` (add provider packages as needed; API surfaces move fast — check current docs for exact import paths).
- Keys in `.env`, loaded with `python-dotenv`. Never hardcode.
- Data layer starts as **JSON files loaded into memory** (Section 5.6). SQLite arrives only when Phase 7/9 forces it.

---

## 5. Data model / schema

Design principle #1: **the schema maps 1:1 to JSON now and to SQL later.** Each entity = one JSON array now = one table later. Foreign keys are just id strings you resolve in code.

Design principle #2: **snapshot mutable values.** Orders freeze the price they charged (`unit_price`), because menu prices change and history must stay truthful.

Design principle #3: **time-scoped state.** `OperatingHours`, `StockLevel`, `is_available` all change over time — the seed of why Phase 9+ needs persistent state.

Design principle #4 (from the real Yelp data): **scraped fields are sparse — required fields must be optional.** In the 107-truck SF dataset, `rating` is null on 10 trucks, `phone` on 18, `price` on 58, `openingHours` on 14, and `owner_id`/`avg_prep_time_min` on all. The schema below makes every scraped-but-sparse field optional so real data loads without crashing, and treats "open right now" as **derived** from `operating_hours`, not a stored flag.

> **Location note:** for now the truck location is **fixed** (a truck sits at one address with weekly `operating_hours`). The date-based moving `Schedule` from the original design (a truck parking at different corners by date) is **deferred** — reintroduce it later when you want the "trucks move" realism back. Until then, `operating_hours` (which days/times a truck is open) is the time-scoped field that matters.

### 5.1 Entity relationship map

```text
                          OWNER (vendor account)
                            │ owns 1..*
                            ▼
   CUSTOMER            FOOD_TRUCK ──────────── OPERATING_HOURS (weekly, per day)
      │                   │  │  │               (fixed location for now)
      │ places            │  │  └── has *  MENU_ITEM ──< MODIFIER_GROUP ──< MODIFIER
      │                   │  │                 │
      │                   │  │                 │ made of (recipe / BOM)
      ▼                   │  │                 ▼
    ORDER ──────────────► │  │            RECIPE_LINE ──► INGREDIENT ◄── STOCK_LEVEL
      │  at truck         │  │                                │            (per truck)
      │ contains *        │  │                                ▼
      ▼                   │  │                            SUPPLIER (restock source)
  ORDER_ITEM ──< ORDER_ITEM_MOD
      │
      │ after fulfillment
      ▼
   REVIEW ──► (derived: sentiment, topics)
```

### 5.2 Tier 1 — Core (Phases 1–6, lives in JSON)

```python
from pydantic import BaseModel, Field
from decimal import Decimal
from datetime import datetime, date, time
from typing import Literal

class GeoPoint(BaseModel):
    lat: float
    lng: float

class Address(BaseModel):               # from Yelp scrape
    street: str | None = None
    city: str | None = None
    region: str | None = None           # "CA"
    postal_code: str | None = None
    country: str | None = None
    formatted: str | None = None        # raw "601 Mission Bay Blvd N, SF, CA, 94158"

class TimeWindow(BaseModel):
    start: time                         # 11:00
    end: time                           # 15:00

class OperatingHours(BaseModel):
    # one entry per OPEN day; a day absent from the dict = closed that day;
    # a list with >1 window = split shift (e.g. lunch 11-15 AND dinner 17-21)
    hours: dict[
        Literal["mon","tue","wed","thu","fri","sat","sun"],
        list[TimeWindow]
    ]

class Owner(BaseModel):
    id: str
    name: str
    email: str
    phone: str | None = None
    truck_ids: list[str]

class FoodTruck(BaseModel):
    id: str
    owner_id: str | None = None                    # null in scrape; synthesized for demo
    name: str                                      # "TacoNova"
    cuisines: list[str] = []                       # normalized lowercase ["mexican","tacos"]
    description: str
    rating: float | None = None                    # 10/107 null in real data; int-or-float
    review_count: int | None = None                # NEW — from Yelp
    price_tier: Literal["$","$$","$$$","$$$$"] | None = None   # NEW — Yelp band (58 null)
    status: Literal["open","offline"] | None = None  # manual override; prefer is_open_now()
    avg_prep_time_min: int | None = None           # not scraped; generated for demo
    location: GeoPoint | None = None               # FIXED for now (was current_location)
    address: Address | None = None                 # NEW — structured postal address
    operating_hours: OperatingHours | None = None  # NEW — weekly recurring hours (some days closed)
    service_radius_km: float | None = None         # optional; fixed-location trucks rarely use it
    phone: str | None = None                       # 18/107 null in real data
    image_url: str | None = None                   # Yelp photo
    source_url: str | None = None                  # NEW — Yelp provenance link
    payment_methods: list[str] = []                # ["card","cash","mobile"]
    order_type: list[str] = []                     # ["pickup"] or ["pickup","delivery"]
    current_queue_min: int | None = None           # LIVE — orders ahead right now; null while offline
    amenities: list[str] = []                      # seating_available, kid_friendly, dog_friendly,
                                                    # wifi_available, wheelchair_accessible, catering_available
    delivery_fee: Decimal | None = None            # null unless "delivery" in order_type
    driver_assignment_min: int | None = None       # avg time to assign a driver once food's ready; delivery only
    avg_delivery_time_min: int | None = None       # avg driver travel time to customer; delivery only
    # NOTE: current_queue_min is the live wait field from Phase 4 (check_wait_time
    # tool). avg_prep_time_min above is only a static average, not a live wait.
    #
    # ETA formulas (Phase 4/5 tools):
    #   pickup_eta_min   = menu_item.prep_time_min (fallback: avg_prep_time_min) + current_queue_min
    #   delivery_eta_min = pickup_eta_min + driver_assignment_min + avg_delivery_time_min

class MenuItem(BaseModel):
    id: str
    truck_id: str
    name: str                       # "Spicy Paneer Taco"
    category: str                   # "taco", "drink", "side"
    description: str
    base_price: Decimal
    currency: str = "USD"
    dietary_tags: list[Literal["vegetarian","vegan","gluten_free","halal","dairy_free"]]
    allergens: list[str]            # ["dairy", "nuts"] — CANONICAL, derived from RecipeLine ingredients
    spice_level: Literal["none","mild","medium","hot"]   # CANONICAL spice (FoodQuery filters on this)
    calories: int | None = None
    protein_g: float | None = None  # powers "high-protein" FEED ME
    prep_time_min: int
    is_available: bool              # derived: == (availability_status != "out_of_stock")
    popularity_score: float = 0.0   # for ranking
    labels: list[str] = []          # derived: spicy / vegetarian / high_protein / bestseller / new
    image_url: str | None = None    # photo (null until real images added)
    spice_score: int = 0            # derived numeric mirror of spice_level (0-10), for ranking only
    base_ingredients: list[str] = []        # derived DISPLAY view of RecipeLine (names, no quantities)
    removable_ingredients: list[str] = []   # derived: base_ingredients that map to a "remove" Modifier
    add_ons: list["AddOn"] = []             # derived view of add-type Modifiers (see canonical rule below)
    availability_status: Literal["in_stock","limited","out_of_stock"] = "in_stock"  # CANONICAL availability
    available_days: list[Literal["mon","tue","wed","thu","fri","sat","sun"]] | None = None
    # SOURCE-OF-TRUTH (see §5.9):
    #  - availability_status is canonical; is_available is a derived bool.
    #  - spice_level is canonical; spice_score is a derived number.
    #  - RecipeLine is canonical for composition; base_/removable_ingredients are derived views.
    #  - Modifier/ModifierGroup is canonical for customization; add_ons is a derived view of adds.
    #  - operating_hours (truck) gates availability; available_days only NARROWS within it (truck wins).
    #    available_days absent = offered every day the truck is open (per §5 design principle #4).

class AddOn(BaseModel):             # only the derived MenuItem.add_ons view uses this
    name: str                       # "extra cheese"
    price: Decimal

# CANONICAL customization model. Modifiers cover add / remove / substitute plus
# group constraints (required, min/max). Phase 6 (natural-language modifications)
# reads THIS, not MenuItem.add_ons. add_ons is just the add-type rows flattened.
class ModifierGroup(BaseModel):
    id: str
    menu_item_id: str
    name: str                       # "Add-ons", "Choose protein"
    required: bool
    min_select: int
    max_select: int

class Modifier(BaseModel):
    id: str
    group_id: str
    name: str                       # "Avocado", "No onion"
    price_delta: Decimal            # +2.00, or 0.00 for removals
    action: Literal["add", "remove", "substitute"]

class Customer(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    dietary_preferences: list[str] = []
    allergies: list[str] = []
    favorite_truck_ids: list[str] = []
    default_location: GeoPoint | None = None
    created_at: datetime | None = None   # join date
    order_count: int = 0                  # computed from orders
```

### 5.3 Tier 2 — Operational (Phases 7–9, moves to SQLite)

```python
class Order(BaseModel):
    id: str
    customer_id: str
    truck_id: str
    status: Literal["pending","confirmed","preparing","ready","completed","cancelled"]
    created_at: datetime
    estimated_ready_at: datetime | None = None
    subtotal: Decimal
    tax: Decimal
    tip: Decimal
    total: Decimal
    payment_status: Literal["unpaid","paid","refunded"]

class OrderItem(BaseModel):
    id: str
    order_id: str
    menu_item_id: str
    quantity: int
    unit_price: Decimal             # SNAPSHOT at order time (prices change!)
    line_total: Decimal
    special_instructions: str | None = None

class OrderItemMod(BaseModel):
    order_item_id: str
    modifier_id: str
    price_delta: Decimal

class Review(BaseModel):
    id: str
    order_id: str                   # ties review to a real order = trustworthy
    truck_id: str
    customer_id: str
    rating: int                     # 1..5
    text: str
    created_at: datetime
    # derived at Phase 8, written back:
    sentiment: Literal["positive","neutral","negative"] | None = None
    topics: list[str] | None = None # ["wait_time","portion","price"]
```

### 5.4 Tier 3 — Inventory & supply (Phase 9, the LangGraph payoff)

```python
class Ingredient(BaseModel):
    id: str
    name: str                       # "paneer"
    unit: Literal["kg","lb","g","unit","liter"]
    allergen_flags: list[str] = []

class RecipeLine(BaseModel):        # bill of materials: item → ingredients
    menu_item_id: str
    ingredient_id: str
    quantity: Decimal               # 0.15 kg paneer per taco
    unit: str

class StockLevel(BaseModel):        # inventory is PER TRUCK
    truck_id: str
    ingredient_id: str
    quantity_on_hand: Decimal
    reorder_threshold: Decimal
    updated_at: datetime

class Supplier(BaseModel):
    id: str
    name: str
    ingredient_id: str
    price_per_unit: Decimal
    lead_time_days: int
    min_order_qty: Decimal

# NOTE: Schedule (date-based moving location) is DEFERRED — location is fixed for now.
# Weekly recurring hours live on FoodTruck.operating_hours (Tier 1) instead.
# Reintroduce this when you want the "trucks move to different corners by date" realism.
class Schedule(BaseModel):          # DEFERRED — where the truck is, by day
    truck_id: str
    date: date
    location: GeoPoint
    location_name: str              # "Mill Ave & 5th"
    start_time: time
    end_time: time
```

### 5.5 Derived / runtime objects (not persisted)

These are the structured outputs the LLM produces — they're schemas too, and half the project is getting the model to emit them correctly.

```python
class FoodQuery(BaseModel):         # Phase 1: parsed customer intent
    diet: Literal["vegetarian","vegan","none"] = "none"
    spice_level: Literal["mild","medium","spicy"] | None = None
    max_price: float | None = None
    cuisine: str | None = None
    max_wait_min: int | None = None
    min_protein_g: float | None = None

class Modification(BaseModel):      # Phase 6: one modification instruction
    quantity: int
    add: list[str] = []
    remove: list[str] = []
    condition: str | None = None    # "price <= 2"

class OrderDraft(BaseModel):        # Phase 5/6: proposed order before approval
    truck_id: str
    items: list["OrderDraftItem"]
    estimated_total: Decimal
    estimated_wait_min: int
    reasoning: str

class OrderDraftItem(BaseModel):
    menu_item_id: str
    quantity: int
    modifications: list[Modification] = []
```

### 5.6 Derived helpers (compute, don't store)

Some "fields" are better computed than stored. The most important: **is the truck open right now?** — a function of `operating_hours` + current time, not a stale scraped flag.

```python
_WEEKDAYS = ["mon","tue","wed","thu","fri","sat","sun"]

def is_open_now(truck: FoodTruck, now: datetime) -> bool:
    if not truck.operating_hours:
        return False
    day = _WEEKDAYS[now.weekday()]                      # Monday=0
    windows = truck.operating_hours.hours.get(day, [])  # day absent = closed
    t = now.time()
    return any(w.start <= t <= w.end for w in windows)  # handles split shifts
```

Your concierge (Phase 4/5) calls this for "available right now" instead of trusting `status`. Same idea powers `next_open_time(truck)` and "is X on the menu right now" (`MenuItem.is_available`).

### 5.7 Real-data reconciliation (Yelp SF → schema)

How the 107-truck `foodtrucks-sf.json` maps onto the schema:

| Yelp field | → schema | Notes |
|---|---|---|
| `id`, `name`, `description` | same | `description` is low quality (name+address); regenerate later |
| `cuisines` | `cuisines` | normalized lowercase; **drop `categories`** (display-case duplicate) |
| `rating` / `reviewCount` | `rating` / `review_count` | both nullable |
| `price` | `price_tier` | `$`/`$$`/`$$$`; 58 null |
| `phone` | `phone` | 18 null |
| `latitude`+`longitude` / `current_location` | `location` (GeoPoint) | fixed for now |
| `address`,`streetAddress`,`city`,`region`,`postalCode`,`country` | `address` (Address) | — |
| `openingHours` (`"Monday 11:00-15:00"` strings) | `operating_hours` | parse to weekday→`[TimeWindow]`; multiple/day = split shift |
| `image` | `image_url` | — |
| `url` / `mapUrl` | `source_url` | provenance |
| `owner_id`,`avg_prep_time_min`,`service_radius_km` | same | null in scrape; synthesized for demo |
| — | `current_queue_min`,`amenities`,`delivery_fee`,`driver_assignment_min`,`avg_delivery_time_min` | not scraped; synthesized for demo |
| `status` | `status` | keep as override; prefer `is_open_now()` |

### 5.8 Source of truth — canonical vs derived fields

Some questions can be answered by more than one field. To keep the agent unambiguous, **each question has exactly one canonical field; the others are derived convenience mirrors** kept consistent by `generate_data.py` / `backfill_fields.py`. Phase code should read the canonical field and treat the mirrors as read-only.

| Question | ✅ Canonical | Derived mirror(s) | Rule |
|---|---|---|---|
| Is it sold out? | `MenuItem.availability_status` (`in_stock`/`limited`/`out_of_stock`) | `is_available` (bool) | `is_available == (availability_status != "out_of_stock")` |
| How spicy? | `MenuItem.spice_level` (enum; `FoodQuery` filters this) | `spice_score` (0–10) | score is a numeric mirror for ranking only |
| What's in the dish? | `RecipeLine` (BOM, ingredient **+ quantity**; Phase 9 needs quantities) | `base_ingredients` (names only) | base_ingredients = the RecipeLine ingredient names |
| What can I add / remove / swap? | `Modifier` / `ModifierGroup` (add/remove/substitute + required/min/max) | `add_ons`, `removable_ingredients` | add_ons = add-type modifiers; removable = base ∩ remove-modifiers. **Phase 6 reads Modifiers.** |
| When is it available? | `FoodTruck.operating_hours` (truck) | `MenuItem.available_days` (item) | truck hours gate; available_days only *narrows*. Orderable ⇔ truck open now **and** (available_days is None or today ∈ it) |

Why keep the mirrors at all? They're cheap denormalized reads (e.g. show `spice_score` on a card without a lookup), and they already exist in the data. The discipline is: **write/decide against the canonical field, read mirrors freely.**

```python
def is_item_orderable(item: MenuItem, truck: FoodTruck, now: datetime) -> bool:
    if item.availability_status == "out_of_stock":      # canonical availability
        return False
    if not is_open_now(truck, now):                     # truck hours gate (§5.6)
        return False
    if item.available_days is not None:                 # optional per-item narrowing
        return _WEEKDAYS[now.weekday()] in item.available_days
    return True
```

### 5.9 The JSON data layer

Start with **no database.** Each entity is a JSON array in `data/`. Your tools filter these lists in Python. This carries you cleanly through Phases 1–8.

**When JSON stops being enough (and why):**

- **Aggregation (Phase 7):** "revenue this week, top item by order share" = grouping/summing over thousands of orders. One `GROUP BY` in SQL vs a hand-written loop every time in JSON. Annoying but doable.
- **Mutable persistent state (Phase 9+):** the inventory agent *decrements* stock; order status moves through its lifecycle. Rewriting a whole JSON file on every change means no transactions and corruption risk on crash/concurrent writes. **This is the break point.**

**The upgrade is painless:** SQLite is still one file, zero server — same mental model as JSON, but real queries and safe writes. Path:

```text
Phases 1–8   →  JSON files (start today)
Phase 7      →  optionally SQLite for orders/sales (analytics)
Phase 9+     →  SQLite for anything the agent mutates (stock, order state)
```

Let the pain tell you when to move — same philosophy as the LangChain→LangGraph jump.

---

## 6. Data sources

**Principle:** control-heavy early phases → synthesize; realism-heavy phases → use real data.

| Phase | Data | Source & why |
|-------|------|--------------|
| 1–6 | Trucks, menus, modifiers | **Trucks = real** (`foodtrucks-sf.json`, 107 SF trucks scraped from Yelp — mapped to schema). **Menus = generated** but *cuisine-matched to each real truck* (a Mexican truck gets tacos/burritos; multi-cuisine trucks blend both), since you need clean `dietary_tags`/`spice_level`/`price`/`is_available` that Yelp doesn't provide. See `generate_data.py`. |
| 7 | Orders, sales | **Synthesize** into SQLite (you control patterns like "paneer sells out at lunch"). Seed from Kaggle **"Restaurant orders" / "Food delivery"** datasets. |
| 8 | Reviews | **Real, messy language needed.** **Yelp Open Dataset** (best fit — real restaurant reviews + ratings). Or **Amazon Reviews, McAuley Lab UCSD**, "Grocery & Gourmet Food" (huge, on HuggingFace) for volume. |
| 9 | Recipes / ingredients / nutrition | **Food.com Recipes** or **RecipeNLG** (item → ingredients) + **USDA FoodData Central** API (nutrition, powers `protein_g`). |
| 9, 11+ | External demand signals | **Open-Meteo** (weather, no API key), **Ticketmaster Discovery API** / **PredictHQ** (local events), **Google Places** / **OpenStreetMap Overpass** (truck locations). |

**The trap to avoid:** don't spend week one wrangling a giant real dataset. A hand-crafted 3-truck / ~20-item menu with clean fields teaches you more, faster, than fighting a messy CSV. Pull Yelp only when Phase 8 needs 5,000 real reviews.

> ⚠️ Licensing/limits (Yelp terms, API free tiers) change — verify current terms before building on them.

---

## 7. The phases

---

### Phase 1 — Chat models + LCEL + structured output

**🎯 Goal:** Convert `"I want spicy vegetarian food under $15"` into a validated `FoodQuery` object.

**🧠 What you'll learn**

- `ChatOpenAI` / `ChatAnthropic` — the model wrapper, and *why* LangChain wraps it: a uniform interface across providers so you can swap models without rewriting.
- `ChatPromptTemplate.from_messages([...])` — system/human/ai roles as templates with `{variables}`.
- **LCEL** — the `|` pipe that composes `Runnable`s: `prompt | model | parser`. The key idea: a call becomes *a value you can compose*.
- `.with_structured_output(FoodQuery)` — **the central lesson.** You don't prompt "return JSON"; you bind a Pydantic schema and LangChain handles parsing + validation + retry.

*Why the abstraction exists:* without LCEL + structured output you'd hand-roll string formatting, `json.loads`, and validation on every call. LCEL makes a pipeline declarative and reusable.

**🗂️ Schema slice:** `FoodQuery`.

**📦 Data needed:** none yet (pure intent parsing).

**🛠️ Build**

```text
app/llm.py       → model factory
app/prompts.py   → intent-extraction prompt
app/schemas.py   → FoodQuery
app/chains.py    → parse_chain = prompt | model.with_structured_output(FoodQuery)
main.py          → read stdin, print FoodQuery
```

```python
chain = prompt | model.with_structured_output(FoodQuery)
chain.invoke({"text": "spicy veg under $15"})
# → FoodQuery(diet='vegetarian', spice_level='spicy', max_price=15.0)
```

**✅ Milestone:** terminal text in, correct `FoodQuery` object out, for 5+ varied phrasings.

**🔍 Learning checkpoint**
- What does the `|` operator actually return? (A `Runnable`.)
- What happens when the model returns malformed output under `with_structured_output`?
- Why is a Pydantic schema better than parsing JSON yourself?

---

### Phase 2 — Retrievers (RAG as a LangChain abstraction)

**🎯 Goal:** Given a `FoodQuery`, return matching menu items with reasoning.

**🧠 What you'll learn** (you know RAG — this is about the *abstraction*)

- `Document(page_content=..., metadata={...})` — the universal unit. One menu item = one Document; price/diet/truck live in metadata.
- Vector store as a **retriever**: `vectorstore.as_retriever(search_kwargs={"filter": {...}})`.
- **Metadata filtering — the real lesson:** semantic search finds "spicy Asian"; the *filter* enforces "under $15." You need both.
- The RAG chain as LCEL: `{"context": retriever, "question": passthrough} | prompt | model`.

*Why the abstraction exists:* a `retriever` is swappable (Chroma today, pgvector later) without touching the chain. Interchangeability is what LangChain buys you.

**🗂️ Schema slice:** `MenuItem` (embedded as Documents), `FoodQuery`.

**📦 Data needed:** `menu_items.json` embedded into a vector store (Chroma). Metadata = `{truck_id, price, dietary_tags, spice_level, category}`.

**🛠️ Build**

```text
app/retrievers.py → build_menu_vectorstore(), get_menu_retriever(filters)
app/chains.py     → recommend_chain (retriever → prompt → model)
```

```text
FoodQuery → retriever.invoke(query, filter=...) → [Documents] → prompt → model → answer
```

**✅ Milestone:** `"no meat, spicy Asian, $20"` → three real menu items + why each fits.

**🔍 Learning checkpoint**
- Why isn't semantic similarity alone enough to respect a budget?
- What goes in `page_content` vs `metadata`, and why does that choice matter for filtering?
- How would you swap Chroma for another store without changing the chain?

---

### Phase 3 — Message history / memory

**🎯 Goal:** A multi-turn concierge that remembers "no beef" and "$15" across turns.

**🧠 What you'll learn**

- `MessagesPlaceholder("chat_history")` — where prior turns get injected into the prompt.
- `RunnableWithMessageHistory` — the current way to attach per-session history (the old `ConversationBufferMemory` classes are legacy; learn the modern approach).
- Session-scoped history keyed by `session_id`.
- **The honest lesson:** "memory" is just *you appending messages to a list and replaying them*. No magic.

*Why this matters later:* this demystifies memory and sets up why LangGraph's checkpointed state is a genuine upgrade — right now your "state" evaporates when the process dies.

**🗂️ Schema slice:** none new (conversation is transient); optionally read `Customer.dietary_preferences`.

**📦 Data needed:** same menu store as Phase 2.

**🛠️ Build**

```text
app/memory.py → session store (dict of session_id → message list)
app/chains.py → conversational recommend chain wrapped with history
```

```text
history: [Human "healthy", AI "restrictions?", Human "no beef", ...]
              │  injected via MessagesPlaceholder
              ▼
        model sees full context
```

**✅ Milestone:** a back-and-forth where constraints accumulate (healthy → no beef → $15 → recommendation). Note the friction of passing history around — remember it for Phase 10.

**🔍 Learning checkpoint**
- Where does the conversation actually *live*? What happens when the process restarts?
- What's the token cost implication of replaying full history every turn?
- How is this "memory" different from persistent state?

---

### Phase 4 — Tool binding + the manual tool loop

**🎯 Goal:** Give the model real tools and let it call them to answer "vegetarian Mexican under $20 available now."

**🧠 What you'll learn** (you know tool calling — build the loop *by hand* so agents aren't magic)

- `@tool` decorator — turns a function + docstring + type hints into a schema the model sees. **The docstring is the prompt** — description quality decides whether the model calls the tool correctly. Highest-leverage lesson in the phase.
- `model.bind_tools([...])` and reading `AIMessage.tool_calls`.
- Constructing `ToolMessage(content=..., tool_call_id=...)` and feeding results back.
- Writing the while-loop yourself: invoke → if `tool_calls`, execute, append `ToolMessage`s, re-invoke → repeat until no tool calls.

*Why the abstraction exists:* when you later use a prebuilt agent, you'll know exactly what it automates because you built it manually.

**🗂️ Schema slice:** `FoodTruck`, `MenuItem`, `Schedule` (for location/availability).

**📦 Data needed:** `trucks.json`, `menu_items.json`, `schedule.json`, `stock.json`.

**🛠️ Build** — the core tool set:

```text
search_food_trucks(cuisine, location?)   → [FoodTruck]
get_menu(truck_id)                        → [MenuItem]
check_item_availability(item_id)          → bool
get_truck_location(truck_id)              → GeoPoint + name (from Schedule)
calculate_order_total(items)              → Decimal
check_wait_time(truck_id)                 → minutes
```

```text
model.bind_tools([...])
        │
        ▼
model returns tool_calls  ──►  you execute  ──►  feed ToolMessages back
        ▲                                              │
        └──────────── loop until no more calls ◄───────┘
```

**✅ Milestone:** one natural request triggers a real chain of tool calls and returns a grounded answer.

**🔍 Learning checkpoint**
- What information does the model use to decide *which* tool to call? (The docstring + signature.)
- What's in a `ToolMessage` and why does `tool_call_id` matter?
- What makes the loop terminate?

---

### Phase 5 — The FEED ME agent + its ceiling

**🎯 Goal:** One button, one vague request — the agent does everything. *"I'm exhausted. High-protein, spicy, under $25, under 20 min wait."*

**🧠 What you'll learn**

- `create_react_agent` (LangGraph's prebuilt) — wrap your Phase 4 tools into a reusable agent. (Note: the "easy" agent already lives in LangGraph — foreshadowing.)
- Letting the model *decide tool order autonomously*.
- **The real lesson — watch where a pure loop struggles:** redundant tool calls, forgetting a constraint mid-run, and — crucially — no clean way to *pause for human approval before ordering*.

*Why this matters:* that awkwardness is your motivation for LangGraph's human-in-the-loop. Note it; don't fix it yet.

**🗂️ Schema slice:** all Phase 4 entities + `OrderDraft`.

**📦 Data needed:** same, plus `protein_g` populated on menu items.

**🛠️ Build**

```text
app/tools.py → add rank_meals(candidates, query), build_order_draft(...)
app/agent.py → feed_me_agent = create_react_agent(model, tools)
main.py      → "FEED ME" command
```

```text
USER REQUEST → understand intent → search → menus → availability
             → wait times → rank → build OrderDraft → (want: approval)
```

**✅ Milestone:** a working FEED ME demo **plus a written list of "things the loop does badly."** That list is your LangGraph to-do.

**🔍 Learning checkpoint**
- Where did the agent waste calls or lose a constraint?
- How would you force a "stop and ask me before ordering" step? Why is it awkward here?
- What state is the agent implicitly carrying, and where does it live?

---

### Phase 6 — Structured output under pressure

**🎯 Goal:** Parse `"3 spicy paneer tacos, remove onion from 2, add avocado to 1 only if avocado ≤ $2"` into a validated, tool-checkable order.

**🧠 What you'll learn**

- Nested Pydantic (`OrderDraftItem` → `Modification`) with `.with_structured_output`.
- `Field(description=...)` to steer extraction of ambiguous input.
- **The production principle:** *the LLM extracts intent; tools verify feasibility.* The model shouldn't decide whether avocado ≤ $2 — it emits the `condition`, and a tool resolves it against real `Modifier` data. LLM = language, tools = truth.

**🗂️ Schema slice:** `Modification`, `OrderDraftItem`, `Modifier`, `ModifierGroup`.

**📦 Data needed:** `modifiers.json` (with `price_delta`).

**🛠️ Build**

```text
app/schemas.py → Modification, OrderDraftItem (nested)
app/tools.py   → resolve_modifications(item_id, mods) → validated, priced result
app/chains.py  → order_parse_chain
```

```json
{
  "item": "Spicy Paneer Taco",
  "quantity": 3,
  "modifications": [
    { "quantity": 2, "remove": ["onion"] },
    { "quantity": 1, "add": ["avocado"], "condition": "price <= 2" }
  ]
}
```

**✅ Milestone:** messy natural language → structured order → tools confirm each modification is possible and priced.

**🔍 Learning checkpoint**
- Why should the *condition* be data, not an LLM judgment?
- How does nesting change the reliability of extraction, and how do `Field` descriptions help?
- What happens when a requested modifier doesn't exist on that item?

---

### Phase 7 — Owner Copilot (SQL + RAG tools together)

**🎯 Goal:** `"How did my truck perform this week?"` → a real analytical answer combining numbers and themes.

**🧠 What you'll learn**

- Exposing a database as a LangChain tool — a `@tool` that runs *parameterized* SQL (start hand-written, keep control; don't jump to the full SQL-agent toolkit yet).
- Combining **heterogeneous** tools in one agent: structured (orders/sales in SQLite) + unstructured (reviews via retriever).
- **Lesson:** agent power comes from *tool diversity*, not model size.
- This is where **SQLite arrives** (aggregation pain from Section 5.6).

**🗂️ Schema slice:** `Order`, `OrderItem`, `Review`.

**📦 Data needed:** synthesized `orders`/`sales` in SQLite; reviews in a vector store.

**🛠️ Build**

```text
migrate orders/sales JSON → SQLite
app/tools.py → sql_sales_tool(query_params), review_retriever_tool(topic)
app/agent.py → owner_copilot_agent
```

```text
question → agent
            ├─ sql_sales_tool(orders, sales)  → numbers
            ├─ review_retriever_tool(...)      → themes
            └─ synthesize → "Revenue +18%, paneer = 31% of orders,
                             6 people flagged 12–1pm waits"
```

**✅ Milestone:** an owner question that forces *both* a SQL call and a review retrieval in one answer.

**🔍 Learning checkpoint**
- Why did aggregation push you off JSON?
- How does the agent decide which tool answers which part of the question?
- What are the risks of giving an LLM raw SQL, and how did parameterizing help?

---

### Phase 8 — Review intelligence (RAG as a reporting engine)

**🎯 Goal:** `"What are customers complaining about?"` over 5,000 reviews → ranked complaint categories with percentages.

**🧠 What you'll learn**

- Batched LLM classification: `chain.batch([...])` — LCEL parallelism.
- Map-reduce style summarization over many documents.
- Turning per-item labels into aggregate insight; writing `sentiment`/`topics` back onto `Review`.
- **Lesson:** RAG isn't only Q&A — retrieval + structured classification + aggregation is a reporting engine.

**🗂️ Schema slice:** `Review` (including derived `sentiment`, `topics`).

**📦 Data needed:** **real reviews** — Yelp Open Dataset (Section 6).

**🛠️ Build**

```text
app/chains.py → classify_review_chain (structured output: sentiment + topics)
app/analytics.py → aggregate_complaints(reviews) → ranked table
```

```text
reviews → classify each (batch) → aggregate
                                     │
                 Wait times 38% · Portion 24% · Price 18% · Parking 12%
```

**✅ Milestone:** unstructured reviews → a quantified complaint breakdown an owner would act on.

**🔍 Learning checkpoint**
- Why batch instead of a loop? What does `.batch` do under the hood?
- How do you keep classification labels consistent across 5,000 calls?
- Where would this silently produce wrong percentages, and how would you catch it? (→ Phase 13 evals.)

---

### Phase 9 — Multi-step reasoning that breaks LangChain

**🎯 Goal:** `"Prepare me for tomorrow."` — forecast demand, compute ingredients, check inventory, find shortfalls, propose a purchase plan.

**🧠 What you'll learn — by hitting a wall on purpose**

Try to build this in LangChain and *feel the ceiling*. The problems with no clean LangChain answer:

- **Branching:** "if short on paneer, do X; else skip."
- **Looping:** "keep finding alternatives until under budget."
- **Pausing:** "stop and wait for owner approval, then resume."
- **Persistence:** "if it crashes mid-plan, resume where it left off."

**🗂️ Schema slice:** `RecipeLine`, `StockLevel`, `Supplier`, `Schedule`, `Order` (history), external signals.

**📦 Data needed:** recipes/ingredients (Food.com/RecipeNLG + USDA), `stock.json` → SQLite, `schedule.json`, Open-Meteo weather, events API.

**🛠️ Build (attempt in LangChain, honestly)**

```text
forecast_demand(history, weather, events) → est. orders
compute_ingredients(est_orders, recipes)  → required quantities
check_inventory(truck_id)                 → on-hand
find_shortfalls()                         → missing items
get_supplier_prices(shortfalls)           → cost + lead time
build_purchase_plan()                     → plan (needs approval)
```

```text
forecast → ingredients → inventory → shortfall → supplier → plan
                             ▲                                │
                             └────── needs a loop ────────────┘
                             and a pause for approval
```

**✅ Milestone:** an honest, half-working attempt **plus a written diagnosis:** *"linear chains can't branch, loop, or pause cleanly."* That sentence is your entry ticket to LangGraph.

**🔍 Learning checkpoint**
- Which of the four problems (branch/loop/pause/persist) hurt most, and why can't a chain solve it?
- Why is `RecipeLine` the single table that makes this agent real?
- Where does the process lose all state if it crashes?

---

### Phase 10 — LangGraph: state, nodes, edges

**🎯 Goal:** Rebuild the ordering flow as an explicit **graph**. Mental model flips: *pipeline → state machine.*

**🧠 What you'll learn** — the three primitives:

- **State** — a `TypedDict` (often with `Annotated` reducers like `add_messages`) that every node reads/writes. *This is the persistent memory you faked in Phase 3.*
- **Nodes** — plain functions `(state) -> partial_state_update`. Each does one job.
- **Edges** — `add_edge("search", "retrieve")` wires flow explicitly. *You* control order, not the LLM.

**🗂️ Schema slice:** `FoodQuery`, `MenuItem`, `OrderDraft` (carried in graph state).

**📦 Data needed:** same as Phases 2/4.

**🛠️ Build**

```text
app/graph.py → OrderState (TypedDict), nodes, StateGraph, compile()
```

```text
        ┌─────────── State (shared dict) ───────────┐
        │  query, candidates, order, budget_ok, ...  │
        └────────────────────────────────────────────┘
START → understand → search → retrieve → filter → rank → construct → END
        (each box is a NODE reading & writing State)
```

**✅ Milestone:** the linear order flow rebuilt as a compiled `StateGraph` that runs. It'll feel like *more* boilerplate than LangChain — expected. The payoff is Phase 11.

**🔍 Learning checkpoint**
- What does a node return, and how does the state get updated? (Reducers.)
- Why is explicit state better than passing variables through a chain?
- What's the difference between an edge and a conditional edge (preview)?

---

### Phase 11 — Conditional edges, loops, HITL, checkpointing

**🎯 Goal:** The full ordering agent with budget-driven replanning and real approval — everything impossible in Phase 9.

**🧠 What you'll learn** — the dense, high-value phase:

- **Conditional edges** — `add_conditional_edges(node, router_fn, {...})`; `router_fn` reads state, returns the next node's name. Branching *and* the basis for loops.
- **Loops** — a conditional edge pointing back to an earlier node ("too expensive → find alternative → re-check").
- **Checkpointers** — `MemorySaver` / `SqliteSaver`; compile with `checkpointer=...` and every step is persisted. *This is why crash-resume from Phase 9 now just works.*
- **`thread_id`** — the key scoping a conversation's persisted state. Real memory, finally.
- **Human-in-the-loop** — `interrupt()` / `interrupt_before=["human_approval"]`. Graph halts, you inspect state, resume with the human's decision. Trivial *because* state is checkpointed — the exact thing that was ugly in Phase 5.

**🗂️ Schema slice:** `OrderDraft`, `Order`, `Modifier`; state also holds `budget_ok`, `attempts`.

**📦 Data needed:** same + `SqliteSaver` DB file.

**🛠️ Build**

```text
START
  ▼
understand → search → retrieve → filter → rank → construct_order → check_budget
                                                                       │
                                                    ┌──── over budget ─┐
                                                    ▼                  │
                                              find_alternative ────────┘   (loop)
                                                    │
                                                    ▼
                                              human_approval  ⏸  (interrupt)
                                                    │
                                              ┌─────┴─────┐
                                            reject      approve
                                              │            │
                                            replan     place_order → END
```

**✅ Milestone:** an order agent that loops to stay under budget, stops for your yes/no, **survives a restart, and resumes.** When this runs, you *understand* LangGraph.

**🔍 Learning checkpoint**
- How does a conditional edge create a loop? How do you prevent an infinite one?
- What exactly does the checkpointer persist, and keyed by what?
- After `interrupt`, how does execution resume — and how does state survive a process restart?

---

### Phase 12 — Multi-agent (supervisor pattern)

**🎯 Goal:** One supervisor routing between Recommendation, Ordering, and Operations agents.

**🧠 What you'll learn**

- Agents-as-subgraphs; a **supervisor node** that decides which agent handles a request.
- Passing state between agents.
- **Lesson:** a multi-agent system is a graph whose nodes are themselves graphs. Clean Phase 11 graph → this composes; messy one → this collapses (which is itself the lesson: single-agent discipline first).

*Only start once a single graph is rock-solid — multi-agent multiplies debugging cost.*

**🗂️ Schema slice:** all prior.

**📦 Data needed:** all prior.

**🛠️ Build**

```text
              Supervisor (router node)
        ┌──────────┼───────────┐
   Recommendation Ordering  Operations
     (RAG graph) (P11 graph) (SQL+reviews)
```

**✅ Milestone:** `"How's business and reorder my usuals?"` routed across two agents into one coherent answer.

**🔍 Learning checkpoint**
- How does the supervisor decide routing, and how do you keep it from ping-ponging?
- What state is shared vs private per sub-agent?
- Why is single-agent discipline a prerequisite here?

---

### Phase 13 — MCP, evals, and guardrails (production)

**🎯 Goal:** Make FoodPilot real: decouple tools, measure quality, enforce safety.

**🧠 What you'll learn**

- **MCP** — expose Menu/Order/Inventory/Analytics as **MCP servers** your agent connects to as a client (`langchain-mcp-adapters`). Same tools now work for your agent, Claude Desktop, anything MCP-speaking. *Lesson:* MCP decouples capability from agent — tools become infrastructure, not buried code.
- **Evals** — a test set of `(input, expected)` for recommendation quality and tool-call correctness; score with LangSmith or a simple assert harness. *Lesson:* "seems to work" isn't a metric; agents regress silently.
- **Guardrails** — allergy checks, payment confirmation, order-total sanity limits, as validation nodes/edges in the graph. *Lesson:* the guardrail *is* part of the graph, not an afterthought.

**🗂️ Schema slice:** all; guardrails read `allergens`/`allergies`.

**📦 Data needed:** curated eval set from earlier phases.

**🛠️ Build**

```text
mcp/menu_server.py, order_server.py, inventory_server.py, analytics_server.py
evals/recommendation_evals.py, tool_call_evals.py
app/guardrails.py → allergy_guard, payment_confirm, total_sanity nodes
```

```text
FoodPilot Agent
      ├──── MCP → Menu System
      ├──── MCP → Order System
      ├──── MCP → Inventory System
      └──── MCP → Analytics
```

**✅ Milestone:** tools served over MCP, a passing eval suite you can re-run on every change, and guardrails that block an allergy-violating or over-limit order.

**🔍 Learning checkpoint**
- What does MCP decouple, and how is it different from a plain `@tool`?
- What are your top 5 eval cases, and what would a regression look like?
- Where in the graph does each guardrail live, and why there?

---

## 8. Cross-cutting principles (keep these in view the whole way)

1. **LLM = language, tools = truth.** The model extracts/plans; tools verify and execute. (Introduced Phase 6, applies everywhere.)
2. **Snapshot mutable values.** Orders freeze prices; never join live to a changing menu.
3. **Time-scoped state is the domain.** Location and stock change — this is *why* LangGraph exists in your project.
4. **Let pain drive upgrades.** JSON → SQLite and LangChain → LangGraph both happen when you *feel* the limit, not before.
5. **Terminal-first.** Build the AI problem; add UI/infra only when forced.
6. **Docstrings are prompts.** Tool description quality determines tool-call quality.
7. **Single-agent discipline before multi-agent.**

---

## Appendix A — API stability note

LangChain and LangGraph APIs move quickly (structured-output, memory, and agent constructors have all shifted). The **concepts** in this document are stable; the **exact import paths and method names** may differ by version. When you start each phase, confirm current signatures against the official docs. Treat code blocks here as *shape*, not copy-paste truth.

## Appendix B — Concept → Phase quick index

| Concept | Phase | Framework |
|---|---|---|
| Chat models, LCEL, structured output | 1 | LangChain |
| Documents, embeddings, retrievers, metadata filtering | 2 | LangChain |
| Message history / memory | 3 | LangChain |
| `@tool`, `bind_tools`, manual tool loop | 4 | LangChain |
| Prebuilt agent, autonomous tool ordering | 5 | LangGraph (prebuilt) |
| Nested structured output, condition-as-data | 6 | LangChain |
| SQL tool + RAG tool in one agent | 7 | LangChain |
| Batch classification, map-reduce, aggregation | 8 | LangChain |
| Multi-step reasoning limits (the wall) | 9 | LangChain |
| State, nodes, edges | 10 | LangGraph |
| Conditional edges, loops, checkpointing, HITL, persistence | 11 | LangGraph |
| Supervisor, agents-as-subgraphs | 12 | LangGraph |
| MCP, evals, guardrails | 13 | Both + MCP |

## Appendix C — Glossary (LangChain / LangGraph primitives)

- **Runnable** — any composable unit in LCEL; models, prompts, retrievers, chains all are Runnables.
- **LCEL** — LangChain Expression Language; the `|` operator composing Runnables into a pipeline.
- **`with_structured_output`** — binds a schema so the model returns a validated object, not text.
- **Document** — `{page_content, metadata}`; the unit of retrieval.
- **Retriever** — a Runnable that returns relevant Documents for a query, with optional metadata filters.
- **`@tool`** — decorator turning a function into a callable tool the model can invoke; docstring = description.
- **`bind_tools`** — attaches tool schemas to a model so it can emit `tool_calls`.
- **ToolMessage** — the message carrying a tool's result back to the model, tied by `tool_call_id`.
- **State (LangGraph)** — a typed dict shared across nodes; updated via reducers.
- **Node** — a function `(state) -> update`.
- **Edge / conditional edge** — fixed vs router-decided transition between nodes; conditional edges enable branching and loops.
- **Checkpointer** — persists graph state after each step (`MemorySaver`, `SqliteSaver`), keyed by `thread_id`.
- **`thread_id`** — identifier scoping a persisted conversation/run.
- **Interrupt / HITL** — pausing the graph for human input, then resuming from persisted state.
- **Supervisor** — a routing node that dispatches to sub-agents in a multi-agent graph.
- **MCP** — Model Context Protocol; a standard for exposing tools/capabilities as servers agents connect to as clients.
- **Eval** — a scored test of agent behavior over fixed `(input, expected)` cases.
- **Guardrail** — a validation step (node/edge) enforcing safety/business rules before an action.

---

*End of master specification. Build phase by phase. Don't skip the "hit the wall" phases (5, 9) — the walls are the curriculum.*
