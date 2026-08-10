"""FoodPilot AI service (Python / FastAPI).

The LLM-heavy microservice. It imports the existing `app/` brain (LangChain
chains + LangGraph agents + CreateAI + Chroma) and exposes it over HTTP so the
Java Spring Boot gateway can proxy to it. The gateway — not the browser — is the
normal caller, but CORS is open to the Next.js dev origin for direct testing.

Run from the repo root:
    cuisine/bin/uvicorn ai_service.main:app --port 8000 --reload
"""
import json
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.chains import parse_chain, recommend, parse_and_resolve_order, createai_model
from app.agent import run_owner_copilot
from app.analytics import generate_complaint_report
from app.tools import find_menu_item_id
from app.retrievers import get_menu_retriever
from app.prompts import RECOMMEND_PROMPT
from app.schemas import FoodQuery

DATA = Path(__file__).resolve().parent.parent / "data"

app = FastAPI(title="FoodPilot AI Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8080"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- small lookups so we can enrich resolved orders / filtered reviews --------
_menu = {m["id"]: m for m in json.loads((DATA / "menu_items.json").read_text())}
_trucks = {t["id"]: t for t in json.loads((DATA / "trucks.json").read_text())}
_reviews_all = json.loads((DATA / "reviews.json").read_text())
_menu_by_truck: dict[str, list] = defaultdict(list)
for _m in _menu.values():
    _menu_by_truck[_m["truck_id"]].append(_m)

_CUISINE_EMOJI = {
    "poke": "\U0001F365", "hawaiian": "\U0001F34D", "korean": "\U0001F35C",
    "japanese": "\U0001F361", "asian_fusion": "\U0001F35B", "mexican": "\U0001F32E",
    "tacos": "\U0001F32E", "american": "\U0001F354", "burger": "\U0001F354",
    "turkish": "\U0001F962", "kebab": "\U0001F962", "greek": "\U0001F9C6",
    "filipino": "\U0001F357", "vietnamese": "\U0001F35C", "indonesian": "\U0001F35B",
    "thai": "\U0001F35B", "indian": "\U0001F35B", "chinese": "\U0001F961",
}
_CATEGORY_EMOJI = {
    "drink": "\U0001F964", "burger": "\U0001F354", "sandwich": "\U0001F96A",
    "taco": "\U0001F32E", "bowl": "\U0001F963", "side": "\U0001F35F",
    "dessert": "\U0001F368", "salad": "\U0001F957", "wrap": "\U0001F32F",
    "noodles": "\U0001F35C", "rice": "\U0001F35A", "soup": "\U0001F372",
}
_NAMEPOOL = ["Alex R.", "Priya S.", "Marcus L.", "Dana W.", "Kenji T.", "Sofia M.",
             "Liam O.", "Nina P.", "Omar H.", "Grace K.", "Diego F.", "Mei L."]


def _name_for(cid: str | None) -> str:
    h = sum(ord(c) for c in (cid or "cust"))
    return _NAMEPOOL[h % len(_NAMEPOOL)]


def _dish_emoji(m: dict) -> str:
    c = (m.get("category") or "").lower()
    if c in _CATEGORY_EMOJI:
        return _CATEGORY_EMOJI[c]
    for cu in _trucks.get(m["truck_id"], {}).get("cuisines", []):
        if cu in _CUISINE_EMOJI:
            return _CUISINE_EMOJI[cu]
    return "\U0001F37D"


def _cuisine_emoji(truck: dict) -> str:
    for cu in truck.get("cuisines", []):
        if cu in _CUISINE_EMOJI:
            return _CUISINE_EMOJI[cu]
    return "\U0001F69A"


def _today_hours(t: dict) -> str | None:
    oh = t.get("operating_hours") or {}
    hours = oh.get("hours") if oh else None
    if not hours:
        return None
    dow = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][datetime.now().weekday()]
    slots = hours.get(dow)
    if not slots:
        return None
    return " · ".join(f"{s['start']}–{s['end']}" for s in slots)


def _shape_item(m: dict, truck_name: str) -> dict:
    tags = set(m.get("dietary_tags") or []) | set(m.get("labels") or [])
    dietary = []
    if "vegan" in tags:
        dietary.append("vegan")
    elif "vegetarian" in tags:
        dietary.append("vegetarian")
    if "gluten_free" in tags:
        dietary.append("gluten-free")
    if "bestseller" in tags:
        dietary.append("bestseller")
    desc = (m.get("description") or "").replace(f" at {truck_name}", "").strip()
    if not desc or desc.lower() == m["name"].lower():
        desc = None
    return {
        "id": m["id"], "name": m["name"], "category": m.get("category") or "main",
        "emoji": _dish_emoji(m), "description": desc,
        "price": round(m.get("base_price") or 0, 2), "dietary": dietary,
        "spice": m.get("spice_level") if m.get("spice_level") not in (None, "none") else None,
        "calories": m.get("calories"), "protein_g": m.get("protein_g"),
        "prep_min": m.get("prep_time_min"), "popularity": round(m.get("popularity_score") or 0, 2),
        "available": bool(m.get("is_available", True)),
        "base_ingredients": (m.get("base_ingredients") or [])[:8],
        "removable": (m.get("removable_ingredients") or [])[:8],
        "add_ons": [{"name": a["name"], "price": round(a.get("price") or 0, 2)}
                    for a in (m.get("add_ons") or [])][:5],
    }


def _shape_truck(tid: str) -> dict | None:
    """Full curated-shaped Truck for ANY of the 107 trucks (for the detail page)."""
    t = _trucks.get(tid)
    if not t:
        return None
    menu = sorted(_menu_by_truck.get(tid, []), key=lambda m: -(m.get("popularity_score") or 0))
    reviews = [r for r in _reviews_all if r["truck_id"] == tid][:8]
    return {
        "id": tid, "name": t["name"], "slug": tid, "cuisines": t.get("cuisines") or [],
        "emoji": _cuisine_emoji(t), "rating": t.get("rating"),
        "review_count": t.get("review_count"), "price_tier": t.get("price_tier") or "$$",
        "status": t.get("status"), "prep_min": t.get("avg_prep_time_min"),
        "queue_min": t.get("current_queue_min"),
        "address": (t.get("address") or {}).get("formatted"),
        "neighborhood": (t.get("address") or {}).get("city") or "San Francisco",
        "lat": (t.get("location") or {}).get("lat"), "lng": (t.get("location") or {}).get("lng"),
        "phone": t.get("phone"), "amenities": t.get("amenities") or [],
        "payment_methods": t.get("payment_methods") or [], "order_type": t.get("order_type") or ["pickup"],
        "hours_today": _today_hours(t), "blurb": None,
        "image": t.get("image_url"), "photo": None,
        "menu": [_shape_item(m, t["name"]) for m in menu[:16]],
        "reviews": [{"id": r["id"], "author": _name_for(r.get("customer_id")),
                     "rating": r["rating"], "text": r["text"], "sentiment": r["sentiment"],
                     "topics": r.get("topics") or [], "date": r["created_at"][:10]} for r in reviews],
        "sales": {"revenue": 0, "orders": 0, "aov": 0, "sales_by_day": [], "top_items": []},
        "avg_rating_reviews": t.get("rating"),
        "review_intel": {"counts": {"positive": 0, "neutral": 0, "negative": 0},
                         "total": 0, "complaints": [], "examples": {}, "highlights": []},
    }


def _reco_pair(tid: str | None, iid: str | None) -> dict | None:
    """Build a recommendation card payload from a truck id + item id."""
    if not tid:
        return None
    tr = _trucks.get(tid, {})
    mi = _menu.get(iid, {}) if iid else {}
    return {
        "truckId": tid, "truckName": tr.get("name"),
        "cuisines": tr.get("cuisines") or [], "rating": tr.get("rating"),
        "itemId": iid, "itemName": mi.get("name"),
        "price": round(mi.get("base_price"), 2) if mi.get("base_price") is not None else None,
        "protein": mi.get("protein_g"),
        "waitMin": tr.get("current_queue_min") or tr.get("avg_prep_time_min"),
    }


def _extract_reco(trace: list) -> dict | None:
    """Pull the recommended truck/item out of an agent's tool trace."""
    tid = iid = None
    for step in trace:
        a = step.get("args", {}) or {}
        if a.get("truck_id"):
            tid = a["truck_id"]
        if a.get("item_ids"):
            ids = a["item_ids"]
            if ids:
                iid = ids[0]
        if a.get("item_id"):
            iid = a["item_id"]
    return _reco_pair(tid, iid)


def _strip_think(text: str) -> str:
    """qwen3 emits hidden <think>…</think> reasoning; drop it from answers."""
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    text = re.sub(r"<think>.*$", "", text, flags=re.DOTALL)  # unclosed
    return text.strip()


# ---------------------------------------------------------------- models ------
class TextIn(BaseModel):
    text: str


class ChatIn(BaseModel):
    message: str
    session_id: str | None = None


class AskIn(BaseModel):
    question: str
    truck: str | None = None


class ReportIn(BaseModel):
    truck: str | None = None


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "foodpilot-ai"}


@app.get("/trucks/{truck_id}")
def truck(truck_id: str) -> dict:
    """Full truck + menu for ANY truck (not just the featured 10) — powers
    concierge recommendation links to trucks outside the curated set."""
    shaped = _shape_truck(truck_id)
    if not shaped:
        raise HTTPException(status_code=404, detail=f"no truck '{truck_id}'")
    return shaped


# ---- Phase 1: intent parsing (CreateAI, fast) --------------------------------
@app.post("/parse")
def parse(body: TextIn) -> dict:
    try:
        query = parse_chain.invoke({"text": body.text})
        return {"query": query.model_dump()}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"parse failed: {e}") from e


# ---- Phase 1+2: RAG recommendation (CreateAI + retriever) --------------------
@app.post("/recommend")
def recommend_endpoint(body: TextIn) -> dict:
    try:
        query, docs, answer = recommend(body.text)
        items = [
            {"text": d.page_content, **{k: v for k, v in d.metadata.items()}}
            for d in docs
        ]
        return {
            "query": query.model_dump(),
            "answer": _strip_think(str(answer.content)),
            "items": items,
        }
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"recommend failed: {e}") from e


# ---- Phase 6: nested order parse + modifier resolution (CreateAI) -------------
@app.post("/order/resolve")
def order_resolve(body: TextIn) -> dict:
    try:
        order, resolved = parse_and_resolve_order(body.text)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"order parse failed: {e}") from e

    if resolved is None:
        return {"matched": False, "item": order.item, "quantity": order.quantity}

    item_id = find_menu_item_id(order.item)
    mi = _menu.get(item_id, {})
    truck = _trucks.get(mi.get("truck_id"), {})

    mods = []
    for m in resolved.get("modifications", []):
        for ch in m.get("changes", []):
            applied = bool(ch.get("applied"))
            delta = float(ch.get("price_delta", 0.0) or 0.0)
            mods.append({
                "type": ch.get("type", "add"),
                "name": ch.get("ingredient", ""),
                "priceDelta": delta,
                "status": "applied" if applied else "rejected",
                "reason": (f"+${delta:.2f}" if applied and delta else
                           ("(free)" if applied else ch.get("reason", ""))),
                "appliesTo": int(m.get("quantity", order.quantity) or 1),
            })

    base = float(resolved.get("base_price", mi.get("base_price", 0.0)) or 0.0)
    add = float(resolved.get("modifications_price_change", 0.0) or 0.0)
    return {
        "matched": True,
        "item": order.item,
        "resolvedName": mi.get("name", order.item),
        "itemId": item_id,
        "quantity": order.quantity,
        "truckId": mi.get("truck_id"),
        "truckName": truck.get("name"),
        "basePrice": base,
        "total": round(base * order.quantity + add, 2),
        "mods": mods,
    }


# ---- Concierge: fast grounded RAG (CreateAI + Chroma) ------------------------
# The FEED ME agent (run_feed_me, Ollama) is a faithful tool-loop but takes
# minutes per turn — too slow for chat. The concierge instead uses the Phase-2
# recommend() pipeline: parse intent, retrieve real menu items, and let the
# model write a grounded reply. Fast (~seconds) and still returns a concrete
# truck + dish to render as a card and link to.
@app.post("/chat")
def chat(body: ChatIn) -> dict:
    text = body.message
    try:
        query = parse_chain.invoke({"text": text})
        # filtered retrieval first; if the filter is too strict and returns
        # nothing, fall back to a pure-semantic search so we always ground the
        # reply (and always have a truck to recommend + link to).
        docs = get_menu_retriever(query, k=5).invoke(text)
        if not docs:
            docs = get_menu_retriever(FoodQuery(), k=5).invoke(text)
        context = "\n\n".join(d.page_content for d in docs)
        answer = (RECOMMEND_PROMPT | createai_model).invoke(
            {"context": context, "question": text}
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"concierge failed: {e}") from e

    reco = None
    if docs:
        top = docs[0].metadata
        reco = _reco_pair(top.get("truck_id"), top.get("menu_item_id"))

    trace = [
        {"name": "parse_request", "args": query.model_dump(), "result": query.model_dump()},
        {"name": "search_menu", "args": {"k": len(docs)},
         "result": f"retrieved {len(docs)} menu items"},
    ]
    return {
        "reply": _strip_think(str(answer.content)),
        "trace": trace,
        "recommendation": reco,
    }


# ---- Phase 7: Owner Copilot agent (Ollama qwen3, slow: sales + reviews) ------
@app.post("/copilot")
def copilot(body: AskIn) -> dict:
    question = body.question
    if body.truck:
        question = f"{question} (truck: {body.truck})"
    try:
        messages = run_owner_copilot(question)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"copilot failed: {e}") from e
    answer, trace = _shape_agent(messages)
    return {"answer": answer, "trace": trace}


def _shape_agent(messages) -> tuple[str, list]:
    """Turn a LangGraph message list into (final answer, tool trace)."""
    pending: dict = {}
    trace: list = []
    answer = ""
    for m in messages:
        mtype = getattr(m, "type", "")
        if mtype == "ai":
            content = _strip_think(str(m.content or ""))
            if content:
                answer = content
            for tc in getattr(m, "tool_calls", None) or []:
                pending[tc["id"]] = {"name": tc["name"], "args": tc.get("args", {})}
        elif mtype == "tool":
            info = pending.get(getattr(m, "tool_call_id", None),
                               {"name": getattr(m, "name", "tool"), "args": {}})
            raw = str(m.content)
            try:
                result = json.loads(raw)
            except Exception:  # noqa: BLE001
                result = raw
            trace.append({"name": info["name"], "args": info["args"], "result": result})
    return answer, trace


# ---- Phase 8: review intelligence report (CreateAI batch classify, ~90s) -----
@app.post("/reviews/report")
def reviews_report(body: ReportIn) -> dict:
    reviews = json.loads((DATA / "reviews.json").read_text())
    if body.truck:
        term = body.truck.lower()
        reviews = [
            r for r in reviews
            if r.get("truck_id") == body.truck
            or term in (_trucks.get(r.get("truck_id"), {}).get("name", "").lower())
        ]
    if not reviews:
        raise HTTPException(status_code=404, detail=f"no reviews for '{body.truck}'")
    try:
        report = generate_complaint_report(reviews)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"report failed: {e}") from e

    sent = report.get("sentiment", {})
    return {
        "counts": {
            "positive": sent.get("positive", 0),
            "neutral": sent.get("neutral", 0),
            "negative": sent.get("negative", 0),
        },
        "total": report.get("total_reviews", 0),
        "negative": report.get("negative_reviews", 0),
        "failures": report.get("classify_failures", 0),
        "complaints": [
            {"topic": c["topic"], "count": c["count"], "pct": c["pct_of_negatives"]}
            for c in report.get("complaints", [])
        ],
    }
