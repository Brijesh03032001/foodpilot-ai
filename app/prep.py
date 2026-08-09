"""Phase 9 — "Prepare me for tomorrow": the HONEST LangChain attempt.

Six deterministic steps wired as a LINEAR LCEL chain (RunnableLambda | ...):
  forecast -> ingredients -> inventory -> shortfall -> supplier -> plan

The happy path works. The whole point of Phase 9 is what a linear chain CANNOT
do cleanly — branch, loop, pause, persist — written up in LANGCHAIN_WALL.md.
That wall is the entry ticket to LangGraph (Phase 10-11).

RecipeLine (recipes.json: menu_item -> ingredient + quantity) is the hinge:
it's what turns "sell 5 bowls" into "need 0.6 kg of X". Weather/events
forecasting is STUBBED (a popularity heuristic) — the structure is the lesson,
not forecast accuracy.
"""
import json
from collections import defaultdict
from pathlib import Path

from langchain_core.runnables import RunnableLambda

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

_items = json.loads((DATA_DIR / "menu_items.json").read_text())
_recipes = json.loads((DATA_DIR / "recipes.json").read_text())
_stock = json.loads((DATA_DIR / "stock.json").read_text())
_ingredients = json.loads((DATA_DIR / "ingredients.json").read_text())
_suppliers = json.loads((DATA_DIR / "suppliers.json").read_text())

_items_by_truck: dict[str, list] = defaultdict(list)
for _i in _items:
    _items_by_truck[_i["truck_id"]].append(_i)

_recipes_by_item: dict[str, list] = defaultdict(list)
for _r in _recipes:
    _recipes_by_item[_r["menu_item_id"]].append(_r)

_ing_by_id = {g["id"]: g for g in _ingredients}

_suppliers_by_ing: dict[str, list] = defaultdict(list)
for _s in _suppliers:
    _suppliers_by_ing[_s["ingredient_id"]].append(_s)


def _ing_name(ing_id: str) -> str:
    g = _ing_by_id.get(ing_id)
    return g["name"] if g else ing_id


# --- Step 1: forecast demand (STUB: popularity heuristic, no weather/events) --
def forecast_demand(state: dict) -> dict:
    forecast = {}
    for item in _items_by_truck.get(state["truck_id"], []):
        if not item.get("is_available"):
            continue
        est = max(1, round(float(item.get("popularity_score") or 0) * 15))
        forecast[item["id"]] = est
    return {**state, "forecast": forecast}


# --- Step 2: compute required ingredients (RecipeLine: the hinge table) -------
def compute_ingredients(state: dict) -> dict:
    required: dict[str, float] = defaultdict(float)
    for item_id, units in state["forecast"].items():
        for line in _recipes_by_item.get(item_id, []):
            required[line["ingredient_id"]] += line["quantity"] * units
    return {**state, "required": {k: round(v, 2) for k, v in required.items()}}


# --- Step 3: check inventory on hand -----------------------------------------
def check_inventory(state: dict) -> dict:
    on_hand = {
        s["ingredient_id"]: s["quantity_on_hand"]
        for s in _stock
        if s["truck_id"] == state["truck_id"]
    }
    return {**state, "on_hand": on_hand}


# --- Step 4: find shortfalls --------------------------------------------------
def find_shortfalls(state: dict) -> dict:
    shortfalls = {
        ing: round(need - state["on_hand"].get(ing, 0.0), 2)
        for ing, need in state["required"].items()
        if need > state["on_hand"].get(ing, 0.0)
    }
    return {**state, "shortfalls": shortfalls}


# --- Step 5: cheapest supplier quote per shortfall ---------------------------
def get_supplier_prices(state: dict) -> dict:
    quotes = {}
    for ing in state["shortfalls"]:
        sups = sorted(
            _suppliers_by_ing.get(ing, []), key=lambda s: s["price_per_unit"]
        )
        if sups:
            quotes[ing] = sups[0]
    return {**state, "quotes": quotes}


# --- Step 6: build purchase plan (this is where approval SHOULD pause) --------
def build_purchase_plan(state: dict) -> dict:
    plan = []
    total = 0.0
    for ing, short in state["shortfalls"].items():
        q = state["quotes"].get(ing)
        if not q:
            plan.append({"ingredient": _ing_name(ing), "shortfall": short,
                         "supplier": None, "note": "no supplier found"})
            continue
        qty = max(short, q["min_order_qty"])
        line_cost = round(qty * q["price_per_unit"], 2)
        total += line_cost
        plan.append({
            "ingredient": _ing_name(ing),
            "buy_qty": round(qty, 2),
            "unit": _ing_by_id.get(ing, {}).get("unit"),
            "supplier": q["name"],
            "unit_price": q["price_per_unit"],
            "lead_time_days": q["lead_time_days"],
            "line_cost": line_cost,
        })
    total = round(total, 2)
    budget = state.get("budget")
    return {**state, "plan": plan, "plan_total": total,
            "over_budget": (budget is not None and total > budget)}


# The honest LangChain attempt: a LINEAR pipe. Runs straight through, top to
# bottom, once. It cannot branch (skip steps when no shortfall), loop (retry
# suppliers until under budget), pause (wait for owner approval), or persist
# (resume after a crash). See LANGCHAIN_WALL.md.
prepare_chain = (
    RunnableLambda(forecast_demand)
    | RunnableLambda(compute_ingredients)
    | RunnableLambda(check_inventory)
    | RunnableLambda(find_shortfalls)
    | RunnableLambda(get_supplier_prices)
    | RunnableLambda(build_purchase_plan)
)


def prepare_for_tomorrow(truck_id: str, budget: float | None = None) -> dict:
    """Run the linear prepare pipeline once and return the final state dict."""
    return prepare_chain.invoke({"truck_id": truck_id, "budget": budget})
