from __future__ import annotations

from abc import ABC, abstractmethod


class PasswordResetNotifier(ABC):
    @abstractmethod
    async def send_reset_code(self, *, email: str, code: str) -> None:
        raise NotImplementedError

