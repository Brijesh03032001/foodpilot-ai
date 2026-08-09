from pydantic import BaseModel, Field
from typing import Literal


class FoodQuery(BaseModel):
    """A customer's food request, parsed into structured fields."""

    diet: Literal["vegetarian", "vegan", "none"] = Field(
        default="none",
        description="Dietary restriction the customer mentioned, if any.",
    )
    spice_level: Literal["mild", "medium", "spicy"] | None = Field(
        default=None,
        description="How spicy the customer wants their food, if mentioned.",
    )
    max_price: float | None = Field(
        default=None,
        description="The maximum price in USD the customer is willing to pay, if mentioned.",
    )
    cuisine: str | None = Field(
        default=None,
        description="The type of cuisine the customer wants, e.g. 'mexican', 'asian'.",
    )
    max_wait_min: int | None = Field(
        default=None,
        description="Maximum wait time in minutes the customer will tolerate, if mentioned.",
    )
    min_protein_g: float | None = Field(
        default=None,
        description="Minimum grams of protein the customer wants, if mentioned.",
    )


# --- Phase 6: structured output under pressure ------------------------------
# A customer's order is no longer flat. "3 spicy paneer tacos, remove onion
# from 2, add avocado to 1 only if avocado <= $2" is one ITEM with several
# MODIFICATIONS, each applying to a subset. So the schema nests: an
# OrderDraftItem CONTAINS a list of Modification. This is the whole Phase 6
# shape lesson — a field that is itself a list of another model.


class Modification(BaseModel):
    """One modification instruction, applied to `quantity` units of the item."""

    quantity: int = Field(
        default=1,
        description="How many units of the item this modification applies to. "
        "For 'remove onion from 2', quantity is 2.",
    )
    add: list[str] = Field(
        default_factory=list,
        description="Ingredients or toppings to ADD, e.g. ['avocado', 'cheese']. "
        "Empty if nothing is added.",
    )
    remove: list[str] = Field(
        default_factory=list,
        description="Ingredients to REMOVE, e.g. ['onion']. Empty if nothing "
        "is removed.",
    )
    condition: str | None = Field(
        default=None,
        description="An optional condition the customer attached, copied as "
        "plain text, e.g. 'price <= 2' for 'only if avocado is under $2'. Do "
        "NOT try to decide whether it is true — just record the condition. A "
        "tool checks it later against real prices.",
    )


class OrderDraftItem(BaseModel):
    """One line of an order: a menu item, a quantity, and its modifications."""

    item: str = Field(
        description="The menu item the customer wants, as they named it, e.g. "
        "'Spicy Paneer Taco'.",
    )
    quantity: int = Field(
        default=1,
        description="Total number of this item the customer wants.",
    )
    modifications: list[Modification] = Field(
        default_factory=list,
        description="The list of per-subset modifications. Empty if the "
        "customer wants the item exactly as-is.",
    )


# --- Phase 8: review intelligence -------------------------------------------
# The classifier's job: read ONE review's text and label it. Using a Literal
# for topics is how we keep labels CONSISTENT across thousands of calls — the
# allowed set is spelled out in the prompt (via format_instructions), so the
# model can't invent "slow-ish service" one time and "sluggishness" the next.
# 'other' is the escape hatch so an odd review doesn't get force-fit.
ReviewTopic = Literal[
    "taste", "portion", "value", "service", "parking", "pricing",
    "wait_time", "other",
]


class ReviewClassification(BaseModel):
    """A single review, classified for reporting."""

    sentiment: Literal["positive", "neutral", "negative"] = Field(
        description="Overall sentiment of the review.",
    )
    topics: list[ReviewTopic] = Field(
        default_factory=list,
        description="Which topic categories the review mentions. Use ONLY the "
        "allowed labels; pick 'other' if nothing fits. Can be several.",
    )
