from __future__ import annotations

from datetime import datetime, timedelta, UTC

import pytest

from infrastructure.security.sse_rate_limiter import SlidingWindowRateLimiter
from infrastructure.services.authentication.token_blacklist_impl import InMemoryTokenBlacklistImpl


def test_delete_account_rate_limiter_blocks_after_limit():
    limiter = SlidingWindowRateLimiter(limit=2, window_s=60)
    key = "delete_my_account:ip:1.2.3.4:user:123"

    assert limiter.allow(key).allowed is True
    assert limiter.allow(key).allowed is True

    blocked = limiter.allow(key)
    assert blocked.allowed is False
    assert blocked.retry_after_s >= 1


def test_in_memory_blacklist_can_be_instantiated_outside_running_loop():
    blacklist = InMemoryTokenBlacklistImpl()
    assert blacklist is not None
    assert blacklist._cleanup_task is None


@pytest.mark.asyncio
async def test_global_invalidation_cutoff_invalidates_old_token_iat():
    bl = InMemoryTokenBlacklistImpl()

    user_id = "42"
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
