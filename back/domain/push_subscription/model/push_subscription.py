from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True, slots=True)
class PushSubscription:
    id: Optional[int]
    user_id: int
    endpoint: str
    p256dh_key: str
    auth_key: str
    user_agent: Optional[str]
    created_at: int
    last_used_at: Optional[int]

    def subscription_info(self) -> dict:
        return {
            "endpoint": self.endpoint,
            "keys": {
                "p256dh": self.p256dh_key,
                "auth": self.auth_key,
            },
        }
