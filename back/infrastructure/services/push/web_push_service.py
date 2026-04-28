from __future__ import annotations

import asyncio
import json
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Mapping

from pywebpush import WebPushException, webpush

from domain.services.push.web_push_service import WebPushService
from infrastructure.config import Settings


logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="webpush")


class WebPushServiceImpl(WebPushService):

    def __init__(self, settings: Settings):
        self._vapid_private_key = settings.vapid_private_key
        self._vapid_public_key = settings.vapid_public_key
        self._vapid_claims_email = settings.vapid_claims_email
        self._ttl = getattr(settings, "vapid_ttl", 86400)

    def get_vapid_public_key(self) -> str:
        return self._vapid_public_key

    async def send(
        self,
        endpoint: str,
        p256dh_key: str,
        auth_key: str,
        payload: Mapping[str, Any],
    ) -> bool:
        subscription_info = {
            "endpoint": endpoint,
            "keys": {
                "p256dh": p256dh_key,
                "auth": auth_key,
            },
        }

        vapid_claims = {"sub": f"mailto:{self._vapid_claims_email}"}
        data = json.dumps(payload)

        loop = asyncio.get_running_loop()

        try:
            await loop.run_in_executor(
                _executor,
                lambda: webpush(
                    subscription_info=subscription_info,
                    data=data,
                    vapid_private_key=self._vapid_private_key,
                    vapid_claims=vapid_claims,
                    ttl=self._ttl,
                ),
            )
            return True

        except WebPushException as e:
            status_code = e.response.status_code if e.response is not None else 0

            if status_code in (404, 410):
                logger.info(
                    "Push subscription expired",
                    extra={"endpoint": endpoint[:80], "status": status_code},
                )
                return False

            if status_code in (401, 403):
                logger.error(
                    "VAPID authentication failed",
                    extra={"status": status_code, "error": str(e)},
                )
                raise

            if status_code == 429:
                logger.warning(
                    "Push rate limited",
                    extra={"endpoint": endpoint[:80]},
                )
                raise

            logger.error(
                "Push notification failed",
                extra={"status": status_code, "error": str(e)},
            )
            raise

        except Exception as e:
            logger.error(
                "Push notification error",
                extra={"error": str(e), "endpoint": endpoint[:80]},
            )
            raise
