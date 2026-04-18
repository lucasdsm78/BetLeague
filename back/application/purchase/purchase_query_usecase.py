from abc import ABC, abstractmethod
from typing import List

from domain.purchase.model.pack import Pack
from domain.purchase.model.purchase import Purchase
from domain.purchase.repository.pack_repository import PackRepository
from domain.purchase.repository.purchase_repository import PurchaseRepository
from domain.shop.service.shop_availability_policy import ShopAvailabilityPolicy

from domain.user.exception.user_exception import UserNotFoundError
from domain.user.repository.user_repository import UserRepository


class PurchaseQueryUseCase(ABC):

    @abstractmethod
    async def get_all_packs(self, email: str) -> List[Pack]:
        raise NotImplementedError

    @abstractmethod
    async def get_user_purchases(self, email: str) -> List[Purchase]:
        raise NotImplementedError


class PurchaseQueryUseCaseImpl(PurchaseQueryUseCase):

    def __init__(
            self,
            pack_repository: PackRepository,
            purchase_repository: PurchaseRepository,
            user_repository: UserRepository,
            shop_availability_policy: ShopAvailabilityPolicy,
    ):
        self.pack_repository = pack_repository
        self.purchase_repository = purchase_repository
        self.user_repository = user_repository
        self.shop_availability_policy = shop_availability_policy

    async def get_all_packs(self, email: str) -> List[Pack]:
        self.shop_availability_policy.ensure_btl_purchase_enabled()

        user = await self.user_repository.find_by_email(email)
        if not user:
            raise UserNotFoundError

        return await self.pack_repository.find_all()

    async def get_user_purchases(self, email: str) -> List[Purchase]:
        user = await self.user_repository.find_by_email(email)
        if not user:
            raise UserNotFoundError

        return await self.purchase_repository.find_all_by_user_id(user.id)
