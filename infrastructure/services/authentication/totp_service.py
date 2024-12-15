import qrcode
import io
from pydantic import BaseModel
import pyotp
from pyotp import TOTP
from domain.services.authentication.totp_service import TOTPService


class TOTPServiceImpl(TOTPService, BaseModel):

    def generate_secret(self) -> str:
        return pyotp.random_base32()

    def get_totp_uri(self, secret: str, email: str, issuer_name: str) -> str:
        return pyotp.totp.TOTP(secret).provisioning_uri(name=email, issuer_name=issuer_name)

    def generate_qr_code(self, uri: str) -> bytes:
        qr = qrcode.make(uri)
        buffer = io.BytesIO()
        qr.save(buffer, format="PNG")
        buffer.seek(0)
        return buffer.getvalue()

    def verify_code(self, secret: str, code: str) -> bool:
        return TOTP(secret).verify(code, valid_window=1)

    def encrypt_secret(self, secret: str, cipher_suite) -> str:
        return cipher_suite.encrypt(secret.encode()).decode()

    def decrypt_secret(self, encrypted_secret: str, cipher_suite) -> str:
        return cipher_suite.decrypt(encrypted_secret.encode()).decode()
