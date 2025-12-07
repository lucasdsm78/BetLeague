import asyncio
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
from domain.services.stripe.stripe_service import StripeService
from domain.user.exception.user_exception import UserNotFoundError
from domain.user.model.user_summary import UserSummary
from domain.user.repository.user_repository import UserRepository
from infrastructure.postgresql.purchase.purchase_repository import PurchaseRepositoryImpl
from infrastructure.postgresql.user.user_repository import UserRepositoryImpl


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
    ):
        self.user_repository: UserRepository = user_repository
        self.pack_repository: PackRepository = pack_repository
        self._session_factory = session_factory
        self.stripe_service: StripeService = stripe_service
        self.purchase_repository: PurchaseRepository = purchase_repository
        self._lock = asyncio.Lock()


    async def create_intent(self, email: str, data: PurchaseCreateModel):
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

            new_purchase = await self.purchase_repository.find_by_uuid(uuid)

            new_purchase.stripe_session_id = session.id
            await self.purchase_repository.update(new_purchase)
            await self.purchase_repository.commit()

        except:
            await self.purchase_repository.rollback()
            raise

        return PurchaseCreateResponse(url=session.url, session_id=session.id)

    async def handle_webhook(self, payload: bytes, sig_header: str) -> None:
        event = self.stripe_service.verify_webhook(payload, sig_header)
        event_type = event["type"]

        if event_type == "charge.updated":
            charge = event["data"]["object"]
            charge_status = charge.get("status")

            if charge_status != "succeeded":
                return

            uuid = charge.get("metadata", {}).get("purchase_uuid")
            is_payment_successful = charge.get("paid", False)

        elif event_type == "payment_intent.succeeded":
            payment_intent = event["data"]["object"]
            uuid = payment_intent.get("metadata", {}).get("purchase_uuid")
            is_payment_successful = payment_intent.get("status") == "succeeded"

        else:
            return

        if not uuid:
            raise ValueError("No purchase UUID found in webhook event")

        async with self._session_factory() as session:
            async with session.begin(), self._lock:
                purchase_repo = PurchaseRepositoryImpl(session)
                user_repo = UserRepositoryImpl(session)

                purchase = await purchase_repo.find_by_uuid(uuid)

                if not purchase:
                    raise PurchaseNotFoundError

                if purchase.status.value == PurchaseStatus.succeeded.value:
                    return

                purchase.status = PurchaseStatus.succeeded if is_payment_successful else PurchaseStatus.failed

                await purchase_repo.update(purchase)

                if is_payment_successful:
                    user = await user_repo.find_by_id(purchase.user.id)
                    if not user:
                        raise UserNotFoundError
                    user.nb_btl += purchase.pack.total_btl
                    user.nb_btl_paid += purchase.pack.total_btl
                    await user_repo.update(user)
