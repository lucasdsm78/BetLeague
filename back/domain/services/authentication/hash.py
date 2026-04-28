from abc import ABC, abstractmethod


class Hash(ABC):
    @abstractmethod
    async def bcrypt(self, password: str) -> str:
        raise NotImplementedError

    @abstractmethod
    async def verify(self, plain_password: str, hashed_password: str) -> bool:
        raise NotImplementedError
