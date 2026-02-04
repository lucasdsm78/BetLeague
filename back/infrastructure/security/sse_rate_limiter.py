from __future__ import annotations

import time
from collections import defaultdict, deque
from dataclasses import dataclass


@dataclass(slots=True)
class RateLimitResult:
    allowed: bool
    retry_after_s: int


class SlidingWindowRateLimiter:

    def __init__(self, *, limit: int, window_s: int):
        self._limit = int(limit)
        self._window_s = int(window_s)
        self._hits = defaultdict(deque)  # key -> timestamps

    def allow(self, key: str) -> RateLimitResult:
        now = time.time()
        q = self._hits[key]

        cutoff = now - self._window_s
        while q and q[0] < cutoff:
            q.popleft()

        if len(q) >= self._limit:
            retry_after = int(max(1, q[0] + self._window_s - now))
            return RateLimitResult(allowed=False, retry_after_s=retry_after)

        q.append(now)
        return RateLimitResult(allowed=True, retry_after_s=0)

