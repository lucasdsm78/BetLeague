import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Callable

import shortuuid
from sqlalchemy.ext.asyncio import AsyncSession

from application.purchase.purchase_command_model import PurchaseCreateModel, PurchaseCreateResponse
from domain.purchase.exception.pack_exception import PackNotFoundError
from domain.purchase.exception.purchase_exception import PurchaseNotFoundError
from domain.purchase.model.pack_summary import PackSummary
from domain.purchase.model.purchase import Purchase
from domain.purchase.model.purchase_status import PurchaseStatus
from domain.purchase.repository.pack_repository import PackRepository
from domain.purchase.repository.purchase_repository import PurchaseRepository
from domain.shop.service.shop_availability_policy import ShopAvailabilityPolicy
from domain.services.stripe.stripe_service import StripeService
from domain.user.exception.user_exception import UserNotFoundError
from domain.user.model.user_summary import UserSummary
from domain.user.repository.user_repository import UserRepository
from infrastructure.postgresql.purchase.purchase_repository import PurchaseRepositoryImpl
from infrastructure.postgresql.user.user_repository import UserRepositoryImpl


logger = logging.getLogger(__name__)


class PurchaseCommandUseCase(ABC):

    @abstractmethod
    async def create_intent(self, email: str, data: PurchaseCreateModel):
        raise NotImplementedError

    @abstractmethod
    async def handle_webhook(self, payload: bytes, sig_header: str):
        raise NotImplementedError

class PurchaseCommandUseCaseImpl(PurchaseCommandUseCase):

    def __init__(
            self,
            user_repository: UserRepository,
            pack_repository: PackRepository,
            session_factory: Callable[[], AsyncSession],
            stripe_service: StripeService,
            purchase_repository: PurchaseRepository,
            shop_availability_policy: ShopAvailabilityPolicy,
    ):
        self.user_repository: UserRepository = user_repository
        self.pack_repository: PackRepository = pack_repository
        self._session_factory = session_factory
        self.stripe_service: StripeService = stripe_service
        self.purchase_repository: PurchaseRepository = purchase_repository
        self.shop_availability_policy = shop_availability_policy
        self._lock = asyncio.Lock()


    async def create_intent(self, email: str, data: PurchaseCreateModel):
        self.shop_availability_policy.ensure_btl_purchase_enabled()

        user = await self.user_repository.find_by_email(email)
        if not user:
            raise UserNotFoundError

        pack = await self.pack_repository.find_by_id(data.pack_id)
        if not pack:
            raise PackNotFoundError

        uuid = shortuuid.uuid()
        purchase = Purchase(
            uuid=uuid,
            user=UserSummary(id=user.id, email=user.email, pseudo=user.pseudo),
            status=PurchaseStatus.pending,
            pack=PackSummary(
                id=pack.id,
                name=pack.name,
                total_btl=pack.total_btl,
                price_cents=pack.price_cents
            )
        )

        try:
            await self.purchase_repository.create(purchase)
            await self.purchase_repository.commit()

            session = await self.stripe_service.create_payment_intent(
                purchase
            )

            logger.info(
                "purchase.intent.stripe_session_created",
                extra={
                    "purchase_uuid": uuid,
                    "user_id": user.id,
                    "pack_id": pack.id,
                    "stripe_session_id": session.id,
                },
            )

            new_purchase = await self.purchase_repository.find_by_uuid(uuid)

            new_purchase.stripe_session_id = session.id
            await self.purchase_repository.update(new_purchase)
            await self.purchase_repository.commit()

            logger.info(
                "purchase.intent.created",
                extra={
                    "purchase_uuid": uuid,
                    "user_id": user.id,
                    "pack_id": pack.id,
                    "stripe_session_id": session.id,
                },
            )

        except Exception:
            await self.purchase_repository.rollback()
            logger.exception(
                "purchase.intent.failed",
                extra={
                    "user_id": getattr(user, "id", None),
                    "pack_id": getattr(data, "pack_id", None),
                },
            )
            raise

        return PurchaseCreateResponse(url=session.url, session_id=session.id)

    async def handle_webhook(self, payload: bytes, sig_header: str) -> None:
        event = self.stripe_service.verify_webhook(payload, sig_header)
        event_id = event.get("id")
        event_type = event["type"]

        logger.info(
            "purchase.webhook.verified",
            extra={
                "stripe_event_id": event_id,
                "stripe_event_type": event_type,
            },
        )

        # Stripe Checkout (mode=payment): événement recommandé.
        if event_type == "checkout.session.completed":
            session_obj = event["data"]["object"]
            uuid = session_obj.get("client_reference_id") or (session_obj.get("metadata") or {}).get("purchase_uuid")
            is_payment_successful = session_obj.get("payment_status") == "paid"
            session_pack_id = (session_obj.get("metadata") or {}).get("pack_id")
            session_user_id = (session_obj.get("metadata") or {}).get("user_id")
            amount_total = session_obj.get("amount_total")

        elif event_type == "charge.updated":
            charge = event["data"]["object"]
            if charge.get("status") != "succeeded":
                return
            uuid = (charge.get("metadata") or {}).get("purchase_uuid")
            is_payment_successful = bool(charge.get("paid", False))
            session_pack_id = (charge.get("metadata") or {}).get("pack_id")
            session_user_id = (charge.get("metadata") or {}).get("user_id")
            amount_total = charge.get("amount")

        elif event_type == "payment_intent.succeeded":
            payment_intent = event["data"]["object"]
            uuid = (payment_intent.get("metadata") or {}).get("purchase_uuid")
            is_payment_successful = payment_intent.get("status") == "succeeded"
            session_pack_id = (payment_intent.get("metadata") or {}).get("pack_id")
            session_user_id = (payment_intent.get("metadata") or {}).get("user_id")
            amount_total = payment_intent.get("amount_received") or payment_intent.get("amount")

        else:
            logger.info(
                "purchase.webhook.ignored",
                extra={
                    "stripe_event_id": event_id,
                    "stripe_event_type": event_type,
                    "reason": "unsupported_event",
                },
            )
            return

        if not uuid:
            logger.warning(
                "purchase.webhook.rejected",
                extra={
                    "stripe_event_id": event_id,
                    "stripe_event_type": event_type,
                    "reason": "missing_purchase_uuid",
                },
            )
            raise ValueError("No purchase UUID found in webhook event")

        if not is_payment_successful:
            logger.info(
                "purchase.webhook.ignored",
                extra={
                    "stripe_event_id": event_id,
                    "stripe_event_type": event_type,
                    "purchase_uuid": uuid,
                    "reason": "payment_not_successful",
                },
            )
            return

        async with self._session_factory() as session:
            async with session.begin(), self._lock:
                purchase_repo = PurchaseRepositoryImpl(session)
                user_repo = UserRepositoryImpl(session)

                purchase = await purchase_repo.find_by_uuid(uuid)

                if not purchase:
                    logger.warning(
                        "purchase.webhook.rejected",
                        extra={
                            "stripe_event_id": event_id,
                            "stripe_event_type": event_type,
                            "purchase_uuid": uuid,
                            "reason": "purchase_not_found",
                        },
                    )
                    raise PurchaseNotFoundError

                # Idempotence: si déjà success, on sort sans créditer.
                if purchase.status.value == PurchaseStatus.succeeded.value:
                    logger.info(
                        "purchase.webhook.idempotent",
                        extra={
                            "stripe_event_id": event_id,
                            "stripe_event_type": event_type,
                            "purchase_uuid": uuid,
                            "user_id": purchase.user.id,
                        },
                    )
                    return

                purchase.status = PurchaseStatus.succeeded

                await purchase_repo.update(purchase)

                # Défense in depth: vérifier cohérence pack/user/amount
                if session_pack_id is not None and str(purchase.pack.id) != str(session_pack_id):
                    raise ValueError("Pack mismatch between Stripe metadata and purchase")
                if session_user_id is not None and str(purchase.user.id) != str(session_user_id):
                    raise ValueError("User mismatch between Stripe metadata and purchase")
                if amount_total is not None and int(amount_total) != int(purchase.pack.price_cents):
                    raise ValueError("Amount mismatch between Stripe and pack price")

                user = await user_repo.find_by_id(purchase.user.id)
                if not user:
                    raise UserNotFoundError
                user.nb_btl += purchase.pack.total_btl
                user.nb_btl_paid += purchase.pack.total_btl
                await user_repo.update(user)

                logger.info(
                    "purchase.webhook.processed",
                    extra={
                        "stripe_event_id": event_id,
                        "stripe_event_type": event_type,
                        "purchase_uuid": uuid,
                        "user_id": user.id,
                        "pack_id": purchase.pack.id,
                        "credited_btl": purchase.pack.total_btl,
                    },
                )

