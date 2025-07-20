import asyncio

import stripe
from domain.purchase.exception.purchase_exception import InvalidWebhookError
from concurrent.futures import ThreadPoolExecutor
from domain.purchase.model.purchase import Purchase
from domain.services.stripe.stripe_service import StripeService
from infrastructure.config import Settings

_executor = ThreadPoolExecutor(max_workers=4)

class StripeServiceImpl(StripeService):

    def __init__(
            self,
            settings: Settings,
    ):
        self.settings: Settings = settings
        stripe.api_key = settings.stripe_api_key

    async def create_payment_intent(self, purchase: Purchase) -> str:
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
                },
                payment_intent_data={
                    "metadata": {
                        "purchase_uuid": purchase.uuid,
                        "pack_id": str(purchase.pack.id),
                        "user_id": str(purchase.user.id),
                    }
                },
                success_url="http://localhost:8001/docs",
                cancel_url="http://localhost:8002/docs",
                idempotency_key=f"checkout_{purchase.uuid}",
                expand=["payment_intent"]
            )
        session = await asyncio.get_running_loop().run_in_executor(_executor, _create)
        return session.id

    def verify_webhook(self, payload: bytes, sig_header: str) -> dict:
        try:
            return stripe.Webhook.construct_event(
                payload, sig_header, self.settings.stripe_webhook_secret
            )
        except stripe.error.SignatureVerificationError:
            raise InvalidWebhookError
