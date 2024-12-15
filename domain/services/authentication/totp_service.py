from abc import ABC, abstractmethod
from typing import Optional

from domain.user.model.password import Password
from domain.user.model.user import User


class TOTPService(ABC):

    @abstractmethod
    def generate_secret(self) -> str:
        raise NotImplementedError

    @abstractmethod
    def generate_qr_code(self, uri: str) -> bytes:
        raise NotImplementedError

    @abstractmethod
    def get_totp_uri(self, secret: str, email: str, issuer_name: str) -> str:
        raise NotImplementedError

    @abstractmethod
    def verify_code(self, secret: str, code: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    def decrypt_secret(self, encrypted_secret: str, cipher_suite) -> str:
        raise NotImplementedError

    @abstractmethod
    def encrypt_secret(self, secret: str, cipher_suite) -> str:
        raise NotImplementedError
