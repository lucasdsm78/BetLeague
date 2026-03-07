from __future__ import annotations

from abc import ABC, abstractmethod


class PasswordResetRepository(ABC):
    """Stockage éphémère des challenges de reset de mot de passe.

    Implémentation attendue: Redis (TTL natif) pour performance et simplicité.
    Les données stockées doivent être hashées (jamais de code/token en clair).
    """

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
        """Retourne un dict contenant au minimum: email, code_hash."""
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
        """Associe un reset_token_hash au challenge et démarre le TTL de reset token."""
        raise NotImplementedError

    @abstractmethod
    async def consume_reset_token(
        self,
        *,
        challenge_id: str,
        reset_token_hash: str,
    ) -> dict | None:
        """Valide et consomme le reset token.

        Doit supprimer le challenge (anti-rejeu). Retourne les données du challenge si OK.
        """
        raise NotImplementedError

    @abstractmethod
    async def incr_rate_limit(self, *, key: str, window_seconds: int, limit: int) -> bool:
        """Incrémente un compteur et retourne True si autorisé, False si limit dépassée."""
        raise NotImplementedError

