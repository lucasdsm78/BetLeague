from typing import Literal

from pydantic import BaseModel

class CreateSubscriptionRequest(BaseModel):
    user_id: str
    subscription_plan: Literal["monthly", "yearly"]
    success_url: str
    cancel_url: str
