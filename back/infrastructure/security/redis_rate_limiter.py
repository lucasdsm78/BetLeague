from __future__ import annotations

import time
from dataclasses import dataclass

from redis.asyncio import Redis


@dataclass(frozen=True, slots=True)
class RateLimitResult:
    allowed: bool
    retry_after_s: int


# Sliding window via ZSET.
# Returns: [allowed(0/1), retry_after_seconds]
_LUA_SLIDING_WINDOW = r"""
local key = KEYS[1]
local now_ms = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local ttl_s = tonumber(ARGV[4])

local cutoff = now_ms - window_ms
redis.call('ZREMRANGEBYSCORE', key, 0, cutoff)

local member = tostring(now_ms) .. '-' .. tostring(math.random())
redis.call('ZADD', key, now_ms, member)

local count = redis.call('ZCARD', key)
redis.call('EXPIRE', key, ttl_s)

if count <= limit then
  return {1, 0}
end

local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
if oldest[2] == nil then
  return {0, math.floor(window_ms / 1000)}
end

local oldest_ms = tonumber(oldest[2])
local retry_ms = (oldest_ms + window_ms) - now_ms
if retry_ms < 1000 then retry_ms = 1000 end
return {0, math.floor(retry_ms / 1000)}
"""


class RedisSlidingWindowRateLimiter:
    def __init__(self, *, redis: Redis, prefix: str = "ratelimit:"):
        self._redis = redis
        self._prefix = prefix
        self._script_sha: str | None = None

    async def _ensure_script_loaded(self) -> str:
        if self._script_sha is None:
            self._script_sha = await self._redis.script_load(_LUA_SLIDING_WINDOW)
        return self._script_sha

    async def allow(self, *, key: str, limit: int, window_s: int) -> RateLimitResult:
        now_ms = int(time.time() * 1000)
        window_ms = int(window_s) * 1000
        ttl_s = max(int(window_s), 1)

        redis_key = f"{self._prefix}{key}"

        try:
            sha = await self._ensure_script_loaded()
            try:
                res = await self._redis.evalsha(
                    sha,
                    numkeys=1,
                    keys=[redis_key],
                    args=[now_ms, window_ms, int(limit), ttl_s],
                )
            except Exception as e:
                if "NOSCRIPT" in str(e):
                    self._script_sha = None
                    sha = await self._ensure_script_loaded()
                    res = await self._redis.evalsha(
                        sha,
                        numkeys=1,
                        keys=[redis_key],
                        args=[now_ms, window_ms, int(limit), ttl_s],
                    )
                else:
                    raise

            allowed = bool(int(res[0]))
            retry_after = int(res[1])
            return RateLimitResult(allowed=allowed, retry_after_s=retry_after)
        except Exception:
            # fail-closed: si Redis est down, on bloque
            return RateLimitResult(allowed=False, retry_after_s=max(int(window_s), 1))

