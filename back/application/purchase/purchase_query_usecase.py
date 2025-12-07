from abc import ABC, abstractmethod
from typing import List

from domain.purchase.model.pack import Pack
from domain.purchase.repository.pack_repository import PackRepository

from domain.user.exception.user_exception import UserNotFoundError
from domain.user.repository.user_repository import UserRepository


class PurchaseQueryUseCase(ABC):

    @abstractmethod
    async def get_all_packs(self, email: str) -> List[Pack]:
        raise NotImplementedError


class PurchaseQueryUseCaseImpl(PurchaseQueryUseCase):

    def __init__(self, pack_repository: PackRepository, user_repository: UserRepository):
        self.pack_repository = pack_repository
        self.user_repository = user_repository

    async def get_all_packs(self, email: str) -> List[Pack]:
        user = await self.user_repository.find_by_email(email)
        if not user:
            raise UserNotFoundError

        return await self.pack_repository.find_all()
