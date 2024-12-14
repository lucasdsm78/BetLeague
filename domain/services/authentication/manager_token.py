from abc import ABC, abstractmethod
from typing import Optional

from domain.user.model.password import Password
from domain.user.model.user import User


class ManagerToken(ABC):

    @abstractmethod
    def generate_token_login(self, domain_user: User) -> str:
        raise NotImplementedError

    @abstractmethod
    def generate_expiration_token_login(self, domain_user: User) -> str:
        raise NotImplementedError

    @abstractmethod
    def decode_token_login(self, token: str) -> Optional[dict]:
        raise NotImplementedError

    @abstractmethod
    def decode_expiration_token_login(self, token: str, password: Password) -> Optional[dict]:
        raise NotImplementedError
