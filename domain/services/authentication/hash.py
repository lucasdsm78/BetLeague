from abc import ABC, abstractmethod


class Hash(ABC):
    @abstractmethod
    def bcrypt(self, password: str) -> str:
        raise NotImplementedError

    @abstractmethod
    def verify(self, plain_password: str, hashed_password: str) -> bool:
        raise NotImplementedError
