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
    async def cleanup_expired_tokens(self) -> int:
        """
        Remove expired tokens from blacklist (cleanup task)

        Returns:
            int: Number of expired tokens removed
        """
        raise NotImplementedError

    @abstractmethod
    async def get_blacklist_stats(self) -> dict:
        """
        Get blacklist statistics for monitoring

        Returns:
            dict: Statistics about blacklisted tokens
        """
        raise NotImplementedError
