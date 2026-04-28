from __future__ import annotations

from abc import ABC, abstractmethod


class PasswordResetRepository(ABC):

    @abstractmethod
    async def create_challenge(
        self,
        *,
        challenge_id: str,
        email: str,
        code_hash: str,
        expires_in_seconds: int,
    ) -> None:
        raise NotImplementedError

    @abstractmethod
    async def get_challenge(self, *, challenge_id: str) -> dict | None:

        raise NotImplementedError

    @abstractmethod
    async def delete_challenge(self, *, challenge_id: str) -> None:
        raise NotImplementedError

    @abstractmethod
    async def mark_challenge_verified(
        self,
        *,
        challenge_id: str,
        reset_token_hash: str,
        reset_expires_in_seconds: int,
    ) -> None:
        raise NotImplementedError

    @abstractmethod
    async def consume_reset_token(
        self,
        *,
        challenge_id: str,
        reset_token_hash: str,
    ) -> dict | None:

        raise NotImplementedError

    @abstractmethod
    async def incr_rate_limit(self, *, key: str, window_seconds: int, limit: int) -> bool:
        raise NotImplementedError

