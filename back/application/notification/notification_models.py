from __future__ import annotations

"""Compat: ce fichier est conservé pour rétro-compatibilité.

Historique: les modèles étaient tous dans `notification_models.py`.
On les a séparés en:
- `notification_query_model.py`
- `notification_command_model.py`
"""

from application.notification.notification_query_model import (  # noqa: F401
    NotificationReadModel,
    NotificationListResponse,
    UnreadCountResponse,
)
from application.notification.notification_command_model import MarkAllReadResponse  # noqa: F401
