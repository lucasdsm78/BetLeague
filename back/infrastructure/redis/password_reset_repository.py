from __future__ import annotations

import json

from redis.asyncio import Redis
from redis.exceptions import NoPermissionError

from domain.user.repository.password_reset_repository import PasswordResetRepository


class RedisPasswordResetRepository(PasswordResetRepository):
    def __init__(self, *, redis: Redis, key_prefix: str = "betleague:pwdreset:"):
        self._redis = redis
        self._prefix = key_prefix

    def _challenge_key(self, challenge_id: str) -> str:
        return f"{self._prefix}challenge:{challenge_id}"

    def _rate_key(self, key: str) -> str:
        return f"{self._prefix}rl:{key}"

    async def create_challenge(self, *, challenge_id: str, email: str, code_hash: str, expires_in_seconds: int) -> None:
        payload = {
            "email": email,
            "code_hash": code_hash,
            "verified": False,
        }
        k = self._challenge_key(challenge_id)
        await self._redis.set(k, json.dumps(payload).encode(), ex=expires_in_seconds)

    async def get_challenge(self, *, challenge_id: str) -> dict | None:
        k = self._challenge_key(challenge_id)
        raw = await self._redis.get(k)
        if not raw:
            return None
        return json.loads(raw)

    async def delete_challenge(self, *, challenge_id: str) -> None:
        await self._redis.delete(self._challenge_key(challenge_id))

    async def mark_challenge_verified(
        self,
        *,
        challenge_id: str,
        reset_token_hash: str,
        reset_expires_in_seconds: int,
    ) -> None:
        k = self._challenge_key(challenge_id)
        raw = await self._redis.get(k)
        if not raw:
            return
        data = json.loads(raw)
        data["verified"] = True
        data["reset_token_hash"] = reset_token_hash
        await self._redis.set(k, json.dumps(data).encode(), ex=reset_expires_in_seconds)

    async def consume_reset_token(self, *, challenge_id: str, reset_token_hash: str) -> dict | None:
        k = self._challenge_key(challenge_id)

        lua = """
        local val = redis.call('GET', KEYS[1])
        if not val then return nil end
        local obj = cjson.decode(val)
        if not obj['verified'] then return nil end
        if not obj['reset_token_hash'] then return nil end
        if obj['reset_token_hash'] ~= ARGV[1] then return nil end
        redis.call('DEL', KEYS[1])
        return val
        """
        res = await self._redis.eval(lua, 1, k, reset_token_hash)
        if not res:
            return None
        return json.loads(res)

    async def incr_rate_limit(self, *, key: str, window_seconds: int, limit: int) -> bool:
        k = self._rate_key(key)
        lua = """
        local current = redis.call('INCRBY', KEYS[1], 1)
        if current == 1 then
            redis.call('EXPIRE', KEYS[1], ARGV[1])
        end
        return current
        """
        try:
            count = await self._redis.eval(lua, 1, k, int(window_seconds))
        except NoPermissionError:
            return False
        return int(count) <= int(limit)
