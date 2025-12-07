from abc import ABC, abstractmethod
from typing import List

from domain.purchase.model.pack import Pack
from domain.purchase.repository.pack_repository import PackRepository


class PurchaseQueryUseCase(ABC):

    @abstractmethod
    async def get_all_packs(self) -> List[Pack]:
        raise NotImplementedError


class PurchaseQueryUseCaseImpl(PurchaseQueryUseCase):

    def __init__(self, pack_repository: PackRepository):
        self.pack_repository = pack_repository

    async def get_all_packs(self) -> List[Pack]:
        """Récupère tous les packs BTL disponibles à l'achat"""
        return await self.pack_repository.find_all()
