import asyncio
import logging
from typing import Any
from urllib.parse import urlencode

import stripe
from domain.purchase.exception.purchase_exception import InvalidWebhookError
from concurrent.futures import ThreadPoolExecutor
from domain.purchase.model.purchase import Purchase
from domain.services.stripe.stripe_service import StripeService
from infrastructure.config import Settings

_executor = ThreadPoolExecutor(max_workers=4)
logger = logging.getLogger(__name__)

class StripeServiceImpl(StripeService):

    def __init__(
            self,
            settings: Settings,
    ):
        self.settings: Settings = settings
        stripe.api_key = settings.stripe_api_key

    def _build_frontend_url(self, path: str, query_params: dict[str, str] | None = None) -> str:
        base = self.settings.app_frontend_url.rstrip("/")
        normalized_path = path if path.startswith("/") else f"/{path}"
        query = f"?{urlencode(query_params)}" if query_params else ""
        return f"{base}{normalized_path}{query}"

    async def create_payment_intent(self, purchase: Purchase) -> stripe.checkout.Session:
        def _create():
            return stripe.checkout.Session.create(
                mode="payment",
                line_items=[{
                    "price_data": {
                        "currency": "eur",
                        "unit_amount": purchase.pack.price_cents,
                        "product_data": {"name": purchase.pack.name},
                    },
                    "quantity": 1,
                }],
                payment_method_options={
                    "card": {"request_three_d_secure": "automatic"}
                },
                client_reference_id=purchase.uuid,
                customer_email=purchase.user.email.value,
                metadata={
                    "purchase_uuid": purchase.uuid,
                    "pack_id": str(purchase.pack.id),
                    "user_id": str(purchase.user.id),
                },
                payment_intent_data={
                    "metadata": {
                        "purchase_uuid": purchase.uuid,
                        "pack_id": str(purchase.pack.id),
                        "user_id": str(purchase.user.id),
                    }
                },
                success_url=self._build_frontend_url("/profile", {"payment": "success"}),
                cancel_url=self._build_frontend_url("/profile", {"payment": "cancelled"}),
                idempotency_key=f"checkout_{purchase.uuid}",
                expand=["payment_intent"]
            )
        session = await asyncio.get_running_loop().run_in_executor(_executor, _create)
        logger.info(
            "stripe.checkout_session.created",
            extra={
                "purchase_uuid": purchase.uuid,
                "user_id": purchase.user.id,
                "pack_id": purchase.pack.id,
                "stripe_session_id": getattr(session, "id", None),
            },
        )
        return session

    async def create_subscription_session(
            self,
            customer_email: str,
            price_data: dict[str, Any],
            success_url: str,
            uuid: str,
            cancel_url: str,
            metadata: dict
    ) -> stripe.checkout.Session:
        try:
            def _create():
                return stripe.checkout.Session.create(
                    mode="subscription",
                    payment_method_types=['card'],
                    payment_method_options={
                        "card": {"request_three_d_secure": "automatic"}
                    },
                    line_items=[{"price_data": price_data, "quantity": 1}],
                    client_reference_id=uuid,
                    customer_email=customer_email,
                    subscription_data={
                        'metadata': metadata
                    },
                    metadata=metadata,
                    success_url=success_url,
                    cancel_url=cancel_url,
                    idempotency_key=f"subscription_{uuid}",
                )

            session = await asyncio.get_running_loop().run_in_executor(_executor, _create)

            logger.info(
                "stripe.subscription_session.created",
                extra={
                    "subscription_uuid": uuid,
                    "stripe_session_id": getattr(session, "id", None),
                    "stripe_subscription_id": getattr(session, "subscription", None),
                },
            )
            return session
        except stripe.error.StripeError as e:
            logger.warning("stripe.subscription_session.failed", extra={"subscription_uuid": uuid, "error": str(e)})
            raise ValueError(f"Erreur lors de la création de la session Stripe: {e}")

    async def retrieve_checkout_session(self, session_id: str) -> dict[str, Any]:
        try:
            session = await asyncio.to_thread(stripe.checkout.Session.retrieve, session_id)
            logger.info("stripe.checkout_session.retrieved", extra={"stripe_session_id": session_id})
            return session
        except stripe.error.StripeError as e:
            logger.warning("stripe.checkout_session.retrieve_failed", extra={"stripe_session_id": session_id, "error": str(e)})
            raise ValueError(f"Erreur lors de la récupération de la session Stripe: {e}")

    async def retrieve_subscription(self, subscription_id: str) -> dict[str, Any]:
        try:
            subscription = await asyncio.to_thread(stripe.Subscription.retrieve, subscription_id)
            logger.info("stripe.subscription.retrieved", extra={"stripe_subscription_id": subscription_id})
            return subscription
        except stripe.error.StripeError as e:
            logger.warning("stripe.subscription.retrieve_failed", extra={"stripe_subscription_id": subscription_id, "error": str(e)})
            raise ValueError(f"Erreur lors de la récupération de l'abonnement Stripe: {e}")

    async def schedule_tournament_subscription_cancellation_at_period_end(self, subscription_id: str) -> dict:
        try:
            subscription = await asyncio.to_thread(stripe.Subscription.modify, subscription_id, cancel_at_period_end=True)
            logger.info("stripe.subscription.cancellation_scheduled", extra={"stripe_subscription_id": subscription_id})
            return subscription
        except stripe.error.StripeError as e:
            logger.warning("stripe.subscription.cancellation_failed", extra={"stripe_subscription_id": subscription_id, "error": str(e)})
            raise ValueError(f"Erreur lors de la planification de l'annulation de l'abonnement: {e}")

    def verify_webhook(self, payload: bytes, sig_header: str) -> dict:
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, self.settings.stripe_webhook_secret
            )
            logger.info("stripe.webhook.verified", extra={"payload_size": len(payload), "stripe_event_type": event.get("type")})
            return event
        except stripe.error.SignatureVerificationError:
            logger.warning("stripe.webhook.rejected", extra={"payload_size": len(payload), "reason": "invalid_signature"})
            raise InvalidWebhookError
