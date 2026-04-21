from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from threading import Lock


logger = logging.getLogger(__name__)


@dataclass
class RateLimitResult:
    allowed: bool
    retry_after_seconds: int


class SlidingWindowRateLimiter:
    def __init__(self):
        self._lock = Lock()
        # key -> list[timestamps]
        self._events: dict[str, list[float]] = {}

    def check(self, key: str, limit: int, window_seconds: int) -> RateLimitResult:
        now = time.time()
        start = now - window_seconds

        with self._lock:
            timestamps = self._events.get(key, [])
            timestamps = [ts for ts in timestamps if ts >= start]

            if len(timestamps) >= limit:
                oldest = min(timestamps) if timestamps else now
                retry_after = int(max(1.0, (oldest + window_seconds) - now))
                self._events[key] = timestamps
                logger.warning(
                    "ratelimiter.check_blocked",
                    extra={"key": key, "limit": limit, "window_seconds": window_seconds, "retry_after_seconds": retry_after},
                )
                return RateLimitResult(allowed=False, retry_after_seconds=retry_after)

            timestamps.append(now)
            self._events[key] = timestamps
            return RateLimitResult(allowed=True, retry_after_seconds=0)


rate_limiter = SlidingWindowRateLimiter()
