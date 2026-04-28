import logging

import pytest
from redis.exceptions import NoPermissionError

from infrastructure.redis.password_reset_repository import RedisPasswordResetRepository


class FakeRedis:
    def __init__(self, *, eval_result=1, eval_error: Exception | None = None):
        self.eval_result = eval_result
        self.eval_error = eval_error
        self.set_calls = []
        self.get_calls = []
        self.delete_calls = []
        self.eval_calls = []

    async def set(self, key, value, ex=None):
        self.set_calls.append((key, value, ex))

    async def get(self, key):
        self.get_calls.append(key)
        return None

    async def delete(self, key):
        self.delete_calls.append(key)

    async def eval(self, lua, numkeys, key, *args):
        self.eval_calls.append((lua, numkeys, key, args))
        if self.eval_error is not None:
            raise self.eval_error
        return self.eval_result


@pytest.mark.asyncio
async def test_incr_rate_limit_logs_when_blocked(caplog: pytest.LogCaptureFixture):
    redis = FakeRedis(eval_result=3)
    repo = RedisPasswordResetRepository(redis=redis)

    with caplog.at_level(logging.WARNING, logger="infrastructure.redis.password_reset_repository"):
        allowed = await repo.incr_rate_limit(key="ip:1.2.3.4:test@example.com", window_seconds=60, limit=2)

    assert allowed is False
    blocked_logs = [record for record in caplog.records if record.getMessage() == "redis.password_reset.rate_limit_blocked"]
    assert blocked_logs
    assert blocked_logs[-1].limit == 2
    assert blocked_logs[-1].window_seconds == 60
    assert blocked_logs[-1].count == 3
    assert blocked_logs[-1].key_hash


@pytest.mark.asyncio
async def test_incr_rate_limit_logs_fail_closed_on_no_permission(caplog: pytest.LogCaptureFixture):
    redis = FakeRedis(eval_error=NoPermissionError("NOPERM"))
    repo = RedisPasswordResetRepository(redis=redis)

    with caplog.at_level(logging.WARNING, logger="infrastructure.redis.password_reset_repository"):
        allowed = await repo.incr_rate_limit(key="ip:1.2.3.4:test@example.com", window_seconds=60, limit=2)

    assert allowed is False
    fail_closed_logs = [record for record in caplog.records if record.getMessage() == "redis.password_reset.rate_limit_failed_closed"]
    assert fail_closed_logs
    assert fail_closed_logs[-1].reason == "no_permission"
    assert fail_closed_logs[-1].limit == 2
    assert fail_closed_logs[-1].window_seconds == 60
    assert fail_closed_logs[-1].key_hash

