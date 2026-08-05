"""
FoodPilot demo-data generator.

Reads the REAL scraped trucks (data/foodtrucks-sf.json), maps them onto the
revised FoodPilot schema, and generates cuisine-matched demo data for every
other entity the project needs.

Design choices (see FoodPilot_Master_Spec.md, Section 5):
  * Trucks are REAL. Menus are GENERATED but matched to each truck's real
    cuisines (a Mexican truck gets tacos/burritos; a multi-cuisine truck
    blends items from each cuisine).
  * Location is FIXED. openingHours strings -> structured operating_hours.
  * Sparse scraped fields stay optional; owner_id / avg_prep_time_min are
    synthesized.

Run:  python generate_data.py
Outputs (into data/): trucks.json, owners.json, menu_items.json,
    modifier_groups.json, modifiers.json, ingredients.json, recipes.json,
    stock.json, customers.json, orders.json, reviews.json
"""

import json, os, random, re
from datetime import datetime, timedelta

random.seed(42)
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")

# --- constants for the newer fields (defined early: used by both trucks & menus) ---
SPICE_RANGE = {"mild": (1, 3), "medium": (4, 6), "hot": (7, 10)}   # spice_level -> spice_score
WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
# ingredients a customer can reasonably ask to remove (drives removable_ingredients)
REMOVABLE = {
    "onion","red onion","green onion","scallion","cilantro","cheese","cotija cheese","feta",
    "mozzarella","provolone","jalapenos","pickles","pickled carrot","tomato","cherry tomato",
    "lettuce","cabbage","coleslaw","sour cream","mayo","spicy mayo","garlic sauce","white sauce",
    "yogurt sauce","tzatziki","olives","avocado","bacon","egg","mushroom","bell pepper","basil",
    "sumac onion","chimichurri","hot sauce","bbq sauce","chili","cinnamon sugar",
}
AMENITIES = ["seating_available","outdoor_seating","kid_friendly","dog_friendly",
             "wheelchair_accessible","wifi_available","cash_only","restrooms_nearby"]

# ---------------------------------------------------------------------------
# 1. LOAD REAL TRUCKS
# ---------------------------------------------------------------------------
raw = json.load(open(os.path.join(DATA, "foodtrucks-sf.json")))

_DAY = {"monday": "mon", "tuesday": "tue", "wednesday": "wed", "thursday": "thu",
        "friday": "fri", "saturday": "sat", "sunday": "sun"}

def parse_hours(opening):
    """['Monday 11:00-15:00', 'Monday 17:00-21:00', ...] -> {'mon':[{start,end}], ...}"""
    out = {}
    if not opening:
        return None
    for entry in opening:
        m = re.match(r"(\w+)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})", entry.strip())
        if not m:
            continue
        day = _DAY.get(m.group(1).lower())
        if not day:
            continue
        # Yelp encodes midnight as "24:00" (and occasionally >24 for after-midnight);
        # clamp to a valid time so it parses and is_open_now() works.
        def fix(t):
            h, mm = t.split(":")
            return "23:59" if int(h) >= 24 else t
        out.setdefault(day, []).append({"start": fix(m.group(2)), "end": fix(m.group(3))})
    return out or None

def price_tier(p):
    return p if p in ("$", "$$", "$$$", "$$$$") else None

# ---------------------------------------------------------------------------
# 2. CUISINE -> MENU TEMPLATE LIBRARY
#    item = (name, category, base_price, spice, [dietary], protein_g, prep_min,
#            [allergens], [(ingredient, qty, unit), ...])
# ---------------------------------------------------------------------------
V, VG, GF, HAL, DF = "vegetarian", "vegan", "gluten_free", "halal", "dairy_free"

MENUS = {
"mexican": [
    ("Carne Asada Taco","taco",4.50,"medium",[GF],18,6,[], [("corn tortilla",2,"unit"),("beef",0.12,"kg"),("onion",0.02,"kg"),("cilantro",0.01,"kg")]),
    ("Al Pastor Taco","taco",4.50,"medium",[GF],16,6,[], [("corn tortilla",2,"unit"),("pork",0.12,"kg"),("pineapple",0.03,"kg")]),
    ("Veggie Taco","taco",4.00,"mild",[V,GF],7,5,["dairy"], [("corn tortilla",2,"unit"),("black beans",0.08,"kg"),("cheese",0.03,"kg")]),
    ("Chicken Burrito","burrito",11.00,"medium",[],34,9,["dairy","gluten"], [("flour tortilla",1,"unit"),("chicken",0.18,"kg"),("rice",0.15,"kg"),("black beans",0.08,"kg"),("cheese",0.03,"kg")]),
    ("Carnitas Quesadilla","quesadilla",9.50,"mild",[],22,8,["dairy","gluten"], [("flour tortilla",1,"unit"),("pork",0.14,"kg"),("cheese",0.06,"kg")]),
    ("Chips & Guacamole","side",6.50,"mild",[VG,GF],4,4,[], [("tortilla chips",0.08,"kg"),("avocado",0.15,"kg"),("lime",0.02,"kg")]),
    ("Elote (Street Corn)","side",5.00,"mild",[V,GF],5,5,["dairy"], [("corn",1,"unit"),("cotija cheese",0.03,"kg"),("mayo",0.02,"kg")]),
    ("Horchata","drink",3.50,"none",[V,GF],2,2,["dairy"], [("rice milk",0.35,"liter"),("cinnamon",0.005,"kg")]),
],
"tacos": "mexican",
"burgers": [
    ("Classic Cheeseburger","burger",11.00,"none",[],27,9,["dairy","gluten"], [("burger bun",1,"unit"),("beef patty",0.15,"kg"),("cheese",0.03,"kg"),("lettuce",0.02,"kg")]),
    ("Bacon BBQ Burger","burger",13.50,"mild",[],32,11,["dairy","gluten"], [("burger bun",1,"unit"),("beef patty",0.15,"kg"),("bacon",0.04,"kg"),("cheese",0.03,"kg"),("bbq sauce",0.02,"kg")]),
    ("Veggie Burger","burger",10.50,"none",[V],18,9,["gluten"], [("burger bun",1,"unit"),("veggie patty",0.13,"kg"),("lettuce",0.02,"kg"),("tomato",0.03,"kg")]),
    ("Loaded Fries","side",7.00,"mild",[V],9,8,["dairy"], [("potato",0.25,"kg"),("cheese",0.05,"kg"),("green onion",0.01,"kg")]),
    ("Chicken Sandwich","sandwich",12.00,"medium",[],30,10,["gluten"], [("brioche bun",1,"unit"),("chicken breast",0.16,"kg"),("pickles",0.02,"kg")]),
    ("Milkshake","drink",5.50,"none",[V,GF],8,3,["dairy"], [("milk",0.3,"liter"),("ice cream",0.12,"kg")]),
],
"sandwiches": [
    ("Italian Sub","sandwich",11.50,"mild",[],26,7,["gluten","dairy"], [("sub roll",1,"unit"),("salami",0.06,"kg"),("provolone",0.04,"kg"),("lettuce",0.02,"kg")]),
    ("Turkey Club","sandwich",11.00,"none",[],28,7,["gluten"], [("sourdough",2,"unit"),("turkey",0.1,"kg"),("bacon",0.03,"kg"),("tomato",0.03,"kg")]),
    ("Veggie Melt","sandwich",9.50,"none",[V],14,7,["gluten","dairy"], [("sourdough",2,"unit"),("cheese",0.05,"kg"),("mushroom",0.05,"kg"),("bell pepper",0.04,"kg")]),
    ("Chips","side",2.50,"none",[VG,GF],2,1,[], [("potato chips",0.05,"kg")]),
],
"wraps": "sandwiches",
"hot_dogs": [
    ("Classic Hot Dog","hot dog",6.00,"none",[],12,4,["gluten"], [("hot dog bun",1,"unit"),("sausage",0.08,"kg")]),
    ("Chili Cheese Dog","hot dog",8.00,"mild",[],18,6,["gluten","dairy"], [("hot dog bun",1,"unit"),("sausage",0.08,"kg"),("chili",0.06,"kg"),("cheese",0.03,"kg")]),
    ("Veggie Dog","hot dog",6.50,"none",[V],9,4,["gluten"], [("hot dog bun",1,"unit"),("veggie sausage",0.08,"kg")]),
],
"korean": [
    ("Bulgogi Beef Bowl","bowl",13.00,"medium",[GF,DF],32,9,["soy"], [("rice",0.2,"kg"),("beef",0.16,"kg"),("kimchi",0.05,"kg"),("soy sauce",0.02,"liter")]),
    ("Spicy Pork Bowl","bowl",12.50,"hot",[GF,DF],30,9,["soy"], [("rice",0.2,"kg"),("pork",0.16,"kg"),("gochujang",0.03,"kg")]),
    ("Kimchi Fried Rice","bowl",10.50,"medium",[V],12,8,["soy","egg"], [("rice",0.22,"kg"),("kimchi",0.06,"kg"),("egg",1,"unit")]),
    ("Korean Fried Chicken","side",11.00,"medium",[DF],26,10,["gluten","soy"], [("chicken wings",0.2,"kg"),("gochujang",0.03,"kg"),("flour",0.05,"kg")]),
    ("Japchae","noodles",10.00,"mild",[VG,DF],8,8,["soy"], [("glass noodles",0.15,"kg"),("mixed vegetables",0.1,"kg"),("soy sauce",0.02,"liter")]),
],
"japanese": [
    ("Chicken Teriyaki Bowl","bowl",12.00,"none",[DF],30,8,["soy"], [("rice",0.2,"kg"),("chicken",0.17,"kg"),("teriyaki sauce",0.03,"liter")]),
    ("Salmon Poke Bowl","bowl",14.00,"mild",[GF,DF],28,7,["soy","fish"], [("rice",0.18,"kg"),("salmon",0.15,"kg"),("edamame",0.05,"kg"),("seaweed",0.01,"kg")]),
    ("Veggie Ramen","noodles",11.50,"mild",[V],14,9,["gluten","soy","egg"], [("ramen noodles",0.15,"kg"),("miso broth",0.35,"liter"),("egg",1,"unit"),("scallion",0.01,"kg")]),
    ("Gyoza (6pc)","side",7.00,"mild",[],12,6,["gluten","soy"], [("gyoza wrapper",6,"unit"),("pork",0.06,"kg"),("cabbage",0.03,"kg")]),
],
"poke": [
    ("Ahi Tuna Poke Bowl","bowl",14.50,"mild",[GF,DF],30,6,["soy","fish"], [("rice",0.18,"kg"),("tuna",0.16,"kg"),("edamame",0.05,"kg"),("seaweed",0.01,"kg"),("soy sauce",0.02,"liter")]),
    ("Spicy Salmon Bowl","bowl",14.00,"hot",[GF],28,6,["soy","fish","egg"], [("rice",0.18,"kg"),("salmon",0.15,"kg"),("spicy mayo",0.03,"kg")]),
    ("Tofu Veggie Bowl","bowl",11.50,"mild",[VG,GF],16,6,["soy"], [("rice",0.18,"kg"),("tofu",0.14,"kg"),("edamame",0.05,"kg"),("cucumber",0.04,"kg")]),
],
"hawaiian": [
    ("Kalua Pork Plate","plate",13.50,"none",[GF,DF],34,10,[], [("rice",0.2,"kg"),("pork",0.2,"kg"),("cabbage",0.06,"kg")]),
    ("Huli Huli Chicken","plate",12.50,"mild",[GF,DF],32,10,["soy"], [("rice",0.2,"kg"),("chicken",0.18,"kg"),("pineapple",0.04,"kg")]),
    ("Spam Musubi","side",4.50,"none",[DF],10,4,["soy"], [("rice",0.1,"kg"),("spam",0.05,"kg"),("seaweed",0.01,"kg")]),
],
"chinese": [
    ("Kung Pao Chicken","bowl",11.50,"hot",[DF],28,8,["soy","nuts"], [("rice",0.2,"kg"),("chicken",0.16,"kg"),("peanuts",0.03,"kg"),("chili",0.02,"kg")]),
    ("Beef Chow Mein","noodles",11.00,"mild",[DF],24,8,["gluten","soy"], [("egg noodles",0.16,"kg"),("beef",0.14,"kg"),("mixed vegetables",0.08,"kg")]),
    ("Veggie Fried Rice","bowl",9.50,"mild",[V],10,7,["soy","egg"], [("rice",0.22,"kg"),("mixed vegetables",0.1,"kg"),("egg",1,"unit"),("soy sauce",0.02,"liter")]),
    ("Pork Dumplings (6)","side",7.50,"mild",[],14,6,["gluten","soy"], [("dumpling wrapper",6,"unit"),("pork",0.07,"kg"),("cabbage",0.03,"kg")]),
],
"szechuan": [
    ("Mapo Tofu","bowl",10.50,"hot",[V],14,8,["soy"], [("rice",0.2,"kg"),("tofu",0.15,"kg"),("doubanjiang",0.03,"kg"),("szechuan pepper",0.005,"kg")]),
    ("Dan Dan Noodles","noodles",11.00,"hot",[DF],18,8,["gluten","soy","nuts"], [("wheat noodles",0.16,"kg"),("pork",0.08,"kg"),("sesame paste",0.03,"kg"),("chili oil",0.02,"liter")]),
    ("Chili Garlic Green Beans","side",8.00,"medium",[VG],6,6,["soy"], [("green beans",0.15,"kg"),("garlic",0.02,"kg"),("chili",0.01,"kg")]),
],
"noodles": [
    ("Garlic Noodles","noodles",10.00,"mild",[V],10,7,["gluten","dairy"], [("noodles",0.18,"kg"),("garlic",0.03,"kg"),("butter",0.03,"kg")]),
    ("Spicy Beef Noodle Soup","noodles",12.50,"hot",[DF],26,10,["gluten","soy"], [("noodles",0.16,"kg"),("beef",0.15,"kg"),("beef broth",0.4,"liter"),("chili",0.02,"kg")]),
    ("Veggie Pad See Ew","noodles",11.00,"mild",[V],12,8,["soy","egg"], [("rice noodles",0.16,"kg"),("mixed vegetables",0.1,"kg"),("egg",1,"unit")]),
],
"thai": [
    ("Pad Thai","noodles",12.00,"mild",[DF],20,8,["nuts","egg","fish"], [("rice noodles",0.16,"kg"),("chicken",0.12,"kg"),("peanuts",0.03,"kg"),("egg",1,"unit"),("tamarind",0.02,"kg")]),
    ("Green Curry","bowl",12.50,"hot",[GF,DF],22,9,[], [("rice",0.2,"kg"),("chicken",0.14,"kg"),("coconut milk",0.2,"liter"),("green curry paste",0.03,"kg")]),
    ("Mango Sticky Rice","dessert",6.50,"none",[VG,GF],4,4,[], [("sticky rice",0.15,"kg"),("mango",0.1,"kg"),("coconut milk",0.1,"liter")]),
],
"vietnamese": [
    ("Beef Pho","noodles",12.50,"mild",[GF,DF],26,10,[], [("rice noodles",0.16,"kg"),("beef",0.14,"kg"),("beef broth",0.45,"liter"),("basil",0.01,"kg")]),
    ("Banh Mi","sandwich",9.00,"mild",[DF],20,6,["gluten"], [("baguette",1,"unit"),("pork",0.1,"kg"),("pickled carrot",0.03,"kg"),("cilantro",0.01,"kg")]),
    ("Spring Rolls (2)","side",6.00,"none",[VG,GF],6,5,[], [("rice paper",2,"unit"),("vermicelli",0.05,"kg"),("lettuce",0.03,"kg")]),
],
"filipino": [
    ("Chicken Adobo Plate","plate",12.00,"mild",[GF,DF],30,10,["soy"], [("rice",0.2,"kg"),("chicken",0.18,"kg"),("soy sauce",0.03,"liter"),("vinegar",0.02,"liter")]),
    ("Pork Sisig","plate",12.50,"medium",[GF,DF],28,10,["egg"], [("rice",0.2,"kg"),("pork",0.17,"kg"),("onion",0.03,"kg"),("egg",1,"unit")]),
    ("Lumpia (4)","side",6.50,"none",[DF],10,6,["gluten"], [("lumpia wrapper",4,"unit"),("pork",0.06,"kg"),("carrot",0.03,"kg")]),
],
"indian": [
    ("Chicken Tikka Masala","bowl",12.50,"medium",[GF],30,10,["dairy"], [("rice",0.2,"kg"),("chicken",0.17,"kg"),("tomato",0.08,"kg"),("cream",0.05,"liter"),("garam masala",0.01,"kg")]),
    ("Paneer Tikka Masala","bowl",11.50,"medium",[V,GF],20,9,["dairy"], [("rice",0.2,"kg"),("paneer",0.15,"kg"),("tomato",0.08,"kg"),("cream",0.05,"liter")]),
    ("Chana Masala","bowl",10.50,"medium",[VG,GF],14,8,[], [("rice",0.2,"kg"),("chickpeas",0.15,"kg"),("tomato",0.06,"kg"),("onion",0.03,"kg")]),
    ("Garlic Naan","side",3.50,"none",[V],6,4,["gluten","dairy"], [("flour",0.1,"kg"),("garlic",0.01,"kg"),("butter",0.02,"kg")]),
    ("Samosa (2)","side",5.00,"mild",[V],8,5,["gluten"], [("pastry",2,"unit"),("potato",0.1,"kg"),("peas",0.03,"kg")]),
    ("Mango Lassi","drink",4.00,"none",[V,GF],5,2,["dairy"], [("yogurt",0.2,"liter"),("mango",0.08,"kg")]),
],
"pakistani": [
    ("Chicken Biryani","bowl",12.50,"medium",[GF,DF],30,11,[], [("basmati rice",0.22,"kg"),("chicken",0.18,"kg"),("biryani masala",0.02,"kg"),("onion",0.04,"kg")]),
    ("Beef Seekh Kebab","plate",13.00,"medium",[GF,DF,HAL],32,10,[], [("naan",1,"unit"),("beef",0.18,"kg"),("garam masala",0.01,"kg")]),
    ("Daal","bowl",9.00,"mild",[VG,GF],12,7,[], [("lentils",0.15,"kg"),("onion",0.03,"kg"),("tomato",0.04,"kg")]),
],
"halal": [
    ("Chicken Over Rice","plate",11.00,"medium",[HAL,DF],32,9,["dairy"], [("rice",0.22,"kg"),("chicken",0.18,"kg"),("white sauce",0.03,"kg"),("lettuce",0.03,"kg")]),
    ("Lamb Gyro","sandwich",11.50,"mild",[HAL],28,8,["gluten","dairy"], [("pita",1,"unit"),("lamb",0.15,"kg"),("tzatziki",0.03,"kg"),("tomato",0.03,"kg")]),
    ("Falafel Wrap","sandwich",9.50,"mild",[VG,HAL],14,7,["gluten"], [("pita",1,"unit"),("falafel",0.12,"kg"),("hummus",0.04,"kg"),("lettuce",0.03,"kg")]),
    ("Baklava","dessert",4.00,"none",[V],6,2,["gluten","nuts"], [("phyllo",0.04,"kg"),("walnuts",0.03,"kg"),("honey",0.02,"kg")]),
],
"mediterranean": [
    ("Chicken Shawarma Plate","plate",12.50,"mild",[GF,DF],32,9,[], [("rice",0.2,"kg"),("chicken",0.18,"kg"),("garlic sauce",0.03,"kg"),("tomato",0.04,"kg")]),
    ("Falafel Bowl","bowl",10.50,"mild",[VG],14,8,[], [("rice",0.18,"kg"),("falafel",0.12,"kg"),("hummus",0.05,"kg"),("cucumber",0.04,"kg")]),
    ("Greek Salad","side",8.50,"none",[V,GF],8,5,["dairy"], [("lettuce",0.1,"kg"),("feta",0.04,"kg"),("olives",0.03,"kg"),("tomato",0.05,"kg")]),
    ("Hummus & Pita","side",6.50,"none",[VG],7,4,["gluten"], [("hummus",0.08,"kg"),("pita",1,"unit")]),
],
"greek": "mediterranean",
"turkish": [
    ("Doner Kebab Wrap","sandwich",11.00,"mild",[HAL],28,7,["gluten","dairy"], [("lavash",1,"unit"),("lamb",0.15,"kg"),("yogurt sauce",0.03,"kg"),("onion",0.03,"kg")]),
    ("Adana Kebab Plate","plate",13.50,"medium",[GF,HAL],34,11,[], [("rice",0.2,"kg"),("ground lamb",0.18,"kg"),("sumac onion",0.03,"kg")]),
    ("Lentil Soup","side",6.00,"mild",[VG,GF],9,5,[], [("red lentils",0.12,"kg"),("carrot",0.03,"kg"),("onion",0.02,"kg")]),
],
"kebab": "turkish",
"peruvian": [
    ("Lomo Saltado","bowl",13.50,"mild",[DF],32,10,["soy"], [("rice",0.2,"kg"),("beef",0.16,"kg"),("potato",0.1,"kg"),("onion",0.04,"kg")]),
    ("Aji de Gallina","bowl",12.50,"medium",[],28,10,["dairy","nuts"], [("rice",0.2,"kg"),("chicken",0.16,"kg"),("aji amarillo",0.02,"kg"),("walnuts",0.02,"kg")]),
    ("Ceviche","side",11.00,"medium",[GF,DF],22,6,["fish"], [("white fish",0.15,"kg"),("lime",0.04,"kg"),("red onion",0.03,"kg")]),
],
"argentine": [
    ("Beef Empanada","empanada",4.50,"mild",[],12,5,["gluten"], [("empanada dough",1,"unit"),("beef",0.07,"kg"),("onion",0.02,"kg")]),
    ("Chicken Empanada","empanada",4.50,"none",[],11,5,["gluten"], [("empanada dough",1,"unit"),("chicken",0.07,"kg"),("onion",0.02,"kg")]),
    ("Choripan","sandwich",9.50,"mild",[],22,7,["gluten"], [("baguette",1,"unit"),("chorizo",0.1,"kg"),("chimichurri",0.02,"kg")]),
],
"empanadas": "argentine",
"brazilian": [
    ("Feijoada Bowl","bowl",13.00,"mild",[GF,DF],30,11,[], [("rice",0.2,"kg"),("black beans",0.12,"kg"),("pork",0.14,"kg")]),
    ("Coxinha (3)","side",7.00,"none",[],14,6,["gluten"], [("dough",0.1,"kg"),("chicken",0.08,"kg")]),
    ("Pao de Queijo (4)","side",5.50,"none",[V,GF],8,4,["dairy"], [("tapioca flour",0.08,"kg"),("cheese",0.04,"kg")]),
],
"italian": [
    ("Margherita Pizza Slice","pizza",5.50,"none",[V],12,5,["gluten","dairy"], [("pizza dough",0.12,"kg"),("mozzarella",0.05,"kg"),("tomato sauce",0.04,"kg"),("basil",0.005,"kg")]),
    ("Pepperoni Pizza Slice","pizza",6.00,"mild",[],16,5,["gluten","dairy"], [("pizza dough",0.12,"kg"),("mozzarella",0.05,"kg"),("pepperoni",0.03,"kg")]),
    ("Meatball Sub","sandwich",11.00,"mild",[],28,8,["gluten","dairy"], [("sub roll",1,"unit"),("meatballs",0.15,"kg"),("marinara",0.05,"kg"),("mozzarella",0.03,"kg")]),
    ("Caprese Salad","side",8.50,"none",[V,GF],10,4,["dairy"], [("tomato",0.1,"kg"),("mozzarella",0.06,"kg"),("basil",0.005,"kg")]),
],
"pizza": "italian",
"seafood": [
    ("Fish & Chips","plate",13.50,"none",[],26,10,["gluten","fish"], [("cod",0.16,"kg"),("potato",0.2,"kg"),("batter",0.05,"kg")]),
    ("Shrimp Tacos (2)","taco",11.00,"mild",[DF],20,7,["shellfish"], [("corn tortilla",2,"unit"),("shrimp",0.12,"kg"),("cabbage",0.04,"kg"),("lime",0.02,"kg")]),
    ("Clam Chowder","side",7.50,"none",[],14,5,["dairy","shellfish"], [("clams",0.08,"kg"),("cream",0.15,"liter"),("potato",0.08,"kg")]),
],
"soul_food": [
    ("Fried Chicken Plate","plate",13.00,"mild",[],34,12,["gluten"], [("chicken",0.22,"kg"),("flour",0.05,"kg"),("collard greens",0.08,"kg")]),
    ("Mac & Cheese","side",6.50,"none",[V],12,6,["gluten","dairy"], [("macaroni",0.12,"kg"),("cheese",0.06,"kg"),("milk",0.05,"liter")]),
    ("Cornbread","side",3.50,"none",[V],5,4,["gluten","dairy","egg"], [("cornmeal",0.08,"kg"),("butter",0.02,"kg"),("egg",1,"unit")]),
],
"comfort_food": [
    ("Grilled Cheese","sandwich",8.00,"none",[V],14,6,["gluten","dairy"], [("sourdough",2,"unit"),("cheese",0.06,"kg"),("butter",0.02,"kg")]),
    ("Tomato Soup","side",5.50,"none",[V,GF],5,4,["dairy"], [("tomato",0.2,"kg"),("cream",0.05,"liter")]),
    ("Mac & Cheese","side",6.50,"none",[V],12,6,["gluten","dairy"], [("macaroni",0.12,"kg"),("cheese",0.06,"kg"),("milk",0.05,"liter")]),
],
"american": [
    ("BBQ Pulled Pork Sandwich","sandwich",12.00,"mild",[],28,9,["gluten"], [("brioche bun",1,"unit"),("pork",0.16,"kg"),("bbq sauce",0.03,"kg"),("coleslaw",0.04,"kg")]),
    ("Buffalo Wings (6)","side",11.00,"hot",[GF],26,9,["dairy"], [("chicken wings",0.25,"kg"),("buffalo sauce",0.04,"kg")]),
    ("Cheese Fries","side",6.50,"none",[V],9,7,["dairy"], [("potato",0.25,"kg"),("cheese",0.05,"kg")]),
],
"barbeque": [
    ("Brisket Plate","plate",15.00,"mild",[GF,DF],36,12,[], [("brisket",0.2,"kg"),("bbq sauce",0.03,"kg"),("coleslaw",0.06,"kg")]),
    ("Pulled Pork Sandwich","sandwich",12.00,"mild",[],28,9,["gluten"], [("brioche bun",1,"unit"),("pork",0.16,"kg"),("bbq sauce",0.03,"kg")]),
    ("Cornbread","side",3.50,"none",[V],5,4,["gluten","dairy","egg"], [("cornmeal",0.08,"kg"),("butter",0.02,"kg"),("egg",1,"unit")]),
],
"chicken_shop": [
    ("Crispy Chicken Tenders","side",10.00,"mild",[],28,8,["gluten"], [("chicken",0.2,"kg"),("flour",0.05,"kg")]),
    ("Nashville Hot Chicken Sandwich","sandwich",12.50,"hot",[],30,9,["gluten"], [("brioche bun",1,"unit"),("chicken",0.16,"kg"),("hot sauce",0.03,"kg"),("pickles",0.02,"kg")]),
    ("Waffle Fries","side",5.50,"none",[VG],6,6,[], [("potato",0.25,"kg")]),
],
"breakfast_and_brunch": [
    ("Breakfast Burrito","burrito",10.00,"mild",[],22,8,["gluten","dairy","egg"], [("flour tortilla",1,"unit"),("egg",2,"unit"),("potato",0.1,"kg"),("cheese",0.03,"kg")]),
    ("Avocado Toast","toast",9.50,"none",[VG],9,5,["gluten"], [("sourdough",1,"unit"),("avocado",0.1,"kg"),("cherry tomato",0.03,"kg")]),
    ("Pancake Stack","pancakes",8.50,"none",[V],10,7,["gluten","dairy","egg"], [("flour",0.12,"kg"),("egg",1,"unit"),("milk",0.1,"liter"),("maple syrup",0.03,"liter")]),
],
"pancakes": "breakfast_and_brunch",
"waffles": [
    ("Belgian Waffle","waffle",7.50,"none",[V],10,6,["gluten","dairy","egg"], [("flour",0.12,"kg"),("egg",1,"unit"),("milk",0.1,"liter")]),
    ("Chicken & Waffles","plate",13.00,"mild",[],30,10,["gluten","dairy","egg"], [("flour",0.12,"kg"),("chicken",0.16,"kg"),("maple syrup",0.03,"liter")]),
    ("Strawberry Waffle","waffle",9.00,"none",[V],9,6,["gluten","dairy","egg"], [("flour",0.12,"kg"),("strawberry",0.06,"kg"),("whipped cream",0.03,"kg")]),
],
"coffee_and_tea": [
    ("Latte","drink",4.50,"none",[V,GF],8,3,["dairy"], [("espresso",0.03,"liter"),("milk",0.2,"liter")]),
    ("Cold Brew","drink",4.00,"none",[VG,GF],1,2,[], [("coffee",0.25,"liter")]),
    ("Chai Tea","drink",4.00,"none",[V,GF],4,3,["dairy"], [("chai",0.2,"liter"),("milk",0.1,"liter")]),
    ("Croissant","bakery",3.50,"none",[V],6,1,["gluten","dairy"], [("croissant",1,"unit")]),
],
"cafes": "coffee_and_tea",
"bubble_tea": [
    ("Classic Milk Tea","drink",5.50,"none",[V],6,3,["dairy"], [("black tea",0.3,"liter"),("milk",0.1,"liter"),("tapioca pearls",0.05,"kg")]),
    ("Taro Milk Tea","drink",5.75,"none",[V],6,3,["dairy"], [("taro",0.05,"kg"),("milk",0.15,"liter"),("tapioca pearls",0.05,"kg")]),
    ("Mango Green Tea","drink",5.25,"none",[VG],2,3,[], [("green tea",0.3,"liter"),("mango",0.05,"kg")]),
],
"ice_cream_and_frozen_yogurt": [
    ("Soft Serve Cone","dessert",4.50,"none",[V,GF],5,2,["dairy"], [("soft serve",0.12,"kg"),("cone",1,"unit")]),
    ("Sundae","dessert",6.50,"none",[V,GF],7,3,["dairy","nuts"], [("ice cream",0.15,"kg"),("chocolate sauce",0.03,"kg"),("peanuts",0.02,"kg")]),
    ("Vegan Sorbet","dessert",5.00,"none",[VG,GF],1,2,[], [("sorbet",0.13,"kg")]),
],
"desserts": [
    ("Churros (4)","dessert",5.50,"none",[V],6,5,["gluten","dairy"], [("churro dough",0.1,"kg"),("cinnamon sugar",0.02,"kg")]),
    ("Chocolate Chip Cookie","dessert",3.00,"none",[V],5,1,["gluten","dairy","egg"], [("cookie",1,"unit")]),
    ("Cheesecake Slice","dessert",5.50,"none",[V],8,1,["gluten","dairy","egg"], [("cheesecake",1,"unit")]),
],
"donuts": [
    ("Glazed Donut","dessert",2.50,"none",[V],5,1,["gluten","dairy","egg"], [("donut",1,"unit"),("glaze",0.01,"kg")]),
    ("Chocolate Donut","dessert",3.00,"none",[V],6,1,["gluten","dairy","egg"], [("donut",1,"unit"),("chocolate",0.02,"kg")]),
    ("Donut Holes (6)","dessert",4.00,"none",[V],7,2,["gluten","dairy","egg"], [("donut holes",6,"unit")]),
],
"bakeries": "coffee_and_tea",
"acai_bowls": [
    ("Classic Acai Bowl","bowl",10.50,"none",[VG,GF],8,5,["nuts"], [("acai",0.15,"kg"),("banana",0.06,"kg"),("granola",0.04,"kg"),("berries",0.05,"kg")]),
    ("Peanut Butter Acai Bowl","bowl",11.00,"none",[VG,GF],14,5,["nuts"], [("acai",0.15,"kg"),("peanut butter",0.03,"kg"),("banana",0.06,"kg"),("granola",0.04,"kg")]),
],
"indonesian": [
    ("Nasi Goreng","bowl",11.50,"medium",[DF],20,8,["soy","egg","fish"], [("rice",0.22,"kg"),("chicken",0.12,"kg"),("egg",1,"unit"),("kecap manis",0.02,"liter")]),
    ("Beef Rendang","bowl",13.00,"medium",[GF,DF],30,12,[], [("rice",0.2,"kg"),("beef",0.17,"kg"),("coconut milk",0.15,"liter"),("rendang paste",0.03,"kg")]),
    ("Satay Skewers (4)","side",9.00,"mild",[DF],20,7,["soy","nuts"], [("chicken",0.14,"kg"),("peanut sauce",0.04,"kg")]),
],
}

# generic fallback menu for trucks with no recognized food cuisine
GENERIC = [
    ("House Burger","burger",11.00,"none",[],27,9,["dairy","gluten"], [("burger bun",1,"unit"),("beef patty",0.15,"kg"),("cheese",0.03,"kg")]),
    ("Grilled Chicken Bowl","bowl",11.50,"mild",[GF,DF],32,9,[], [("rice",0.2,"kg"),("chicken",0.17,"kg"),("mixed vegetables",0.08,"kg")]),
    ("Veggie Wrap","sandwich",9.00,"none",[V],12,6,["gluten","dairy"], [("flour tortilla",1,"unit"),("hummus",0.04,"kg"),("mixed vegetables",0.08,"kg")]),
    ("French Fries","side",4.50,"none",[VG],5,6,[], [("potato",0.22,"kg")]),
    ("Soft Drink","drink",2.50,"none",[VG,GF],0,1,[], [("soda",0.35,"liter")]),
    ("Bottled Water","drink",2.00,"none",[VG,GF],0,1,[], [("water",0.5,"liter")]),
]

# tags that are venues/non-food -> ignored for menu building
IGNORE = {"food_court","nightlife","bars","sports_bars","dive_bars","cocktail_bars",
    "bartenders","recreation_centers","active_life","wholesale_stores","cafes_ignore",
    "party_and_event_planning","do_it_yourself_food","specialty_food","food_stands",
    "beer_wine_and_spirits","coffee_roasteries","custom_cakes","fast_food","new_american",
    "steakhouses","shaved_snow"}
# soft remaps for cuisines not given their own template
REMAP = {"fast_food":"burgers","new_american":"american","steakhouses":"american",
    "coffee_roasteries":"coffee_and_tea","custom_cakes":"desserts","shaved_snow":"ice_cream_and_frozen_yogurt",
    "food_court":"american","dim_sum":"chinese","asian_fusion":None}

def resolve(cuisine):
    """Return a MENUS key (following string aliases) or None."""
    c = REMAP.get(cuisine, cuisine)
    if c is None:
        return None
    tgt = MENUS.get(c)
    if isinstance(tgt, str):      # alias like "tacos" -> "mexican"
        return tgt
    if tgt is not None:
        return c
    return None

# ---------------------------------------------------------------------------
# 3. BUILD TRUCKS + OWNERS
# ---------------------------------------------------------------------------
FIRST = ["Maria","Jose","Wei","Kenji","Aisha","Diego","Priya","Sam","Lena","Tomas",
         "Grace","Omar","Yuki","Carlos","Nadia","Ben","Sofia","Raj","Mei","Luca"]
LAST = ["Garcia","Nguyen","Kim","Patel","Lopez","Chen","Rossi","Ahmed","Silva","Park",
        "Martinez","Wong","Reyes","Singh","Torres","Cohen","Diaz","Yamamoto","Khan","Ali"]

owners = []
def new_owner(i):
    name = f"{random.choice(FIRST)} {random.choice(LAST)}"
    oid = f"owner-{i:03d}"
    owners.append({"id": oid, "name": name,
                   "email": name.lower().replace(" ",".")+f"{i}@foodpilot.example",
                   "phone": f"(415) 555-{random.randint(1000,9999)}", "truck_ids": []})
    return oid

trucks = []
owner_idx = 0
for r in raw:
    # every ~1-2 trucks gets a fresh owner; some owners get 2 trucks
    if owner_idx == 0 or random.random() < 0.7:
        oid = new_owner(len(owners)+1)
    trucks.append({
        "id": r["id"],
        "owner_id": oid,
        "name": r["name"],
        "cuisines": r.get("cuisines") or [],
        "description": r.get("description",""),
        "rating": float(r["rating"]) if r.get("rating") is not None else None,
        "review_count": r.get("reviewCount"),
        "price_tier": price_tier(r.get("price")),
        "status": r.get("status") if r.get("status") in ("open","offline") else None,
        "avg_prep_time_min": random.randint(7, 18),
        "location": r.get("current_location") or (
            {"lat": r["latitude"], "lng": r["longitude"]} if r.get("latitude") else None),
        "address": {
            "street": r.get("streetAddress"), "city": r.get("city"),
            "region": r.get("region"), "postal_code": r.get("postalCode"),
            "country": r.get("country"), "formatted": r.get("address"),
        },
        "operating_hours": ({"hours": parse_hours(r.get("openingHours"))}
                            if parse_hours(r.get("openingHours")) else None),
        "service_radius_km": None,
        "phone": r.get("phone"),
        "image_url": r.get("image"),
        "source_url": r.get("url"),
        # realism polish:
        "payment_methods": random.choice([["card","cash"]]*6 + [["card"]]*2 + [["card","cash","mobile"]]*2),
        "order_type": random.choice([["pickup"]]*8 + [["pickup","delivery"]]*2),
    })
    for o in owners:
        if o["id"] == oid and r["id"] not in o["truck_ids"]:
            o["truck_ids"].append(r["id"])
    owner_idx += 1

# truck-level live/ops fields (conditional on status & order_type)
for t in trucks:
    t["amenities"] = sorted(random.sample(AMENITIES, k=random.randint(2, 4)))
    # live queue only makes sense while the truck is open
    t["current_queue_min"] = (random.choice([0, 0, 2, 3, 5, 5, 8, 10, 12, 15])
                              if t.get("status") == "open" else None)
    # delivery economics only when the truck actually delivers
    if "delivery" in (t.get("order_type") or []):
        t["delivery_fee"] = round(random.uniform(2.0, 5.5), 2)
        t["driver_assignment_min"] = random.randint(3, 8)
        t["avg_delivery_time_min"] = random.randint(10, 25)
    else:
        t["delivery_fee"] = None
        t["driver_assignment_min"] = None
        t["avg_delivery_time_min"] = None

# ---------------------------------------------------------------------------
# 4. BUILD MENUS (cuisine-matched), MODIFIERS, INGREDIENTS, RECIPES
# ---------------------------------------------------------------------------
menu_items, modifier_groups, modifiers, recipes = [], [], [], []
ingredient_names = {}   # name -> unit
mi_counter = 0

DRY = {"kg","g","unit"}
def infer_unit(u): return u

# generic modifier sets keyed by category
MODS_BY_CAT = {
    "taco":     [("Add avocado",2.00,"add"),("Add cheese",1.00,"add"),("Extra protein",3.00,"add"),("No onion",0.0,"remove"),("No cilantro",0.0,"remove"),("Add jalapenos",0.50,"add")],
    "burrito":  [("Add guacamole",2.50,"add"),("Add sour cream",1.00,"add"),("Extra protein",3.50,"add"),("No rice",0.0,"remove"),("Add hot sauce",0.0,"add")],
    "quesadilla":[("Add guacamole",2.50,"add"),("Extra cheese",1.50,"add"),("Add protein",3.00,"add")],
    "burger":   [("Add bacon",2.50,"add"),("Add cheese",1.00,"add"),("Add fried egg",1.50,"add"),("No pickles",0.0,"remove"),("No onion",0.0,"remove")],
    "sandwich": [("Add avocado",2.00,"add"),("Add cheese",1.00,"add"),("No onion",0.0,"remove"),("Extra sauce",0.50,"add")],
    "bowl":     [("Extra protein",3.50,"add"),("Add avocado",2.00,"add"),("Extra rice",1.50,"add"),("Make it spicy",0.0,"add"),("No onion",0.0,"remove")],
    "plate":    [("Extra protein",3.50,"add"),("Extra rice",1.50,"add"),("Add sauce",0.50,"add")],
    "noodles":  [("Add egg",1.50,"add"),("Extra veggies",1.50,"add"),("Extra spicy",0.0,"add"),("No peanuts",0.0,"remove")],
    "pizza":    [("Extra cheese",1.50,"add"),("Add pepperoni",2.00,"add"),("Add mushrooms",1.00,"add")],
    "hot dog":  [("Add cheese",1.00,"add"),("Add chili",1.50,"add"),("No onion",0.0,"remove")],
    "wrap":     [("Add hummus",1.00,"add"),("Extra protein",3.00,"add")],
    "drink":    [("Large size",1.00,"substitute"),("Extra shot",1.00,"add"),("Oat milk",0.75,"substitute")],
    "dessert":  [("Add whipped cream",0.75,"add"),("Extra topping",1.00,"add")],
}

def add_ingredient(name, unit):
    if name not in ingredient_names:
        ingredient_names[name] = unit

# EXACT ingredient -> allergen flags. Only allergen-bearing ingredients are listed;
# anything not here is allergen-free. Built from the real 180-ingredient list so the
# corn-tortilla-is-gluten-free / rice-noodles-are-GF cases are correct.
def _mk(names, flag, d):
    for n in names: d.setdefault(n, set()).add(flag)

ALLERGEN_BY_NAME = {}
_mk(["cheese","cheesecake","cotija cheese","cream","feta","ice cream","milk","mozzarella",
     "paneer","provolone","soft serve","tzatziki","whipped cream","white sauce","yogurt",
     "yogurt sauce","butter","chocolate","chocolate sauce","rice milk"], "dairy", ALLERGEN_BY_NAME)
_mk(["baguette","batter","brioche bun","burger bun","churro dough","cookie","croissant",
     "dough","dumpling wrapper","egg noodles","empanada dough","flour","flour tortilla",
     "gyoza wrapper","hot dog bun","lavash","lumpia wrapper","macaroni","naan","noodles",
     "pastry","phyllo","pizza dough","ramen noodles","sourdough","sub roll","wheat noodles",
     "donut","donut holes","cone","cheesecake","marinara","soy sauce","teriyaki sauce",
     "kecap manis"], "gluten", ALLERGEN_BY_NAME)
_mk(["egg","egg noodles","mayo","spicy mayo","meatballs","batter","cookie","cheesecake",
     "croissant","donut","donut holes","white sauce"], "egg", ALLERGEN_BY_NAME)
_mk(["peanuts","peanut butter","peanut sauce","walnuts","granola"], "nuts", ALLERGEN_BY_NAME)
_mk(["sesame paste","hummus"], "sesame", ALLERGEN_BY_NAME)
_mk(["cod","salmon","tuna","white fish"], "fish", ALLERGEN_BY_NAME)
_mk(["clams","shrimp"], "shellfish", ALLERGEN_BY_NAME)
_mk(["tofu","edamame","soy sauce","teriyaki sauce","kecap manis","gochujang","doubanjiang",
     "miso broth","veggie patty","veggie sausage"], "soy", ALLERGEN_BY_NAME)

def ing_allergens(name):
    return sorted(ALLERGEN_BY_NAME.get(name, set()))

def build_menu_for_truck(truck):
    global mi_counter
    keys = []
    for c in truck["cuisines"]:
        k = resolve(c)
        if k and k not in keys:
            keys.append(k)
    templates = []
    seen_names = set()
    for k in keys:
        for it in MENUS[k]:
            if it[0] not in seen_names:
                templates.append(it); seen_names.add(it[0])
    if not templates:
        templates = list(GENERIC)
    # cap menu size for realism (6-9 items), keep variety
    random.shuffle(templates)
    templates = templates[:random.randint(6,9)]
    # price nudge by tier
    bump = {"$":-0.75,"$$":0.0,"$$$":1.5,"$$$$":3.0}.get(truck.get("price_tier"), 0.0)
    for (name,cat,price,spice,diet,protein,prep,allerg,ings) in templates:
        mi_counter += 1
        mid = f"mi-{mi_counter:04d}"
        final_price = round(max(1.5, price + bump + random.uniform(-0.3,0.3)), 2)
        pop = round(random.uniform(0.1,1.0),2)
        # derived allergens = union(template hint, every ingredient's allergens) -> never understated
        derived_allergens = set(allerg)
        for (iname, qty, unit) in ings:
            derived_allergens.update(ing_allergens(iname))
            add_ingredient(iname, unit)
            recipes.append({"menu_item_id": mid, "ingredient_id": f"ing-{iname.replace(' ','_')}",
                            "quantity": qty, "unit": unit})
        # marketing labels (derived, so they never contradict the data)
        labels = []
        if spice in ("medium","hot"): labels.append("spicy")
        if "vegan" in diet: labels.append("vegan")
        elif "vegetarian" in diet: labels.append("vegetarian")
        if protein and protein >= 28: labels.append("high_protein")
        if pop >= 0.85: labels.append("bestseller")
        if random.random() < 0.08: labels.append("new")
        # category -> modifier set (needed early so add_ons stay consistent with Modifiers)
        base_cat = cat if cat in MODS_BY_CAT else ("drink" if cat in ("bakery",) else
                    "bowl" if cat in ("toast","waffle","pancakes","empanada") else
                    "dessert" if cat in ("dessert",) else "sandwich")
        mods = MODS_BY_CAT.get(base_cat)
        # --- new fields, all DERIVED so they never contradict existing data ---
        spice_score = 0 if spice == "none" else random.randint(*SPICE_RANGE[spice])
        base_ings = [iname for (iname, _, _) in ings]
        removable = [i for i in base_ings if i in REMOVABLE]
        add_ons = [{"name": mname.replace("Add ", "").replace("Extra ", "extra ").lower(),
                    "price": round(delta, 2)}
                   for (mname, delta, action) in (mods or []) if action == "add" and delta > 0][:3]
        is_avail = random.random() > 0.08          # ~8% sold out
        availability_status = ("out_of_stock" if not is_avail
                               else random.choice(["in_stock"]*8 + ["limited"]*2))
        available_days = None
        if random.random() < 0.15:                 # ~15% of items are day-limited specials
            available_days = sorted(random.sample(WEEKDAYS, k=random.randint(2, 4)),
                                    key=WEEKDAYS.index)
        menu_items.append({
            "id": mid, "truck_id": truck["id"], "name": name, "category": cat,
            "description": f"{name} at {truck['name']}",
            "base_price": final_price, "currency": "USD",
            "dietary_tags": diet, "allergens": sorted(derived_allergens), "spice_level": spice,
            "spice_score": spice_score,
            "calories": int(protein*12 + random.randint(150,400)) if protein else random.randint(120,300),
            "protein_g": protein, "prep_time_min": prep,
            "is_available": is_avail, "availability_status": availability_status,
            "popularity_score": pop, "labels": labels, "image_url": None,
            "base_ingredients": base_ings, "removable_ingredients": removable,
            "add_ons": add_ons, "available_days": available_days,
        })
        # modifier group for this item (same `mods`, so Modifier records match add_ons)
        if mods:
            gid = f"mg-{mid}"
            modifier_groups.append({"id": gid, "menu_item_id": mid,
                "name": "Customize", "required": False, "min_select": 0, "max_select": 4})
            for j,(mname,delta,action) in enumerate(mods):
                modifiers.append({"id": f"{gid}-{j}", "group_id": gid,
                    "name": mname, "price_delta": round(delta,2), "action": action})

for t in trucks:
    build_menu_for_truck(t)

# ingredient master
ingredients = []
for name, unit in sorted(ingredient_names.items()):
    ingredients.append({"id": f"ing-{name.replace(' ','_')}", "name": name,
                        "unit": unit, "allergen_flags": ing_allergens(name)})

# ---------------------------------------------------------------------------
# 5. STOCK PER TRUCK (only ingredients that truck actually uses)
# ---------------------------------------------------------------------------
truck_items = {}
for mi in menu_items:
    truck_items.setdefault(mi["truck_id"], []).append(mi["id"])
recipe_by_item = {}
for rl in recipes:
    recipe_by_item.setdefault(rl["menu_item_id"], []).append(rl["ingredient_id"])

stock = []
now = datetime(2026, 8, 7, 9, 0, 0)
for t in trucks:
    ings = set()
    for mid in truck_items.get(t["id"], []):
        ings.update(recipe_by_item.get(mid, []))
    for ig in sorted(ings):
        onhand = round(random.uniform(2, 25), 1)
        stock.append({"truck_id": t["id"], "ingredient_id": ig,
            "quantity_on_hand": onhand,
            "reorder_threshold": round(onhand * random.uniform(0.15,0.35), 1),
            "updated_at": now.isoformat()})

# ---------------------------------------------------------------------------
# 6. CUSTOMERS
# ---------------------------------------------------------------------------
DIETS = [[], [], [], ["vegetarian"], ["vegan"], ["halal"], ["gluten_free"], ["vegetarian","dairy_free"]]
ALLERGIES = [[], [], [], ["nuts"], ["dairy"], ["shellfish"], ["gluten"]]
customers = []
for i in range(1, 41):
    name = f"{random.choice(FIRST)} {random.choice(LAST)}"
    joined = datetime(2026,8,7) - timedelta(days=random.randint(30, 730))
    customers.append({
        "id": f"cust-{i:03d}", "name": name,
        "email": name.lower().replace(" ",".")+f"{i}@example.com",
        "phone": f"(415) 555-{random.randint(1000,9999)}",
        "dietary_preferences": random.choice(DIETS),
        "allergies": random.choice(ALLERGIES),
        "favorite_truck_ids": random.sample([t["id"] for t in trucks], k=random.randint(0,3)),
        "default_location": {"lat": round(37.77+random.uniform(-0.03,0.03),5),
                             "lng": round(-122.41+random.uniform(-0.03,0.03),5)},
        "created_at": joined.isoformat(),
        "order_count": 0,   # computed after orders are generated
    })

# ---------------------------------------------------------------------------
# 7. ORDERS (last 30 days, snapshot prices, some modifiers, time-of-day skew)
# ---------------------------------------------------------------------------
mi_by_id = {m["id"]: m for m in menu_items}
mods_by_item = {}
for mg in modifier_groups:
    mods_by_item.setdefault(mg["menu_item_id"], mg["id"])
mods_in_group = {}
for m in modifiers:
    mods_in_group.setdefault(m["group_id"], []).append(m)

orders, order_items, order_item_mods = [], [], []
oi_counter = 0
open_trucks = [t for t in trucks if truck_items.get(t["id"])]
STATUS_WEIGHTS = (["completed"]*80 + ["cancelled"]*5 + ["ready"]*5 + ["preparing"]*5 + ["confirmed"]*5)
_WD = ["mon","tue","wed","thu","fri","sat","sun"]
LUNCH_DINNER = [11,12,12,13,13,17,18,18,19,19,20]  # fallback skew when no hours

def order_time(truck, day):
    """Pick a realistic order datetime: inside the truck's hours for that weekday
    (lunch/dinner skew within the window), else fall back to typical service hours."""
    oh = (truck.get("operating_hours") or {}).get("hours") if truck.get("operating_hours") else None
    windows = oh.get(_WD[day.weekday()]) if oh else None
    if windows:
        w = random.choice(windows)
        sh, sm = map(int, w["start"].split(":"))
        eh, em = map(int, w["end"].split(":"))
        start_min, end_min = sh*60+sm, eh*60+em
        if end_min - start_min < 30:            # tiny window, just use start
            m = start_min
        else:
            m = random.randint(start_min, max(start_min, end_min-15))
        return day.replace(hour=m//60, minute=m%60, second=0, microsecond=0)
    hour = random.choice(LUNCH_DINNER)
    return day.replace(hour=hour, minute=random.randint(0,59), second=0, microsecond=0)

for i in range(1, 261):
    t = random.choice(open_trucks)
    items = truck_items[t["id"]]
    days_ago = random.randint(0, 29)
    day = (now - timedelta(days=days_ago)).replace(hour=0, minute=0, second=0, microsecond=0)
    created = order_time(t, day)
    n_items = random.randint(1,3)
    subtotal = 0.0
    oid = f"order-{i:04d}"
    line_ids = []
    for _ in range(n_items):
        mid = random.choice(items)
        mi = mi_by_id[mid]
        qty = random.randint(1,2)
        unit_price = mi["base_price"]
        line_mod_total = 0.0
        oi_counter += 1
        oiid = f"oi-{oi_counter:05d}"
        # sometimes apply 1 modifier
        gid = mods_by_item.get(mid)
        applied = []
        if gid and random.random() < 0.4:
            chosen = random.choice(mods_in_group[gid])
            applied.append(chosen)
            line_mod_total += chosen["price_delta"]
            order_item_mods.append({"order_item_id": oiid, "modifier_id": chosen["id"],
                                    "price_delta": chosen["price_delta"]})
        line_total = round((unit_price + line_mod_total) * qty, 2)
        subtotal += line_total
        order_items.append({"id": oiid, "order_id": oid, "menu_item_id": mid,
            "quantity": qty, "unit_price": unit_price, "line_total": line_total,
            "special_instructions": None})
        line_ids.append(oiid)
    subtotal = round(subtotal, 2)
    tax = round(subtotal * 0.0875, 2)
    status = random.choice(STATUS_WEIGHTS)
    tip = round(subtotal * random.choice([0,0,0.1,0.15,0.18,0.2]), 2)
    total = round(subtotal + tax + tip, 2)
    orders.append({"id": oid, "customer_id": random.choice(customers)["id"],
        "truck_id": t["id"], "status": status, "created_at": created.isoformat(),
        "estimated_ready_at": (created+timedelta(minutes=random.randint(8,25))).isoformat(),
        "subtotal": subtotal, "tax": tax, "tip": tip, "total": total,
        "payment_status": "refunded" if status=="cancelled" else "paid"})

# ---------------------------------------------------------------------------
# 8. REVIEWS (templated, topic-tagged, sentiment-correlated) for Phase 8
# ---------------------------------------------------------------------------
POS = {
    "taste": ["Absolutely delicious, best {c} in the city.","The flavors were incredible.","So tasty, I came back twice."],
    "portion": ["Generous portions for the price.","Huge serving, totally filling."],
    "service": ["Super friendly staff.","Quick and welcoming service."],
    "value": ["Great value for the money.","Cheap and amazing."],
}
NEG = {
    "wait_time": ["Waited 35 minutes, way too long.","The line moved so slowly.","Took forever to get my order."],
    "portion": ["Portion was tiny for the price.","Left hungry, not enough food."],
    "pricing": ["Too expensive for what you get.","Overpriced honestly."],
    "parking": ["Impossible to find parking nearby.","No parking anywhere close."],
    "taste": ["It was bland and underwhelming.","Not much flavor at all."],
}
reviews = []
rev_i = 0
completed_orders = [o for o in orders if o["status"]=="completed"]
# also seed reviews for popular trucks without orders, to get volume
for o in completed_orders:
    if random.random() < 0.75:  # ~75% of completed orders reviewed
        rev_i += 1
        t = next(tt for tt in trucks if tt["id"]==o["truck_id"])
        cuisine = (t["cuisines"] or ["street food"])[0].replace("_"," ")
        good = random.random() < 0.68
        if good:
            topic = random.choice(list(POS))
            text = random.choice(POS[topic]).format(c=cuisine)
            rating = random.choice([4,5,5,5])
            sentiment = "positive"
            topics = [topic]
        else:
            topic = random.choice(list(NEG))
            text = random.choice(NEG[topic])
            rating = random.choice([1,2,2,3])
            sentiment = "negative"
            topics = [topic]
        # reviews arrive AFTER the meal, not at the same instant
        rev_at = datetime.fromisoformat(o["created_at"]) + timedelta(
            hours=random.randint(1, 72), minutes=random.randint(0,59))
        reviews.append({"id": f"rev-{rev_i:04d}", "order_id": o["id"],
            "truck_id": o["truck_id"], "customer_id": o["customer_id"],
            "rating": rating, "text": text, "created_at": rev_at.isoformat(),
            "sentiment": sentiment, "topics": topics})

# ---------------------------------------------------------------------------
# 8b. SUPPLIERS (Phase 9 purchase planning) + customer order counts
# ---------------------------------------------------------------------------
SUP_NAMES = ["Bay Area Restaurant Depot","Golden Gate Wholesale","SF Produce Co","Pacific Foods Supply",
             "Mission Provisions","Coastal Meat & Seafood","Sunrise Bakery Supply","Norcal Fresh Distributors"]
# rough base cost per unit by ingredient category keyword
def base_cost(name, unit):
    n = name.lower()
    if any(k in n for k in ["beef","brisket","lamb","salmon","tuna","cod","shrimp","clams","chicken","pork","turkey","bacon","chorizo","spam","fish","meatballs"]):
        return random.uniform(6, 14)          # proteins, per kg
    if any(k in n for k in ["cheese","paneer","feta","mozzarella","cream","butter"]):
        return random.uniform(4, 9)
    if unit == "liter":
        return random.uniform(1.5, 5)
    if unit == "unit":
        return random.uniform(0.15, 0.8)      # buns, tortillas, wrappers
    return random.uniform(1, 4)               # veg / dry goods per kg

suppliers = []
sup_i = 0
for ing in ingredients:
    for _ in range(random.randint(1, 2)):     # 1-2 suppliers per ingredient
        sup_i += 1
        cost = base_cost(ing["name"], ing["unit"])
        suppliers.append({
            "id": f"sup-{sup_i:04d}",
            "name": random.choice(SUP_NAMES),
            "ingredient_id": ing["id"],
            "price_per_unit": round(cost * random.uniform(0.9, 1.15), 2),
            "lead_time_days": random.choice([1,1,2,2,3,5]),
            "min_order_qty": round(random.choice([1,2,5,10]) * (0.5 if ing["unit"] in ("kg","liter") else 1), 1),
        })

# customer order counts (computed, not faked)
from collections import Counter as _C
_oc = _C(o["customer_id"] for o in orders)
for c in customers:
    c["order_count"] = _oc.get(c["id"], 0)

# ---------------------------------------------------------------------------
# 9. WRITE
# ---------------------------------------------------------------------------
def dump(name, obj):
    path = os.path.join(DATA, name)
    json.dump(obj, open(path, "w"), indent=2)
    print(f"  {name:24s} {len(obj):5d} records")

print("Writing data/ ...")
dump("trucks.json", trucks)
dump("owners.json", owners)
dump("menu_items.json", menu_items)
dump("modifier_groups.json", modifier_groups)
dump("modifiers.json", modifiers)
dump("ingredients.json", ingredients)
dump("recipes.json", recipes)
dump("suppliers.json", suppliers)
dump("stock.json", stock)
dump("customers.json", customers)
dump("orders.json", orders)
dump("order_items.json", order_items)
dump("order_item_mods.json", order_item_mods)
dump("reviews.json", reviews)
print("Done.")
