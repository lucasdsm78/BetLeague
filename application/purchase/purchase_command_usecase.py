from abc import ABC, abstractmethod
import shortuuid

from application.purchase.purchase_command_model import PurchaseCreateModel
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


class PurchaseCommandUseCase(ABC):

    @abstractmethod
    async def create_intent(self, email: str, data: PurchaseCreateModel):
        raise NotImplementedError


class PurchaseCommandUseCaseImpl(PurchaseCommandUseCase):

    def __init__(
            self,
            user_repository: UserRepository,
            pack_repository: PackRepository,
            stripe_service: StripeService,
            purchase_repository: PurchaseRepository,
    ):
        self.user_repository: UserRepository = user_repository
        self.pack_repository: PackRepository = pack_repository
        self.stripe_service: StripeService = stripe_service
        self.purchase_repository: PurchaseRepository = purchase_repository


    async def create_intent(self, email: str, data: PurchaseCreateModel):
        user = self.user_repository.find_by_email(email)
        if not user:
            raise UserNotFoundError

        pack = await self.pack_repository.find_by_id(data.pack_id)
        if not pack:
            raise PackNotFoundError

        purchase = Purchase(
            uuid=shortuuid.uuid(),
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

            session_id = await self.stripe_service.create_payment_intent(
                purchase
            )

            purchase.stripe_session_id = session_id
            await self.purchase_repository.update(purchase)

        except:
            await self.purchase_repository.rollback()
            raise

        return session_id

    async def handle_webhook(self, payload: bytes, sig_header: str):
        event = self.stripe_service.verify_webhook(payload, sig_header)

        intent = event["data"]["object"]
        pi = intent["id"]
        purchase = self.purchase_repository.find_by_intent(pi)
        if not purchase:
            raise PurchaseNotFoundError

        new_status = PurchaseStatus.succeeded if event["type"] == "payment_intent.succeeded" \
            else PurchaseStatus.failed
        purchase.status = new_status
        try:
            await self.purchase_repository.update(purchase)
            await self.purchase_repository.commit()
            # 3) si succeeded → créditer le user (via votre UserCommandUseCase ou un event emitter)
        except:
            self.repo.rollback()
            raise
