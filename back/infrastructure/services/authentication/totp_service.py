import asyncio

import qrcode
import io
from pydantic import BaseModel
import pyotp
from pyotp import TOTP
from domain.services.authentication.totp_service import TOTPService


class TOTPServiceImpl(TOTPService, BaseModel):

    async def generate_secret(self) -> str:
        return pyotp.random_base32()

    async def get_totp_uri(self, secret: str, email: str, issuer_name: str) -> str:
        return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=issuer_name)

    async def generate_qr_code(self, uri: str) -> bytes:
        def _make(uri_str):
            qr_img = qrcode.make(uri_str)
            buf = io.BytesIO()
            qr_img.save(buf, format="PNG")
            buf.seek(0)
            return buf.getvalue()
        return await asyncio.to_thread(_make, uri)

    async def verify_code(self, secret: str, code: str) -> bool:
        totp = pyotp.TOTP(secret)
        return await asyncio.to_thread(totp.verify, code, valid_window=1)

    async def encrypt_secret(self, secret: str, cipher_suite) -> str:
        encrypted_bytes = await asyncio.to_thread(cipher_suite.encrypt, secret.encode())
        return encrypted_bytes.decode()

    async def decrypt_secret(self, encrypted_secret: str, cipher_suite) -> str:
        decrypted_bytes = await asyncio.to_thread(cipher_suite.decrypt, encrypted_secret.encode())
        return decrypted_bytes.decode()
