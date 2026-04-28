from abc import ABC, abstractmethod
from typing import Optional, List
from domain.purchase.model.pack import Pack

class PackRepository(ABC):

    @abstractmethod
    async def find_by_id(self, pack_id: int) -> Optional[Pack]:
        raise NotImplementedError

    @abstractmethod
    async def find_all(self) -> List[Pack]:
        raise NotImplementedError
