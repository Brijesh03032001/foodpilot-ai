"""Phase 4/5 tools — real functions the model can call against our JSON data.

The docstring of each @tool IS the prompt the model reads to decide whether
and how to call it (Phase 4's highest-leverage lesson). Keep them clear and
literal. Tools return short strings/dicts so the ToolMessage fed back to the
model stays small.
"""
import json
from datetime import datetime
from pathlib import Path

from langchain_core.tools import tool

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Load once at import. Keyed by id where useful.
_trucks = json.loads((DATA_DIR / "trucks.json").read_text())
_items = json.loads((DATA_DIR / "menu_items.json").read_text())

_trucks_by_id = {t["id"]: t for t in _trucks}
_items_by_id = {i["id"]: i for i in _items}
_items_by_truck: dict[str, list] = {}
for _i in _items:
    _items_by_truck.setdefault(_i["truck_id"], []).append(_i)

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
