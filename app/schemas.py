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
