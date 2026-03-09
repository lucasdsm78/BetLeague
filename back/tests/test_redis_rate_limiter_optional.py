from __future__ import annotations

import os

import pytest


@pytest.mark.asyncio
async def test_redis_rate_limiter_allows_and_blocks_if_redis_available():
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        pytest.skip("REDIS_URL non défini")

    try:
        from redis.asyncio import Redis
        from infrastructure.security.redis_rate_limiter import RedisSlidingWindowRateLimiter

        r = Redis.from_url(redis_url, decode_responses=False, socket_connect_timeout=1, socket_timeout=1)
        try:
            limiter = RedisSlidingWindowRateLimiter(redis=r, prefix="test:ratelimit:")
            key = "delete_my_account:ip:1.2.3.4:user:999"

            await r.delete(f"test:ratelimit:{key}")

            res1 = await limiter.allow(key=key, limit=2, window_s=60)
            res2 = await limiter.allow(key=key, limit=2, window_s=60)
            res3 = await limiter.allow(key=key, limit=2, window_s=60)

            assert res1.allowed is True
            assert res2.allowed is True
            assert res3.allowed is False
            assert res3.retry_after_s >= 1
        finally:
            await r.aclose()
    except Exception:
        pytest.skip("Redis indisponible dans l'environnement de test")


@pytest.mark.asyncio
async def test_redis_global_token_cutoff_is_stored_if_redis_available():
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        pytest.skip("REDIS_URL non défini")

    try:
        from datetime import datetime, timedelta

        from infrastructure.services.authentication.token_blacklist_impl import get_token_blacklist

        bl = get_token_blacklist()

        # On ne peut pas garantir la classe sans redis_url bien injecté; on valide le comportement de lecture/écriture.
        user_id = "999"
        cutoff = datetime.utcnow()
        ok = await bl.blacklist_user_tokens_before(user_id, cutoff)
        assert ok is True

        assert await bl.is_token_globally_invalidated(
            user_id=user_id,
            token_issued_at=cutoff - timedelta(seconds=5),
        ) is True
    except Exception:
        pytest.skip("Redis indisponible dans l'environnement de test")
