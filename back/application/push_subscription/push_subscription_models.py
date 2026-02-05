from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class PushSubscriptionKeys(BaseModel):
    p256dh: str = Field(..., min_length=1)
    auth: str = Field(..., min_length=1)


class PushSubscribeRequest(BaseModel):
    endpoint: str = Field(..., min_length=1)
    keys: PushSubscriptionKeys


class PushUnsubscribeRequest(BaseModel):
    endpoint: str = Field(..., min_length=1)


class VapidPublicKeyResponse(BaseModel):
    public_key: str


class PushSubscriptionStatusResponse(BaseModel):
    subscribed: bool
    subscription_count: int
