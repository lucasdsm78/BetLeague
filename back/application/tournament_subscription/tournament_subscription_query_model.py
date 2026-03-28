from typing import Literal

from pydantic import BaseModel


class TournamentSubscriptionPlanReadModel(BaseModel):
    id: Literal["monthly", "yearly"]
    name: str
    price_cents: int
    currency: str
    interval: Literal["month", "year"]
    is_recommended: bool = False


class TournamentSubscriptionPlansResponse(BaseModel):
    plans: list[TournamentSubscriptionPlanReadModel]
    yearly_savings_cents: int

