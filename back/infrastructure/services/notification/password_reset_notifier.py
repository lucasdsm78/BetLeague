from __future__ import annotations

import logging

from application.logging_utils import hash_identifier
from domain.services.notification.password_reset_notifier import PasswordResetNotifier

logger = logging.getLogger(__name__)


class LogOnlyPasswordResetNotifier(PasswordResetNotifier):
    """Implémentation par défaut (dev): log uniquement.

    IMPORTANT: ne jamais activer en prod car cela expose le code dans les logs.
    En prod, remplacer par un sender Email/SMS.
    """

    def __init__(self, *, enabled: bool = True):
        self._enabled = enabled

    async def send_reset_code(self, *, email: str, code: str) -> None:
        if not self._enabled:
            return
        # Ne jamais logger le code/tokens (PII + secret). En dev, on log uniquement l'action.
        logger.info("notification.password_reset.requested", extra={"email_hash": hash_identifier(email)})
