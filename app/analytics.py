"""Phase 8 — review intelligence: RAG as a REPORTING engine.

Not Q&A. The pattern is map-reduce over documents:
  MAP    — classify each review into sentiment + topics (classify_review_chain),
           run in parallel with LCEL's .batch()
  REDUCE — aggregate the per-review labels into a ranked complaint table.

That turns a pile of unstructured reviews into a quantified breakdown an owner
would actually act on.
"""
import json
from collections import Counter
from pathlib import Path

from app.chains import classify_review_chain
from app.schemas import ReviewClassification

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def classify_reviews(
    reviews: list[dict], max_concurrency: int = 8
) -> tuple[list[ReviewClassification], list[str]]:
    """MAP step. Classify each review's text, in parallel, via .batch().

    We dedupe identical texts first so we don't pay for the same LLM call
    twice, then map the results back onto every review. Returns
    (classifications aligned to `reviews`, list of texts that failed to parse).
    """
    unique_texts = list({r["text"] for r in reviews})

    # .batch runs the chain concurrently (a thread pool over invoke), capped at
    # max_concurrency — far faster than a Python for-loop of .invoke() calls.
    # return_exceptions=True so one bad output doesn't sink the whole run.
    results = classify_review_chain.batch(
        [{"text": t} for t in unique_texts],
        config={"max_concurrency": max_concurrency},
        return_exceptions=True,
    )

    by_text: dict[str, ReviewClassification] = {}
    failures: list[str] = []
    for text, res in zip(unique_texts, results):
        if isinstance(res, Exception):
            failures.append(text)
        else:
            by_text[text] = res

    classifications = [by_text[r["text"]] for r in reviews if r["text"] in by_text]
    return classifications, failures


def aggregate_complaints(classifications: list[ReviewClassification]) -> dict:
    """REDUCE step. Per-review labels -> a ranked complaint breakdown.

    Complaints = the topics on NEGATIVE reviews. Percentages are of negative
    reviews; a review can raise several topics, so they can sum past 100%.
    """
    negatives = [c for c in classifications if c.sentiment == "negative"]
    total_neg = len(negatives)
    counts = Counter(t for c in negatives for t in c.topics)

    table = [
        {
            "topic": topic,
            "count": n,
            "pct_of_negatives": round(100 * n / total_neg, 1) if total_neg else 0.0,
        }
        for topic, n in counts.most_common()
    ]

    return {
        "total_reviews": len(classifications),
        "sentiment": dict(Counter(c.sentiment for c in classifications)),
        "negative_reviews": total_neg,
        "complaints": table,
    }


def generate_complaint_report(
    reviews: list[dict] | None = None, max_concurrency: int = 8
) -> dict:
    """Full Phase 8 pipeline: reviews -> classify (batch) -> aggregate."""
    if reviews is None:
        reviews = json.loads((DATA_DIR / "reviews.json").read_text())
    classifications, failures = classify_reviews(reviews, max_concurrency)
    report = aggregate_complaints(classifications)
    report["classify_failures"] = len(failures)
    return report
