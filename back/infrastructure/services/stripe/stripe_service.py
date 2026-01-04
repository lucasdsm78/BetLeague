import asyncio

import stripe
from domain.purchase.exception.purchase_exception import InvalidWebhookError
from concurrent.futures import ThreadPoolExecutor
from domain.purchase.model.purchase import Purchase
from domain.services.stripe.stripe_service import StripeService
from domain.tournament_subscription.model.tournament_subscription import TournamentSubscription
from infrastructure.config import Settings

_executor = ThreadPoolExecutor(max_workers=4)

class StripeServiceImpl(StripeService):

    def __init__(
            self,
            settings: Settings,
    ):
        self.settings: Settings = settings
        stripe.api_key = settings.stripe_api_key

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
                success_url="http://localhost:3000/profile?payment=success",
                cancel_url="http://localhost:3000/profile?payment=cancelled",
                idempotency_key=f"checkout_{purchase.uuid}",
                expand=["payment_intent"]
            )
        session = await asyncio.get_running_loop().run_in_executor(_executor, _create)
        return session

    async def create_subscription_session(
            self,
            customer_email: str,
            price_id: str,
            success_url: str,
            uuid: str,
            cancel_url: str,
            metadata: dict
    ) -> stripe.checkout.Session:
        try:

            session = stripe.checkout.Session.create(
                    mode="subscription",
                    payment_method_types=['card'],
                    payment_method_options={
                        "card": {"request_three_d_secure": "automatic"}
                    },
                    line_items=[{"price": price_id, "quantity": 1}],
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

            return session
        except stripe.error.StripeError as e:
            raise ValueError(f"Erreur lors de la création de la session Stripe: {e}")

    async def cancel_tournament_subscription(self, subscription_id: str) -> dict:
        try:
            return stripe.Subscription.cancel(subscription_id)
        except stripe.error.StripeError as e:
            raise ValueError(f"Erreur lors de l'annulation de l'abonnement: {e}")

    def verify_webhook(self, payload: bytes, sig_header: str) -> dict:
        try:
            return stripe.Webhook.construct_event(
                payload, sig_header, self.settings.stripe_webhook_secret
            )
        except stripe.error.SignatureVerificationError:
            raise InvalidWebhookError
