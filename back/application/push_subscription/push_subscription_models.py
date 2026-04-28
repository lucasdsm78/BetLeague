from __future__ import annotations

import re

from pydantic import BaseModel, Field, field_validator


_BASE64_RE = re.compile(r"^[A-Za-z0-9_\-+/=]+$")


def _to_base64url(s: str) -> str:
    s2 = s.strip()
    s2 = s2.replace("+", "-").replace("/", "_")
    return s2.rstrip("=")


class PushSubscriptionKeys(BaseModel):
    p256dh: str = Field(..., min_length=20, max_length=512)
    auth: str = Field(..., min_length=10, max_length=128)

    @field_validator("p256dh", "auth")
    @classmethod
    def validate_key(cls, v: str) -> str:
        v2 = v.strip()
        if not _BASE64_RE.match(v2):
            raise ValueError("invalid base64 key")
        return _to_base64url(v2)


class PushSubscribeRequest(BaseModel):
    endpoint: str = Field(..., min_length=10, max_length=2048)
    keys: PushSubscriptionKeys

    @field_validator("endpoint")
    @classmethod
    def validate_endpoint(cls, v: str) -> str:
        v2 = v.strip()
        if not (v2.startswith("https://") or v2.startswith("http://localhost")):
            raise ValueError("endpoint must be https")
        return v2


class PushUnsubscribeRequest(BaseModel):
    endpoint: str = Field(..., min_length=10, max_length=2048)

    @field_validator("endpoint")
    @classmethod
    def validate_endpoint(cls, v: str) -> str:
        v2 = v.strip()
        if not (v2.startswith("https://") or v2.startswith("http://localhost")):
            raise ValueError("endpoint must be https")
        return v2


class VapidPublicKeyResponse(BaseModel):
    public_key: str


class PushSubscriptionStatusResponse(BaseModel):
    subscribed: bool
    subscription_count: int
