from abc import ABC, abstractmethod
from datetime import datetime


class TokenBlacklistService(ABC):

    @abstractmethod
    async def blacklist_token(self, token: str, user_id: str, expires_at: datetime) -> bool:
        raise NotImplementedError

    @abstractmethod
    async def is_token_blacklisted(self, token: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    async def blacklist_user_tokens_before(self, user_id: str, invalid_before: datetime) -> bool:
        """Invalide tous les tokens d’un user émis avant `invalid_before`."""
        raise NotImplementedError

    @abstractmethod
    async def is_token_globally_invalidated(self, *, user_id: str, token_issued_at: datetime) -> bool:
        """True si le token est invalide selon la politique globale de révocation du user."""
        raise NotImplementedError

    @abstractmethod
    async def cleanup_expired_tokens(self) -> int:
        """Remove expired tokens from blacklist (cleanup task)."""
        raise NotImplementedError

    @abstractmethod
    async def get_blacklist_stats(self) -> dict:
        """Get blacklist statistics for monitoring."""
        raise NotImplementedError
