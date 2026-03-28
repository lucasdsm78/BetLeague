from typing import Literal, Optional, Any, Dict

from pydantic import BaseModel

SubscriptionPlanId = Literal["monthly", "yearly"]

class CreateSubscriptionRequest(BaseModel):
    subscription_plan: SubscriptionPlanId

class SubscriptionResponse(BaseModel):
    subscription_id: str
    user_id: str
    subscription_plan: str
    price_amount: str
    status: str
    current_period_start: int
    current_period_end: int
    is_active: bool
    has_tournament_access: bool
    stripe_customer_id: Optional[str]
    stripe_subscription_id: Optional[str]

class CheckoutSessionResponse(BaseModel):
    checkout_url: str

class StripeWebhookRequest(BaseModel):
    type: str
    data: Dict[str, Any]
