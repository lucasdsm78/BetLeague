from abc import ABC, abstractmethod
from typing import Optional
from domain.purchase.model.pack import Pack

class PackRepository(ABC):

    @abstractmethod
    async def find_by_id(self, pack_id: int) -> Optional[Pack]:
        raise NotImplementedError
