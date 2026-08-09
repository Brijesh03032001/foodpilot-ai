import json
from pathlib import Path

from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_ollama import OllamaEmbeddings

from app.schemas import FoodQuery

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
PERSIST_DIR = Path(__file__).resolve().parent.parent / "chroma_db" / "menu_items"
REVIEWS_PERSIST_DIR = Path(__file__).resolve().parent.parent / "chroma_db" / "reviews"

# FoodQuery.spice_level uses "spicy"; MenuItem.spice_level uses "hot". Same
# meaning, different word — real datasets rarely line up perfectly.
SPICE_LEVEL_QUERY_TO_ITEM = {"mild": "mild", "medium": "medium", "spicy": "hot"}


def _load_trucks_by_id() -> dict:
    trucks = json.loads((DATA_DIR / "trucks.json").read_text())
    return {t["id"]: t for t in trucks}


def _item_to_document(item: dict, truck: dict | None) -> Document:
    truck_name = truck["name"] if truck else "Unknown Truck"
    cuisines = truck.get("cuisines", []) if truck else []
    dietary_tags = item.get("dietary_tags") or []

    # page_content = what gets embedded and semantically searched. This is
    # prose on purpose — it's what the embedding model reads to understand
    # "what this dish is about."
    page_content = (
        f"{item['name']} ({item['category']}) from {truck_name}. "
        f"{item.get('description', '')} "
        f"Cuisine: {', '.join(cuisines) if cuisines else 'unspecified'}. "
        f"Dietary: {', '.join(dietary_tags) if dietary_tags else 'none'}. "
        f"Spice level: {item.get('spice_level', 'none')}."
    ).strip()

    # metadata = exact structured facts Chroma can filter on precisely.
    # Chroma metadata values must be str/int/float/bool — no lists — so
    # dietary_tags gets flattened into individual booleans.
    metadata = {
        "menu_item_id": item["id"],
        "truck_id": item["truck_id"],
        "truck_name": truck_name,
        "category": item["category"],
        "price": float(item["base_price"]),
        "spice_level": item.get("spice_level", "none"),
        "is_vegetarian": ("vegetarian" in dietary_tags) or ("vegan" in dietary_tags),
        "is_vegan": "vegan" in dietary_tags,
        "is_gluten_free": "gluten_free" in dietary_tags,
        "protein_g": float(item.get("protein_g") or 0),
        "prep_time_min": int(item.get("prep_time_min") or 0),
        "is_available": bool(item.get("is_available", False)),
        "cuisines": ",".join(cuisines) if cuisines else "",
    }

    return Document(page_content=page_content, metadata=metadata)


def build_menu_vectorstore(force_rebuild: bool = False) -> Chroma:
    """Load menu_items.json (+ truck cuisines) into a persisted Chroma store.

    Re-embedding 635 items takes a while, so once built it's cached on disk
    at chroma_db/menu_items/ and reused on later runs unless force_rebuild=True.
    """
    embeddings = OllamaEmbeddings(model="bge-m3")

    if PERSIST_DIR.exists() and not force_rebuild:
        return Chroma(
            collection_name="menu_items",
            embedding_function=embeddings,
            persist_directory=str(PERSIST_DIR),
        )

    items = json.loads((DATA_DIR / "menu_items.json").read_text())
    trucks_by_id = _load_trucks_by_id()

    documents = [
        _item_to_document(item, trucks_by_id.get(item["truck_id"]))
        for item in items
    ]
    ids = [item["id"] for item in items]

    PERSIST_DIR.parent.mkdir(parents=True, exist_ok=True)
    return Chroma.from_documents(
        documents=documents,
        embedding=embeddings,
        ids=ids,
        collection_name="menu_items",
        persist_directory=str(PERSIST_DIR),
    )


def build_metadata_filter(query: FoodQuery) -> dict | None:
    """Turn a FoodQuery into a Chroma `where` filter.

    This is the enforcement half of retrieval: semantic search finds dishes
    that FEEL right, this filter throws out ones that structurally don't
    qualify (too expensive, wrong diet, sold out) no matter how well they
    matched semantically.
    """
    conditions: list[dict] = [{"is_available": True}]

    if query.diet == "vegetarian":
        conditions.append({"is_vegetarian": True})
    elif query.diet == "vegan":
        conditions.append({"is_vegan": True})

    if query.spice_level:
        conditions.append(
            {"spice_level": SPICE_LEVEL_QUERY_TO_ITEM[query.spice_level]}
        )

    if query.max_price is not None:
        conditions.append({"price": {"$lte": query.max_price}})

    if query.min_protein_g is not None:
        conditions.append({"protein_g": {"$gte": query.min_protein_g}})

    if len(conditions) == 1:
        return conditions[0]
    return {"$and": conditions}


def get_menu_retriever(query: FoodQuery, k: int = 5):
    vectorstore = build_menu_vectorstore()
    where_filter = build_metadata_filter(query)
    return vectorstore.as_retriever(
        search_kwargs={"k": k, "filter": where_filter}
    )


# --- Phase 7: reviews vector store (semantic search over review TEXT) --------
# Same machinery as the menu store, pointed at reviews. page_content is the
# review text (what gets searched by meaning); metadata carries the exact
# facts (rating, sentiment, truck) for display and optional filtering. `topics`
# is a list, so — like Phase 2's cuisines — it's flattened to a string.
def _review_to_document(review: dict, truck: dict | None) -> Document:
    truck_name = truck["name"] if truck else "Unknown Truck"
    topics = review.get("topics") or []
    metadata = {
        "review_id": review["id"],
        "truck_id": review.get("truck_id") or "",
        "truck_name": truck_name,
        "rating": int(review.get("rating") or 0),
        "sentiment": review.get("sentiment") or "",
        "topics": ",".join(topics),
        "created_at": review.get("created_at") or "",
    }
    return Document(page_content=review.get("text", ""), metadata=metadata)


def build_reviews_vectorstore(force_rebuild: bool = False) -> Chroma:
    """Embed all reviews into a persisted Chroma store at chroma_db/reviews/."""
    embeddings = OllamaEmbeddings(model="bge-m3")

    if REVIEWS_PERSIST_DIR.exists() and not force_rebuild:
        return Chroma(
            collection_name="reviews",
            embedding_function=embeddings,
            persist_directory=str(REVIEWS_PERSIST_DIR),
        )

    reviews = json.loads((DATA_DIR / "reviews.json").read_text())
    trucks_by_id = _load_trucks_by_id()

    documents = [
        _review_to_document(r, trucks_by_id.get(r.get("truck_id")))
        for r in reviews
    ]
    ids = [r["id"] for r in reviews]

    REVIEWS_PERSIST_DIR.parent.mkdir(parents=True, exist_ok=True)
    return Chroma.from_documents(
        documents=documents,
        embedding=embeddings,
        ids=ids,
        collection_name="reviews",
        persist_directory=str(REVIEWS_PERSIST_DIR),
    )


def get_review_retriever(truck_id: str | None = None, k: int = 5):
    vectorstore = build_reviews_vectorstore()
    search_kwargs: dict = {"k": k}
    if truck_id:
        search_kwargs["filter"] = {"truck_id": truck_id}
    return vectorstore.as_retriever(search_kwargs=search_kwargs)
