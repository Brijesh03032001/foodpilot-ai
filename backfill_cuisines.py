"""Backfill FoodTruck.cuisines for trucks the Yelp scrape left empty.

generate_data.py already defines the canonical cuisine vocabulary (the keys
of its MENUS dict) but 15/107 trucks came out of the scrape with an empty
cuisines list, which breaks cuisine-based filtering in the RAG retriever
(Phase 2). This assigns each of those trucks 1-2 random cuisines from that
same vocabulary, so every truck has something to filter/search on.

Does NOT touch menu_items.json — trucks that already had a generic/fallback
menu keep it; only the truck's cuisine label is being filled in here.
"""
import json
import random
from pathlib import Path

random.seed(42)  # matches generate_data.py's seed for reproducibility

DATA_DIR = Path(__file__).resolve().parent / "data"

# Canonical cuisine vocabulary — copied from generate_data.py's MENUS dict
# keys (both real menu templates and their aliases, e.g. "tacos" -> "mexican").
# NOT importing generate_data.py directly: it has no __main__ guard and
# re-runs its entire data generation pipeline (overwriting all of data/) on import.
CUISINES = [
    "mexican", "tacos", "burgers", "sandwiches", "wraps", "hot_dogs",
    "korean", "japanese", "poke", "hawaiian", "chinese", "szechuan",
    "noodles", "thai", "vietnamese", "filipino", "indian", "pakistani",
    "halal", "mediterranean", "greek", "turkish", "kebab", "peruvian",
    "argentine", "empanadas", "brazilian", "italian", "pizza", "seafood",
    "soul_food", "comfort_food", "american", "barbeque", "chicken_shop",
    "breakfast_and_brunch", "pancakes", "waffles", "coffee_and_tea",
    "cafes", "bubble_tea", "ice_cream_and_frozen_yogurt", "desserts",
    "donuts", "bakeries", "acai_bowls", "indonesian",
]


def main() -> None:
    trucks_path = DATA_DIR / "trucks.json"
    trucks = json.loads(trucks_path.read_text())

    backup_path = DATA_DIR / "trucks.backup.json"
    backup_path.write_text(json.dumps(trucks, indent=2))

    changed = []
    for truck in trucks:
        if truck.get("cuisines"):
            continue
        n = 1 if random.random() < 0.7 else 2
        assigned = random.sample(CUISINES, n)
        truck["cuisines"] = assigned
        changed.append((truck["id"], truck["name"], assigned))

    trucks_path.write_text(json.dumps(trucks, indent=2))

    print(f"Backed up original to {backup_path.name}")
    print(f"Assigned cuisines to {len(changed)} truck(s):")
    for truck_id, name, assigned in changed:
        print(f"  {name:30s} ({truck_id}) -> {assigned}")


if __name__ == "__main__":
    main()
