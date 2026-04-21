from __future__ import annotations

import json
import logging

from redis.asyncio import Redis
from redis.exceptions import NoPermissionError

from application.logging_utils import hash_identifier
from domain.user.repository.password_reset_repository import PasswordResetRepository


logger = logging.getLogger(__name__)


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
        logger.info(
            "redis.password_reset.challenge_created",
            extra={
                "challenge_id_hash": hash_identifier(challenge_id),
                "email_hash": hash_identifier(email),
                "expires_in_seconds": int(expires_in_seconds),
            },
        )

    async def get_challenge(self, *, challenge_id: str) -> dict | None:
        k = self._challenge_key(challenge_id)
        raw = await self._redis.get(k)
        if not raw:
            logger.debug(
                "redis.password_reset.challenge_missing",
                extra={"challenge_id_hash": hash_identifier(challenge_id)},
            )
            return None
        data = json.loads(raw)
        logger.debug(
            "redis.password_reset.challenge_loaded",
            extra={
                "challenge_id_hash": hash_identifier(challenge_id),
                "verified": bool(data.get("verified")),
            },
        )
        return data

    async def delete_challenge(self, *, challenge_id: str) -> None:
        await self._redis.delete(self._challenge_key(challenge_id))
        logger.info(
            "redis.password_reset.challenge_deleted",
            extra={"challenge_id_hash": hash_identifier(challenge_id)},
        )

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
            logger.warning(
                "redis.password_reset.challenge_verify_skipped",
                extra={"challenge_id_hash": hash_identifier(challenge_id), "reason": "missing"},
            )
            return
        data = json.loads(raw)
        data["verified"] = True
        data["reset_token_hash"] = reset_token_hash
        await self._redis.set(k, json.dumps(data).encode(), ex=reset_expires_in_seconds)
        logger.info(
            "redis.password_reset.challenge_verified",
            extra={
                "challenge_id_hash": hash_identifier(challenge_id),
                "reset_expires_in_seconds": int(reset_expires_in_seconds),
            },
        )

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
            logger.warning(
                "redis.password_reset.reset_token_consume_rejected",
                extra={"challenge_id_hash": hash_identifier(challenge_id), "reason": "missing_or_invalid"},
            )
            return None
        data = json.loads(res)
        logger.info(
            "redis.password_reset.reset_token_consumed",
            extra={
                "challenge_id_hash": hash_identifier(challenge_id),
                "email_hash": hash_identifier(data.get("email")),
            },
        )
        return data

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
            logger.warning(
                "redis.password_reset.rate_limit_failed_closed",
                extra={
                    "key_hash": hash_identifier(key),
                    "window_seconds": int(window_seconds),
                    "limit": int(limit),
                    "reason": "no_permission",
                },
            )
            return False
        allowed = int(count) <= int(limit)
        if not allowed:
            logger.warning(
                "redis.password_reset.rate_limit_blocked",
                extra={
                    "key_hash": hash_identifier(key),
                    "window_seconds": int(window_seconds),
                    "limit": int(limit),
                    "count": int(count),
                },
            )
        return allowed
