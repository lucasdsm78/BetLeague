import asyncio
import logging
from datetime import datetime, timedelta, UTC
from typing import Set, Dict, Optional
import time

import jwt
from collections import defaultdict

from redis.asyncio import Redis

from domain.services.authentication.token_blacklist import TokenBlacklistService
from infrastructure.config import Settings


class InMemoryTokenBlacklistImpl(TokenBlacklistService):

    def __init__(self):
        self._blacklisted_tokens: Set[str] = set()
        self._token_expiry: Dict[str, datetime] = {}
        self._user_tokens: Dict[str, Set[str]] = defaultdict(set)
        self._user_invalid_before: Dict[str, datetime] = {}  # user_id -> cutoff
        self._blacklist_events: list = []
        self._lock = asyncio.Lock()
        self._stats = {
            'total_blacklisted': 0,
            'cleanup_runs': 0,
            'last_cleanup': None,
            'active_tokens': 0
        }

        self._cleanup_task = None
        self._start_cleanup_task()

    def _start_cleanup_task(self):
        if self._cleanup_task is None or self._cleanup_task.done():
            self._cleanup_task = asyncio.create_task(self._background_cleanup())

    async def _background_cleanup(self):
        while True:
            try:
                await asyncio.sleep(1800)  # 30 minutes
                await self.cleanup_expired_tokens()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logging.error(f"🚨 Token cleanup error: {e}")

    async def _extract_token_info(self, token: str) -> Optional[dict]:
        try:
            decoded = jwt.decode(token, options={"verify_signature": False})
            return decoded
        except Exception as e:
            logging.warning(f"Failed to extract token info: {e}")
            return None

    async def blacklist_token(self, token: str, user_id: str, expires_at: datetime) -> bool:
        async with self._lock:
            try:
                token_info = await self._extract_token_info(token)
                token_id = token_info.get('jti', token[:32]) if token_info else token[:32]

                self._blacklisted_tokens.add(token_id)
                self._token_expiry[token_id] = expires_at
                self._user_tokens[user_id].add(token_id)

                self._blacklist_events.append({
                    'action': 'blacklist_token',
                    'user_id': user_id,
                    'token_id': token_id,
                    'expires_at': expires_at.isoformat(),
                    'timestamp': datetime.now(UTC).isoformat()
                })

                self._stats['total_blacklisted'] += 1
                self._stats['active_tokens'] = len(self._blacklisted_tokens)

                logging.info(f"🔒 Token blacklisted for user {user_id}: {token_id}")
                return True

            except Exception as e:
                logging.error(f"🚨 Failed to blacklist token: {e}")
                return False

    async def is_token_blacklisted(self, token: str) -> bool:
        try:
            token_info = await self._extract_token_info(token)
            token_id = token_info.get('jti', token[:32]) if token_info else token[:32]

            async with self._lock:
                is_blacklisted = token_id in self._blacklisted_tokens

            if is_blacklisted:
                logging.warning(f"🚫 Blacklisted token access attempt: {token_id}")

            return is_blacklisted

        except Exception as e:
            logging.error(f"🚨 Error checking token blacklist: {e}")
            return True

    async def cleanup_expired_tokens(self) -> int:
        async with self._lock:
            try:
                now = datetime.now(UTC)
                expired_tokens = []

                for token_id, expires_at in self._token_expiry.items():
                    if expires_at <= now:
                        expired_tokens.append(token_id)

                for token_id in expired_tokens:
                    self._blacklisted_tokens.discard(token_id)
                    del self._token_expiry[token_id]

                    for user_id, user_tokens in self._user_tokens.items():
                        user_tokens.discard(token_id)

                self._stats['cleanup_runs'] += 1
                self._stats['last_cleanup'] = now.isoformat()
                self._stats['active_tokens'] = len(self._blacklisted_tokens)

                if expired_tokens:
                    logging.info(f"🧹 Cleaned up {len(expired_tokens)} expired tokens")

                return len(expired_tokens)

            except Exception as e:
                logging.error(f"🚨 Failed to cleanup expired tokens: {e}")
                return 0

    async def get_blacklist_stats(self) -> dict:
        async with self._lock:
            stats = self._stats.copy()
            stats.update({
                'active_tokens': len(self._blacklisted_tokens),
                'tracked_users': len(self._user_tokens),
                'recent_events': len(self._blacklist_events),
                'memory_usage_estimate': (
                    len(self._blacklisted_tokens) * 50 +  # Rough estimate
                    len(self._token_expiry) * 100 +
                    len(self._blacklist_events) * 200
                )
            })

        return stats

    async def get_security_events(self, limit: int = 100) -> list:
        async with self._lock:
            return self._blacklist_events[-limit:] if self._blacklist_events else []

    async def shutdown(self):
        if self._cleanup_task and not self._cleanup_task.done():
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass

        logging.info("🔒 Token blacklist service shutdown complete")

    def __del__(self):
        """Cleanup on destruction"""
        if hasattr(self, '_cleanup_task') and self._cleanup_task and not self._cleanup_task.done():
            self._cleanup_task.cancel()

    async def blacklist_user_tokens_before(self, user_id: str, invalid_before: datetime) -> bool:
        async with self._lock:
            try:
                current = self._user_invalid_before.get(user_id)
                if current is None or invalid_before > current:
                    self._user_invalid_before[user_id] = invalid_before

                self._blacklist_events.append({
                    'action': 'blacklist_user_tokens_before',
                    'user_id': user_id,
                    'invalid_before': invalid_before.isoformat(),
                    'timestamp': datetime.now(UTC).isoformat(),
                })
                return True
            except Exception as e:
                logging.error(f"🚨 Failed to set user invalid_before: {e}")
                return False

    async def is_token_globally_invalidated(self, *, user_id: str, token_issued_at: datetime) -> bool:
        try:
            async with self._lock:
                cutoff = self._user_invalid_before.get(user_id)
            if cutoff is None:
                return False
            return token_issued_at < cutoff
        except Exception as e:
            logging.error(f"🚨 Error checking global invalidation: {e}")
            return True


class RedisBackedTokenBlacklist(TokenBlacklistService):
    """Blacklist hybride.

    - blacklist jti: Redis (distribué)
    - cutoff invalid_before global par user: Redis (distribué)

    Fallback local: best-effort uniquement.
    Mode panne Redis configurable: fail-open (par défaut) ou fail-closed.
    """

    def __init__(
        self,
        *,
        redis: Redis,
        local: InMemoryTokenBlacklistImpl,
        settings: Settings,
        prefix_invalid_before: str = "betleague:auth:tokens_invalid_before:",
        prefix_blacklisted_jti: str = "betleague:auth:blacklisted_jti:",
    ):
        self._redis = redis
        self._local = local
        self._settings = settings
        self._prefix_invalid_before = prefix_invalid_before
        self._prefix_blacklisted_jti = prefix_blacklisted_jti

    def _key_invalid_before(self, user_id: str) -> str:
        return f"{self._prefix_invalid_before}{user_id}"

    def _key_blacklisted_jti(self, jti: str) -> str:
        return f"{self._prefix_blacklisted_jti}{jti}"

    def _redis_error_result(self) -> bool:
        # True => token considéré invalide
        return bool(getattr(self._settings, "auth_redis_fail_closed", False))

    async def blacklist_token(self, token: str, user_id: str, expires_at: datetime) -> bool:
        # extraire jti
        token_info = await self._local._extract_token_info(token)
        token_id = token_info.get('jti', token[:32]) if token_info else token[:32]

        # Stocker en Redis avec TTL jusqu'à exp (+ marge)
        now_s = int(time.time())
        ttl = max(
            1,
            int(expires_at.timestamp()) - now_s + int(getattr(self._settings, "auth_blacklisted_jti_ttl_grace_s", 60)),
        )

        try:
            await self._redis.setex(self._key_blacklisted_jti(token_id), ttl, b"1")
        except Exception as e:
            logging.error(f"🚨 Redis error blacklisting jti: {e}")
            # fallback local quand même
            await self._local.blacklist_token(token, user_id, expires_at)
            return False

        # Best-effort local (utile en dev)
        await self._local.blacklist_token(token, user_id, expires_at)
        return True

    async def is_token_blacklisted(self, token: str) -> bool:
        token_info = await self._local._extract_token_info(token)
        token_id = token_info.get('jti', token[:32]) if token_info else token[:32]

        try:
            raw = await self._redis.get(self._key_blacklisted_jti(token_id))
            if raw is None:
                return False
            return True
        except Exception as e:
            logging.error(f"🚨 Redis error checking blacklisted jti: {e}")
            # fallback local si possible
            try:
                return await self._local.is_token_blacklisted(token)
            except Exception:
                return self._redis_error_result()

    async def blacklist_user_tokens_before(self, user_id: str, invalid_before: datetime) -> bool:
        ts = int(invalid_before.timestamp())
        key = self._key_invalid_before(user_id)

        try:
            lua = r"""
local key = KEYS[1]
local new_ts = tonumber(ARGV[1])
local ttl_s = tonumber(ARGV[2])
local cur = redis.call('GET', key)
if (not cur) or (tonumber(cur) < new_ts) then
  redis.call('SET', key, tostring(new_ts))
end
if ttl_s and ttl_s > 0 then
  redis.call('EXPIRE', key, ttl_s)
end
return 1
"""
            await self._redis.eval(
                lua,
                numkeys=1,
                keys=[key],
                args=[ts, int(getattr(self._settings, "auth_tokens_invalid_before_ttl_s", 60 * 60 * 24 * 90))],
            )
        except Exception as e:
            logging.error(f"🚨 Redis error setting invalid_before: {e}")
            # fallback local
            return await self._local.blacklist_user_tokens_before(user_id, invalid_before)

        await self._local.blacklist_user_tokens_before(user_id, invalid_before)
        return True

    async def is_token_globally_invalidated(self, *, user_id: str, token_issued_at: datetime) -> bool:
        try:
            raw = await self._redis.get(self._key_invalid_before(user_id))
            if raw is None:
                return False
            cutoff_ts = int(raw)
            return int(token_issued_at.timestamp()) < cutoff_ts
        except Exception as e:
            logging.error(f"🚨 Redis error reading invalid_before: {e}")
            # fallback local si possible
            try:
                return await self._local.is_token_globally_invalidated(user_id=user_id, token_issued_at=token_issued_at)
            except Exception:
                return self._redis_error_result()

    async def cleanup_expired_tokens(self) -> int:
        return await self._local.cleanup_expired_tokens()

    async def get_blacklist_stats(self) -> dict:
        stats = await self._local.get_blacklist_stats()
        stats["global_invalidation_store"] = "redis"
        stats["jti_blacklist_store"] = "redis"
        return stats


# (Suppression du singleton interne: la construction se fait via DI)
# _blacklist_instance / reset_token_blacklist_singleton_for_tests / _build_redis_client_from_settings sont supprimés.

