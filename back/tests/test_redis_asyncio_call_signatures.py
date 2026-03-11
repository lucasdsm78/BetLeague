from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace

import pytest

from infrastructure.security.redis_rate_limiter import RedisSlidingWindowRateLimiter
from infrastructure.services.authentication.token_blacklist_impl import (
    InMemoryTokenBlacklistImpl,
    RedisBackedTokenBlacklist,
)


class FakeRedisForRateLimiter:
    def __init__(self):
        self.script_load_calls: list[str] = []
        self.evalsha_calls: list[tuple] = []

    async def script_load(self, script: str) -> str:
        self.script_load_calls.append(script)
        return "fake-sha"

    async def evalsha(self, sha: str, numkeys: int, *keys_and_args: str):
        self.evalsha_calls.append((sha, numkeys, keys_and_args))
        return [1, 0]


class FakeRedisForTokenBlacklist:
    def __init__(self):
        self.eval_calls: list[tuple] = []

    async def eval(self, script: str, numkeys: int, *keys_and_args: str):
        self.eval_calls.append((script, numkeys, keys_and_args))
        return 1


@pytest.mark.asyncio
async def test_redis_rate_limiter_uses_positional_evalsha_args():
    redis = FakeRedisForRateLimiter()
    limiter = RedisSlidingWindowRateLimiter(redis=redis, prefix="ratelimit:")

    result = await limiter.allow(key="delete_my_account:ip:1.2.3.4:user:42", limit=3, window_s=60)

    assert result.allowed is True
    assert result.retry_after_s == 0
    assert len(redis.evalsha_calls) == 1
    sha, numkeys, keys_and_args = redis.evalsha_calls[0]
    assert sha == "fake-sha"
    assert numkeys == 1
    assert keys_and_args[0] == "ratelimit:delete_my_account:ip:1.2.3.4:user:42"
    assert keys_and_args[1:] == (keys_and_args[1], keys_and_args[2], "3", "60")


@pytest.mark.asyncio
async def test_token_blacklist_uses_positional_eval_args_for_invalid_before():
    redis = FakeRedisForTokenBlacklist()
    local = InMemoryTokenBlacklistImpl()
    settings = SimpleNamespace(
        auth_redis_fail_closed=False,
        auth_tokens_invalid_before_ttl_s=3600,
        auth_blacklisted_jti_ttl_grace_s=60,
    )
    blacklist = RedisBackedTokenBlacklist(redis=redis, local=local, settings=settings)

    cutoff = datetime.now(UTC)
    ok = await blacklist.blacklist_user_tokens_before("42", cutoff)

    assert ok is True
    assert len(redis.eval_calls) == 1
    _script, numkeys, keys_and_args = redis.eval_calls[0]
    assert numkeys == 1
    assert keys_and_args == (
        "betleague:auth:tokens_invalid_before:42",
        str(int(cutoff.timestamp())),
        "3600",
    )

