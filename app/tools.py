"""Phase 4/5 tools — real functions the model can call against our JSON data.

The docstring of each @tool IS the prompt the model reads to decide whether
and how to call it (Phase 4's highest-leverage lesson). Keep them clear and
literal. Tools return short strings/dicts so the ToolMessage fed back to the
model stays small.
"""
import json
import operator
import re
from datetime import datetime
from pathlib import Path

from langchain_core.tools import tool

from app.db import connect as _db_connect

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Load once at import. Keyed by id where useful.
_trucks = json.loads((DATA_DIR / "trucks.json").read_text())
_items = json.loads((DATA_DIR / "menu_items.json").read_text())

_trucks_by_id = {t["id"]: t for t in _trucks}
_items_by_id = {i["id"]: i for i in _items}
_items_by_truck: dict[str, list] = {}
for _i in _items:
    _items_by_truck.setdefault(_i["truck_id"], []).append(_i)

# --- Phase 6: modifier data (the "truth" resolve_modifications checks) -------
# Chain: menu_item (mi-0010) -< modifier_group (mg-mi-0010) -< modifiers
# (each modifier has an action add/remove/substitute and a real price_delta).
_mod_groups = json.loads((DATA_DIR / "modifier_groups.json").read_text())
_modifiers = json.loads((DATA_DIR / "modifiers.json").read_text())

_groups_by_item: dict[str, list[str]] = {}
for _g in _mod_groups:
    _groups_by_item.setdefault(_g["menu_item_id"], []).append(_g["id"])

_mods_by_group: dict[str, list] = {}
for _m in _modifiers:
    _mods_by_group.setdefault(_m["group_id"], []).append(_m)

TAX_RATE = 0.0863  # San Francisco sales tax
_WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _is_open_now(truck: dict, now: datetime) -> bool:
    hours = (truck.get("operating_hours") or {}).get("hours") or {}
    day = _WEEKDAYS[now.weekday()]
    windows = hours.get(day, [])
    t = now.strftime("%H:%M")
    return any(w["start"] <= t <= w["end"] for w in windows)


@tool
def search_food_trucks(cuisine: str) -> str:
    """Find food trucks that serve a given cuisine (e.g. 'mexican', 'thai',
    'korean', 'poke'). Returns up to 5 trucks with their id, name, rating and
    price tier. Use this first when the user wants a type of food but hasn't
    picked a truck."""
    cuisine = cuisine.lower().strip()
    matches = [
        t for t in _trucks
        if any(cuisine in c.lower() for c in (t.get("cuisines") or []))
    ]
    matches = matches[:5]
    if not matches:
        return f"No food trucks found serving '{cuisine}'."
    out = [
        {
            "truck_id": t["id"],
            "name": t["name"],
            "rating": t.get("rating"),
            "price_tier": t.get("price_tier"),
            "cuisines": t.get("cuisines"),
        }
        for t in matches
    ]
    return json.dumps(out)


@tool
def get_menu(truck_id: str) -> str:
    """Get the AVAILABLE menu items for one food truck, by its truck_id.
    Returns each item's id, name, price, spice level, dietary tags and grams
    of protein. Call this after you know which truck the user wants."""
    items = _items_by_truck.get(truck_id, [])
    available = [i for i in items if i.get("is_available")]
    if not available:
        return f"No available menu items for truck '{truck_id}'."
    out = [
        {
            "item_id": i["id"],
            "name": i["name"],
            "price": i["base_price"],
            "spice_level": i.get("spice_level"),
            "dietary_tags": i.get("dietary_tags"),
            "protein_g": i.get("protein_g"),
        }
        for i in available
    ]
    return json.dumps(out)


@tool
def check_item_availability(item_id: str) -> str:
    """Check whether a single menu item is currently available to order, by
    its item_id. Returns the item name and whether it is in stock."""
    item = _items_by_id.get(item_id)
    if not item:
        return f"No menu item with id '{item_id}'."
    return json.dumps(
        {
            "item_id": item_id,
            "name": item["name"],
            "is_available": bool(item.get("is_available")),
            "availability_status": item.get("availability_status"),
        }
    )


@tool
def get_truck_location(truck_id: str) -> str:
    """Get where a food truck is and whether it is open right now, by its
    truck_id. Returns the truck name, street address, coordinates, and an
    open-now flag based on its operating hours."""
    truck = _trucks_by_id.get(truck_id)
    if not truck:
        return f"No food truck with id '{truck_id}'."
    return json.dumps(
        {
            "truck_id": truck_id,
            "name": truck["name"],
            "address": (truck.get("address") or {}).get("formatted"),
            "location": truck.get("location"),
            "open_now": _is_open_now(truck, datetime.now()),
        }
    )


@tool
def check_wait_time(truck_id: str) -> str:
    """Get the current estimated wait time in minutes for a food truck, by its
    truck_id. Uses the live order queue when known, otherwise the truck's
    average prep time. Call this when the user cares about how long they'll
    wait."""
    truck = _trucks_by_id.get(truck_id)
    if not truck:
        return f"No food truck with id '{truck_id}'."
    queue = truck.get("current_queue_min")
    prep = truck.get("avg_prep_time_min") or 0
    if queue is not None:
        wait = queue + prep
        basis = "live queue + avg prep"
    else:
        wait = prep
        basis = "avg prep only (no live queue)"
    return json.dumps({"truck_id": truck_id, "wait_min": wait, "basis": basis})


@tool
def calculate_order_total(item_ids: list[str]) -> str:
    """Calculate the price of an order given a list of menu item_ids (one unit
    of each). Returns subtotal, tax and total in USD. Use this to price an
    order before proposing it."""
    subtotal = 0.0
    missing = []
    for iid in item_ids:
        item = _items_by_id.get(iid)
        if not item:
            missing.append(iid)
            continue
        subtotal += float(item["base_price"])
    tax = round(subtotal * TAX_RATE, 2)
    total = round(subtotal + tax, 2)
    result = {
        "subtotal": round(subtotal, 2),
        "tax": tax,
        "total": total,
        "item_count": len(item_ids) - len(missing),
    }
    if missing:
        result["unknown_item_ids"] = missing
    return json.dumps(result)


# --- Phase 5 additions ------------------------------------------------------
@tool
def rank_meals(item_ids: list[str], prioritize: str = "protein") -> str:
    """Rank a list of candidate menu item_ids to pick the best options. Set
    `prioritize` to 'protein' (most grams of protein first), 'price' (cheapest
    first), or 'popularity' (most popular first). Returns the items sorted
    best-first. Use this to choose among several candidates for the user."""
    items = [_items_by_id[i] for i in item_ids if i in _items_by_id]
    key_map = {
        "protein": lambda x: -float(x.get("protein_g") or 0),
        "price": lambda x: float(x["base_price"]),
        "popularity": lambda x: -float(x.get("popularity_score") or 0),
    }
    key = key_map.get(prioritize, key_map["protein"])
    items.sort(key=key)
    out = [
        {
            "item_id": i["id"],
            "name": i["name"],
            "price": i["base_price"],
            "protein_g": i.get("protein_g"),
            "spice_level": i.get("spice_level"),
        }
        for i in items
    ]
    return json.dumps(out)


@tool
def build_order_draft(truck_id: str, item_ids: list[str]) -> str:
    """Assemble a proposed order (an order draft) for a truck from a list of
    menu item_ids. Returns the truck, the line items, the estimated total and
    the estimated wait time — everything needed to show the user before they
    confirm. Call this LAST, once you've decided what to recommend."""
    truck = _trucks_by_id.get(truck_id)
    if not truck:
        return f"No food truck with id '{truck_id}'."
    lines = []
    subtotal = 0.0
    for iid in item_ids:
        item = _items_by_id.get(iid)
        if not item:
            continue
        subtotal += float(item["base_price"])
        lines.append({"item_id": iid, "name": item["name"], "price": item["base_price"]})
    tax = round(subtotal * TAX_RATE, 2)
    total = round(subtotal + tax, 2)
    queue = truck.get("current_queue_min")
    prep = truck.get("avg_prep_time_min") or 0
    wait = (queue + prep) if queue is not None else prep
    return json.dumps(
        {
            "truck_id": truck_id,
            "truck_name": truck["name"],
            "items": lines,
            "subtotal": round(subtotal, 2),
            "tax": tax,
            "estimated_total": total,
            "estimated_wait_min": wait,
        }
    )


# --- Phase 6: resolve_modifications — the "tools = truth" half --------------
# The LLM extracts a `condition` as plain text ("price <= 2"); it must NOT
# decide whether that's true. THIS is where truth lives: parse the condition
# safely (no eval, no LLM) and check it against the REAL price_delta from
# modifiers.json.
_COND_OPS = {"<=": operator.le, ">=": operator.ge, "==": operator.eq,
             "<": operator.lt, ">": operator.gt}
_COND_RE = re.compile(r"(<=|>=|==|<|>)\s*\$?\s*([0-9]+(?:\.[0-9]+)?)")
_NUM_RE = re.compile(r"\$?\s*([0-9]+(?:\.[0-9]+)?)")

# Natural-language money phrasings the model tends to emit, mapped to an
# operator. Longer/more-specific phrases are checked before shorter ones so
# "or less" wins over a bare "less". Order matters.
_PHRASE_OPS = [
    ("or less", "<="), ("at most", "<="), ("no more than", "<="),
    ("not more than", "<="), ("or under", "<="), ("or cheaper", "<="),
    ("or more", ">="), ("at least", ">="), ("no less than", ">="),
    ("less than", "<"), ("cheaper than", "<"), ("under", "<"), ("below", "<"),
    ("more than", ">"), ("greater than", ">"), ("over", ">"), ("above", ">"),
]


def _eval_condition(condition: str | None, price: float):
    """Check a text condition against a real price. True / False, or None if
    there's no condition or it can't be understood.

    Handles two forms:
      1. explicit operator, e.g. 'price <= 2'
      2. natural language, e.g. 'avocado costs $2 or less', 'under $3'
    Deliberately NOT eval() — we only ever extract a comparison operator and a
    number, so a garbled or hostile string can't run code. The MODEL is allowed
    to phrase the condition loosely (language); the TOOL turns it into a precise
    comparison against the real price (truth).
    """
    if not condition:
        return None
    c = condition.lower()

    m = _COND_RE.search(c)          # form 1: 'price <= 2'
    if m:
        return _COND_OPS[m.group(1)](price, float(m.group(2)))

    num_m = _NUM_RE.search(c)       # form 2: natural language + a number
    if not num_m:
        return None
    num = float(num_m.group(1))
    for phrase, op in _PHRASE_OPS:
        if phrase in c:
            return _COND_OPS[op](price, num)
    return None


def _find_modifier(item_id: str, action: str, ingredient: str) -> dict | None:
    """Find an available modifier on this item whose action matches and whose
    name mentions the ingredient. E.g. (action='add', ingredient='avocado')
    matches the 'Add avocado' modifier. Returns the modifier dict or None."""
    ing = ingredient.lower().strip()
    for gid in _groups_by_item.get(item_id, []):
        for m in _mods_by_group.get(gid, []):
            if m.get("action") == action and ing in m["name"].lower():
                return m
    return None


def find_menu_item_id(name: str) -> str | None:
    """Loose lookup: menu item NAME (as the customer said it) -> its item_id.

    The parser gives us the item as free text ('Spam Musubi'); resolve_
    modifications needs the id. Try exact match first, then substring either
    direction. Not a @tool — just plumbing between the parse step and the
    resolve step.
    """
    q = name.lower().strip()
    for i in _items:
        if i["name"].lower() == q:
            return i["id"]
    for i in _items:
        n = i["name"].lower()
        if q and (q in n or n in q):
            return i["id"]
    return None


@tool
def resolve_modifications(item_id: str, modifications: list[dict]) -> str:
    """Verify and price a list of order modifications against the REAL modifier
    data for one menu item (by item_id). For each modification it checks that
    every requested add/remove actually exists on that item, looks up its real
    price change, and evaluates any `condition` (e.g. 'price <= 2') against that
    real price. Returns which changes were applied, which were rejected and why,
    and the total price change. Call this after parsing an order, to confirm the
    order is actually possible before showing it to the customer."""
    item = _items_by_id.get(item_id)
    if not item:
        return json.dumps({"error": f"No menu item with id '{item_id}'."})

    resolved = []
    mods_total = 0.0
    for mod in modifications:
        qty = int(mod.get("quantity", 1) or 1)
        condition = mod.get("condition")
        changes = []
        line_delta = 0.0

        for ing in mod.get("add", []) or []:
            found = _find_modifier(item_id, "add", ing)
            if not found:
                changes.append({"type": "add", "ingredient": ing,
                                "applied": False,
                                "reason": "not available on this item"})
                continue
            delta = float(found["price_delta"])
            met = _eval_condition(condition, delta)
            if met is False:
                changes.append({"type": "add", "ingredient": ing,
                                "matched": found["name"], "price_delta": delta,
                                "applied": False,
                                "reason": f"condition '{condition}' not met "
                                          f"(real price {delta:.2f})"})
            elif met is None and condition:
                changes.append({"type": "add", "ingredient": ing,
                                "matched": found["name"], "price_delta": delta,
                                "applied": False,
                                "reason": f"condition '{condition}' could not "
                                          f"be parsed"})
            else:
                changes.append({"type": "add", "ingredient": ing,
                                "matched": found["name"], "price_delta": delta,
                                "applied": True,
                                "condition_met": (True if condition else None)})
                line_delta += delta

        for ing in mod.get("remove", []) or []:
            found = _find_modifier(item_id, "remove", ing)
            if not found:
                changes.append({"type": "remove", "ingredient": ing,
                                "applied": False,
                                "reason": "no removable option for that ingredient"})
                continue
            delta = float(found["price_delta"])
            changes.append({"type": "remove", "ingredient": ing,
                            "matched": found["name"], "price_delta": delta,
                            "applied": True})
            line_delta += delta

        line_total = round(line_delta * qty, 2)
        mods_total += line_total
        resolved.append({"quantity": qty, "condition": condition,
                         "changes": changes, "line_price_change": line_total})

    return json.dumps({
        "item_id": item_id,
        "item_name": item["name"],
        "base_price": float(item["base_price"]),
        "modifications": resolved,
        "modifications_price_change": round(mods_total, 2),
    })


# --- Phase 7: sales_stats — a SQL tool that KEEPS CONTROL --------------------
# We do NOT hand the model a "write any SQL" tool (that risks injection, DROP
# TABLE, runaway scans). Instead the model picks a `metric` from a fixed list,
# and every VALUE it supplies (truck, dates, limit) is passed as a bound
# parameter (?), never string-concatenated into SQL. So the model chooses WHAT
# to ask, never the raw query. Column/table names live only in these templates.
#
# {where} is always the fixed base 'o.status = completed' plus optional
# parameterized truck/date filters — so every metric reports realized sales.
_SALES_METRICS: dict[str, tuple[str, bool]] = {
    "revenue": (
        "SELECT COUNT(*) AS orders, "
        "ROUND(COALESCE(SUM(o.total), 0), 2) AS revenue, "
        "ROUND(COALESCE(AVG(o.total), 0), 2) AS avg_order_value "
        "FROM orders o{where}",
        False,
    ),
    "order_count": (
        "SELECT COUNT(*) AS orders FROM orders o{where}",
        False,
    ),
    "avg_order_value": (
        "SELECT ROUND(COALESCE(AVG(o.total), 0), 2) AS avg_order_value "
        "FROM orders o{where}",
        False,
    ),
    "top_items": (
        "SELECT mi.name AS item, SUM(oi.quantity) AS qty, "
        "ROUND(SUM(oi.line_total), 2) AS revenue "
        "FROM order_items oi "
        "JOIN orders o ON o.id = oi.order_id "
        "JOIN menu_items mi ON mi.id = oi.menu_item_id{where} "
        "GROUP BY oi.menu_item_id ORDER BY qty DESC LIMIT ?",
        True,
    ),
    "sales_by_day": (
        "SELECT date(o.created_at) AS day, "
        "ROUND(SUM(o.total), 2) AS revenue, COUNT(*) AS orders "
        "FROM orders o{where} GROUP BY day ORDER BY day DESC LIMIT ?",
        True,
    ),
}


def _sales_where(truck_id: str | None, start_date: str | None,
                 end_date: str | None) -> tuple[str, list]:
    """Build the WHERE clause. The 'completed' base is a hard-coded literal
    (safe); every real value goes into `params` as a bound `?` (safe)."""
    clauses = ["o.status = 'completed'"]
    params: list = []
    if truck_id:
        clauses.append("o.truck_id = ?")
        params.append(truck_id)
    if start_date:
        clauses.append("date(o.created_at) >= date(?)")
        params.append(start_date)
    if end_date:
        clauses.append("date(o.created_at) <= date(?)")
        params.append(end_date)
    return " WHERE " + " AND ".join(clauses), params


def _resolve_truck(conn, term: str) -> tuple[str | None, str | None]:
    """Map a truck id OR a loose name ('Tokachi') to (id, name). The term is
    always passed as a bound parameter — a hostile string can't escape it."""
    row = conn.execute("SELECT id, name FROM trucks WHERE id = ?", (term,)).fetchone()
    if row:
        return row["id"], row["name"]
    row = conn.execute(
        "SELECT id, name FROM trucks WHERE lower(name) LIKE ?",
        (f"%{term.lower()}%",),
    ).fetchone()
    if row:
        return row["id"], row["name"]
    return None, None


@tool
def sales_stats(metric: str, truck: str | None = None,
                start_date: str | None = None, end_date: str | None = None,
                limit: int = 5) -> str:
    """Get sales numbers for the owner from the orders database (completed
    orders only). Choose ONE `metric`:
      - 'revenue'          -> order count, total revenue, average order value
      - 'order_count'      -> number of orders
      - 'avg_order_value'  -> average order total
      - 'top_items'        -> best-selling menu items (by quantity)
      - 'sales_by_day'     -> revenue and orders grouped by day
    Optional filters: `truck` (a truck name like 'Tokachi' or an id),
    `start_date`/`end_date` as 'YYYY-MM-DD', and `limit` (for top_items /
    sales_by_day). Returns JSON rows. Use this for any 'how much / how many /
    which sells best / revenue over time' question."""
    metric = (metric or "").lower().strip()
    if metric not in _SALES_METRICS:
        return json.dumps({"error": f"unknown metric '{metric}'",
                           "allowed": list(_SALES_METRICS)})
    limit = max(1, min(int(limit or 5), 50))

    conn = _db_connect()
    try:
        truck_id = truck_name = None
        if truck:
            truck_id, truck_name = _resolve_truck(conn, truck)
            if truck_id is None:
                return json.dumps({"error": f"no truck matching '{truck}'"})
        where, params = _sales_where(truck_id, start_date, end_date)
        sql, needs_limit = _SALES_METRICS[metric]
        sql = sql.format(where=where)
        if needs_limit:
            params = params + [limit]
        rows = [dict(r) for r in conn.execute(sql, params).fetchall()]
    finally:
        conn.close()

    return json.dumps({
        "metric": metric,
        "truck": truck_name,
        "start_date": start_date,
        "end_date": end_date,
        "rows": rows,
    })


# --- Phase 7: review_search — the "themes" half (semantic, not SQL) ----------
# Reviews are unstructured text. SQL keyword-matching ('LIKE %wait%') misses
# "I stood there for 40 minutes". Semantic search over embeddings finds it by
# MEANING. This is the vector-store tool that pairs with the SQL tool in the
# Owner Copilot — structured numbers + unstructured themes in one agent.
@tool
def review_search(topic: str, truck: str | None = None, k: int = 5) -> str:
    """Search customer REVIEWS by meaning/theme, e.g. 'long wait times', 'food
    was cold', 'great value'. Finds reviews that match the theme even when they
    don't use those exact words. Optional `truck` (a name like 'Tokachi' or an
    id) restricts to one truck. Returns matching reviews with rating and
    sentiment. Use this for 'what are people saying / complaining about / happy
    about' questions — anything about opinions or themes, not numbers."""
    from app.retrievers import get_review_retriever  # lazy: heavy import

    k = max(1, min(int(k or 5), 20))

    truck_id = None
    if truck:
        conn = _db_connect()
        try:
            truck_id, _ = _resolve_truck(conn, truck)
        finally:
            conn.close()
        if truck_id is None:
            return json.dumps({"error": f"no truck matching '{truck}'"})

    docs = get_review_retriever(truck_id, k=k).invoke(topic)
    out = [
        {
            "text": d.page_content,
            "rating": d.metadata.get("rating"),
            "sentiment": d.metadata.get("sentiment"),
            "truck": d.metadata.get("truck_name"),
            "topics": d.metadata.get("topics"),
        }
        for d in docs
    ]
    return json.dumps(out)


# Phase 4 tool set (read/query tools) and the Phase 5 superset (adds ranking
# + order assembly for the FEED ME agent).
PHASE4_TOOLS = [
    search_food_trucks,
    get_menu,
    check_item_availability,
    get_truck_location,
    check_wait_time,
    calculate_order_total,
]

PHASE5_TOOLS = PHASE4_TOOLS + [rank_meals, build_order_draft]

# Phase 6: the "truth" tool that verifies + prices a parsed order.
PHASE6_TOOLS = [resolve_modifications]

# Phase 7: Owner Copilot — structured (SQL) + unstructured (reviews) together.
PHASE7_TOOLS = [sales_stats, review_search]
