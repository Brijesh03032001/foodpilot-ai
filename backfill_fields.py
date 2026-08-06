"""
Non-destructive backfill for the newer schema fields.

Unlike generate_data.py (which rebuilds everything from scratch and would WIPE
enriched menu descriptions), this script only ADDS fields that are missing from
the EXISTING data/*.json, deriving them from data already present. It never
overwrites a field that's already set, so menu descriptions and any manual edits
are preserved.

Fills, only when absent:
  menu_items : spice_score, base_ingredients, removable_ingredients, add_ons,
               availability_status, available_days, labels, image_url
  trucks     : payment_methods, order_type, amenities, current_queue_min,
               delivery_fee, driver_assignment_min, avg_delivery_time_min
  customers  : created_at, order_count

Run:  python backfill_fields.py
Idempotent — safe to run repeatedly; reports how many values it filled.
"""

import json, os, random
from datetime import datetime, timedelta

random.seed(7)   # deterministic backfill
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")

def load(n): return json.load(open(os.path.join(DATA, n)))
def save(n, obj): json.dump(obj, open(os.path.join(DATA, n), "w"), indent=2)

SPICE_SCORE = {"none": 0, "mild": 2, "medium": 5, "hot": 8}
WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
REMOVABLE = {
    "onion","red onion","green onion","scallion","cilantro","cheese","cotija cheese","feta",
    "mozzarella","provolone","jalapenos","pickles","pickled carrot","tomato","cherry tomato",
    "lettuce","cabbage","coleslaw","sour cream","mayo","spicy mayo","garlic sauce","white sauce",
    "yogurt sauce","tzatziki","olives","avocado","bacon","egg","mushroom","bell pepper","basil",
    "sumac onion","chimichurri","hot sauce","bbq sauce","chili","cinnamon sugar",
}
AMENITIES = ["seating_available","outdoor_seating","kid_friendly","dog_friendly",
             "wheelchair_accessible","wifi_available","cash_only","restrooms_nearby"]

fills = {}
def fill(rec, key, value):
    """Set rec[key] only if the key is missing entirely. Returns True if it filled."""
    if key not in rec:
        rec[key] = value
        fills[key] = fills.get(key, 0) + 1
        return True
    return False

# ---- references from existing data ----
ing_name = {i["id"]: i["name"] for i in load("ingredients.json")}
item_ings = {}
for r in load("recipes.json"):
    item_ings.setdefault(r["menu_item_id"], []).append(ing_name.get(r["ingredient_id"], ""))
# add-type modifiers per item, from the existing Modifier records (keeps add_ons consistent)
grp_item = {g["id"]: g["menu_item_id"] for g in load("modifier_groups.json")}
item_addmods = {}
for m in load("modifiers.json"):
    if m.get("action") == "add" and m.get("price_delta", 0) > 0:
        mid = grp_item.get(m["group_id"])
        if mid:
            nm = m["name"].replace("Add ", "").replace("Extra ", "extra ").lower()
            item_addmods.setdefault(mid, []).append({"name": nm, "price": round(m["price_delta"], 2)})

# ---- MENU ITEMS ----
items = load("menu_items.json")
for it in items:
    ings = item_ings.get(it["id"], [])
    fill(it, "spice_score", SPICE_SCORE.get(it.get("spice_level", "none"), 0))
    fill(it, "base_ingredients", ings)
    fill(it, "removable_ingredients", [i for i in ings if i in REMOVABLE])
    fill(it, "add_ons", item_addmods.get(it["id"], [])[:3])
    fill(it, "availability_status",
         "out_of_stock" if it.get("is_available") is False else "in_stock")
    fill(it, "available_days", None)          # None = available whenever the truck is open
    if "labels" not in it:
        labels = []
        if it.get("spice_level") in ("medium", "hot"): labels.append("spicy")
        d = it.get("dietary_tags", [])
        if "vegan" in d: labels.append("vegan")
        elif "vegetarian" in d: labels.append("vegetarian")
        if (it.get("protein_g") or 0) >= 28: labels.append("high_protein")
        fill(it, "labels", labels)
    fill(it, "image_url", None)
save("menu_items.json", items)

# ---- TRUCKS ----
trucks = load("trucks.json")
for t in trucks:
    fill(t, "payment_methods",
         random.choice([["card","cash"]]*6 + [["card"]]*2 + [["card","cash","mobile"]]*2))
    fill(t, "order_type", random.choice([["pickup"]]*8 + [["pickup","delivery"]]*2))
    fill(t, "amenities", sorted(random.sample(AMENITIES, k=random.randint(2, 4))))
    fill(t, "current_queue_min",
         random.choice([0,0,2,3,5,5,8,10,12,15]) if t.get("status") == "open" else None)
    delivers = "delivery" in (t.get("order_type") or [])
    fill(t, "delivery_fee", round(random.uniform(2.0, 5.5), 2) if delivers else None)
    fill(t, "driver_assignment_min", random.randint(3, 8) if delivers else None)
    fill(t, "avg_delivery_time_min", random.randint(10, 25) if delivers else None)
save("trucks.json", trucks)

# ---- CUSTOMERS ----
orders = load("orders.json")
from collections import Counter
oc = Counter(o["customer_id"] for o in orders)
customers = load("customers.json")
for c in customers:
    fill(c, "created_at",
         (datetime(2026, 8, 7) - timedelta(days=random.randint(30, 730))).isoformat())
    fill(c, "order_count", oc.get(c["id"], 0))
save("customers.json", customers)

# ---- REPORT ----
if fills:
    print("Backfilled missing fields:")
    for k, v in sorted(fills.items()):
        print(f"  {k:24s} {v} records")
else:
    print("Nothing to backfill — all fields already present. (Data is complete.)")
