import asyncio
import logging
from datetime import datetime, timedelta
from typing import Set, Dict, Optional
import jwt
from collections import defaultdict

from domain.services.authentication.token_blacklist import TokenBlacklistService


class InMemoryTokenBlacklistImpl(TokenBlacklistService):

    def __init__(self):
        self._blacklisted_tokens: Set[str] = set()
        self._token_expiry: Dict[str, datetime] = {}
        self._user_tokens: Dict[str, Set[str]] = defaultdict(set)
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
                    'timestamp': datetime.utcnow().isoformat()
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
                now = datetime.utcnow()
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


_blacklist_instance: Optional[InMemoryTokenBlacklistImpl] = None


def get_token_blacklist() -> InMemoryTokenBlacklistImpl:
    global _blacklist_instance
    if _blacklist_instance is None:
        _blacklist_instance = InMemoryTokenBlacklistImpl()
    return _blacklist_instance


async def shutdown_token_blacklist():
    global _blacklist_instance
    if _blacklist_instance:
        await _blacklist_instance.shutdown()
        _blacklist_instance = None
