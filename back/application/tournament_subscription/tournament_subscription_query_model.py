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
    yearly_discount_percent: int


class TournamentCurrentSubscriptionReadModel(BaseModel):
    plan_id: Literal["monthly", "yearly"]
    plan_name: str
    price_cents: int
    currency: str
    interval: Literal["month", "year"]
    status: str
    current_period_start: int | None = None
    current_period_end: int | None = None
    cancel_at_period_end: bool
    cancellation_requested_at: int | None = None
    has_tournament_access: bool

