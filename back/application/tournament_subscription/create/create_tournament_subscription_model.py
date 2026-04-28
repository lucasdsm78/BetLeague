from application.tournament_subscription.tournament_subscription_command_model import SubscriptionPlanId
from pydantic import BaseModel


class CreateSubscriptionRequest(BaseModel):
    subscription_plan: SubscriptionPlanId
