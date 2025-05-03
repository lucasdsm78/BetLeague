from abc import ABC, abstractmethod
from typing import Optional, List, Dict

from domain.user.model.user import User


class UserRepository(ABC):

    @abstractmethod
    async def create(self, user: User) -> Optional[User]:
        raise NotImplementedError

    @abstractmethod
    async def commit(self):
        raise NotImplementedError

    @abstractmethod
    async def find_by_email(self, email: str) -> Optional[User]:
        raise NotImplementedError

    @abstractmethod
    async def find_by_pseudo(self, pseudo: str) -> Optional[User]:
        raise NotImplementedError

    @abstractmethod
    async def update(self, user: User) -> Optional[User]:
        raise NotImplementedError

    @abstractmethod
    async def find_by_id(self, user_id: int) -> Optional[User]:
        raise NotImplementedError

    @abstractmethod
    async def find_users(self) -> List[User]:
        raise NotImplementedError

    @abstractmethod
    async def delete_user(self, user_id: int):
        raise NotImplementedError

    @abstractmethod
    async def get_all_rank_users(self) -> List[Dict[str, any]]:
        raise NotImplementedError

    @abstractmethod
    async def rollback(self):
        raise NotImplementedError
