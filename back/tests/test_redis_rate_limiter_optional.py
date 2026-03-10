from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, UTC

import jwt
import pytest
from redis.exceptions import RedisError


@pytest.mark.asyncio
async def test_redis_rate_limiter_allows_and_blocks_if_redis_available():
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        pytest.skip("REDIS_URL non défini")

    from redis.asyncio import Redis
    from infrastructure.security.redis_rate_limiter import RedisSlidingWindowRateLimiter

    r = Redis.from_url(redis_url, decode_responses=False, socket_connect_timeout=1, socket_timeout=1)
    try:
        try:
            await r.ping()
        except RedisError:
            pytest.skip("Redis indisponible dans l'environnement de test")

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


@pytest.mark.asyncio
async def test_redis_global_token_cutoff_is_stored_if_redis_available():
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        pytest.skip("REDIS_URL non défini")

    from redis.asyncio import Redis
    from infrastructure.config import Settings
    from infrastructure.services.authentication.token_blacklist_impl import (
        build_token_blacklist,
        RedisBackedTokenBlacklist,
    )

    r = Redis.from_url(redis_url, decode_responses=False, socket_connect_timeout=1, socket_timeout=1)
    try:
        try:
            await r.ping()
        except RedisError:
            pytest.skip("Redis indisponible dans l'environnement de test")

        bl = build_token_blacklist(settings=Settings(), redis=r)
        assert isinstance(bl, RedisBackedTokenBlacklist)

        user_id = f"999-{uuid.uuid4()}"
        cutoff = datetime.now(UTC)
        ok = await bl.blacklist_user_tokens_before(user_id, cutoff)
        assert ok is True

        assert await bl.is_token_globally_invalidated(
            user_id=user_id,
            token_issued_at=cutoff - timedelta(seconds=5),
        ) is True
        assert await bl.is_token_globally_invalidated(
            user_id=user_id,
            token_issued_at=cutoff + timedelta(seconds=5),
        ) is False
    finally:
        await r.aclose()


@pytest.mark.asyncio
async def test_redis_blacklisted_jti_roundtrip_if_redis_available():
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        pytest.skip("REDIS_URL non défini")

    from redis.asyncio import Redis
    from infrastructure.config import Settings
    from infrastructure.services.authentication.token_blacklist_impl import (
        build_token_blacklist,
        RedisBackedTokenBlacklist,
    )

    r = Redis.from_url(redis_url, decode_responses=False, socket_connect_timeout=1, socket_timeout=1)
    try:
        try:
            await r.ping()
        except RedisError:
            pytest.skip("Redis indisponible dans l'environnement de test")

        bl = build_token_blacklist(settings=Settings(), redis=r)
        assert isinstance(bl, RedisBackedTokenBlacklist)

        token_jti = str(uuid.uuid4())
        token = jwt.encode({"jti": token_jti}, "test-secret", algorithm="HS256")
        expires_at = datetime.now(UTC) + timedelta(seconds=30)

        ok = await bl.blacklist_token(token, user_id="test-user", expires_at=expires_at)
        assert ok is True
        assert await bl.is_token_blacklisted(token) is True
    finally:
        await r.aclose()
