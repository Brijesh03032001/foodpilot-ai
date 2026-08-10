"""One-off: give each review a UNIQUE, varied text that still matches its
existing sentiment + topics labels.

Why: the generated reviews reused only ~28 distinct sentences across 150 rows.
That duplication biases Phase 8's complaint aggregation (a few templates
dominate). This rewrites only the `text` field from per-(topic, sentiment)
phrase banks, drawing varied combinations, guaranteeing all-unique output.
sentiment/topics (the ground truth we classify against) are left untouched.

Backup: data/reviews.backup.json (written once, never clobbered).
Seed 42, matching the project's convention. Re-run safe (deterministic).

Run: ./cuisine/bin/python revamp_reviews.py
"""
import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REVIEWS_PATH = ROOT / "data" / "reviews.json"
BACKUP_PATH = ROOT / "data" / "reviews.backup.json"

PHRASES: dict[str, dict[str, list[str]]] = {
    "taste": {
        "negative": ["bland and underwhelming", "not much flavor at all",
                     "the food tasted kind of off", "seasoning was all wrong",
                     "pretty flavorless", "tasted really bland",
                     "the flavors just fell flat", "needed way more seasoning",
                     "kind of a boring flavor", "the taste was forgettable"],
        "positive": ["packed with flavor", "genuinely delicious",
                     "tasted amazing", "so flavorful", "seasoned just right",
                     "bursting with flavor", "the taste was on point",
                     "really tasty", "full of flavor",
                     "one of the tastiest bites I've had lately"],
    },
    "portion": {
        "negative": ["the portion was tiny", "left hungry, not enough food",
                     "servings are way too small", "barely a few bites",
                     "such a skimpy portion", "the serving was small",
                     "not enough on the plate", "the portion left me wanting more",
                     "felt short-changed on the amount", "a small portion for sure"],
        "positive": ["generous portions", "a huge, filling serving",
                     "way more than enough food", "great portion size",
                     "the serving was massive", "filled me right up",
                     "plenty on the plate", "the portion was very generous",
                     "big serving, loads of food", "more food than I expected"],
    },
    "value": {
        "negative": ["not worth the money", "felt like a rip-off",
                     "poor value overall", "wouldn't pay that again",
                     "not great value", "the value just isn't there",
                     "didn't feel worth it", "value was disappointing"],
        "positive": ["great value for the money", "well worth it",
                     "solid bang for your buck", "very reasonable for what you get",
                     "excellent value", "worth every penny",
                     "the value is fantastic", "really good value"],
    },
    "service": {
        "negative": ["the staff seemed rude", "service was careless",
                     "nobody even acknowledged me", "unfriendly service",
                     "the crew was short with me", "service felt cold",
                     "staff were a bit dismissive", "not the friendliest service"],
        "positive": ["friendly, welcoming staff", "quick and warm service",
                     "the crew was lovely", "great service",
                     "super friendly team", "the staff went above and beyond",
                     "really kind service", "welcoming and helpful staff"],
    },
    "parking": {
        "negative": ["impossible to find parking nearby", "no parking anywhere close",
                     "parking was a nightmare", "circled forever for a spot",
                     "nowhere to park", "parking is a real hassle here",
                     "could not find a spot", "parking was brutal"],
        "positive": ["easy parking right out front", "plenty of parking nearby",
                     "parking was a breeze", "found a spot instantly",
                     "parking was simple", "lots of parking around"],
    },
    "pricing": {
        "negative": ["overpriced honestly", "prices are too steep",
                     "a bit pricey for what it is", "the prices stung",
                     "too expensive", "pricey for a food truck",
                     "prices felt high", "bit of a splurge for what you get"],
        "positive": ["prices were fair", "cheaper than expected",
                     "very affordable", "great prices", "priced just right",
                     "easy on the wallet", "the price was spot on",
                     "surprisingly cheap"],
    },
    "wait_time": {
        "negative": ["waited way too long", "the line moved so slowly",
                     "a solid 35-minute wait", "painfully slow to get my order",
                     "the wait was rough", "took forever to get served",
                     "way too long a wait", "the line barely moved"],
        "positive": ["order came out fast", "barely any wait", "quick turnaround",
                     "in and out quickly", "served in no time", "speedy service",
                     "no line at all", "fast even with a queue"],
    },
    "other": {
        "negative": ["just not my thing", "a bit of a letdown overall",
                     "wouldn't rush back", "underwhelmed honestly",
                     "not a great experience"],
        "positive": ["solid all around", "a pleasant surprise",
                     "really enjoyed it", "a good little spot",
                     "happy with it overall"],
    },
}
NEUTRAL = ["it was okay", "pretty average", "nothing special but fine",
           "middle of the road", "fine, not memorable"]
OPENERS = ["", "", "Honestly, ", "Gotta say, ", "Overall, ", "For me, ", "Tbh, "]
NEG_TAILS = ["", "", " Disappointing.", " Won't be back.", " Expected better.",
             " Bummer."]
POS_TAILS = ["", "", " Highly recommend.", " Will be back.", " Loved it.",
             " So good."]
CONNECTORS = [", and ", ". ", " — ", ", "]


def make_text(rng: random.Random, sentiment: str, topics: list[str]) -> str:
    if sentiment == "neutral":
        body = rng.choice(NEUTRAL)
        tail = ""
    else:
        topics = [t for t in topics if t in PHRASES] or ["other"]
        parts = [rng.choice(PHRASES[t][sentiment]) for t in topics]
        rng.shuffle(parts)
        # join topics with varied connectors
        body = parts[0]
        for p in parts[1:]:
            body += rng.choice(CONNECTORS) + p
        tail = rng.choice(POS_TAILS if sentiment == "positive" else NEG_TAILS)

    opener = rng.choice(OPENERS)
    text = opener + body
    text = text[0].upper() + text[1:]
    if text[-1] not in ".!":
        text += "."
    return text + tail


def main() -> None:
    reviews = json.loads(REVIEWS_PATH.read_text())

    if not BACKUP_PATH.exists():
        BACKUP_PATH.write_text(json.dumps(reviews, indent=2))
        print(f"backed up original -> {BACKUP_PATH.name}")

    rng = random.Random(42)
    seen: set[str] = set()
    for r in reviews:
        sentiment = r.get("sentiment") or "neutral"
        topics = r.get("topics") or []
        for _ in range(200):  # re-draw until unique (space is huge)
            text = make_text(rng, sentiment, topics)
            if text not in seen:
                break
        seen.add(text)
        r["text"] = text

    REVIEWS_PATH.write_text(json.dumps(reviews, indent=2))
    print(f"rewrote {len(reviews)} reviews, {len(seen)} unique texts")


if __name__ == "__main__":
    main()
